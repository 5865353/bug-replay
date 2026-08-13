/**
 * src/platforms/zentao.ts — 禅道平台集成
 *
 * 支持禅道 REST API v1 / v2：
 * - 创建 Bug
 * - 上传 .rrt 文件作为附件
 *
 * 认证方式（二选一）：
 * 1. 账号密码登录自动换取 Token（推荐）
 * 2. 手动填写 API Token（禅道后台 → 个人设置 → API 密钥）
 *
 * API 文档：https://www.zentao.net/book/api/
 */

import type { RRTPackage, ZentaoProduct, ZentaoProductsResult, ZentaoProject, ZentaoProjectsResult } from '@shared/types';
import type { SubmitResult } from './base-platform';
import { formatTimePrecise } from '@shared/utils';
import { BasePlatform } from './base-platform';

// ============================================================
// 禅道配置接口
// ============================================================

export interface ZentaoConfig {
    /** 禅道实例 URL（如 https://zentao.example.com） */
    baseUrl: string;
    /** 登录账号（推荐：自动换取 Token） */
    account?: string;
    /** 登录密码 */
    password?: string;
    /** API Token（手动填写，与 account/password 二选一） */
    apiToken?: string;
    /** 产品 ID（数字） */
    productId: number;
    /** 项目 ID（可选，提交时用户选择） */
    projectId?: number;
    /** 默认模块 ID（可选） */
    moduleId?: number;
    /** 默认严重程度 1-4（可选） */
    severity?: number;
    /** 默认优先级 1-4（可选） */
    priority?: number;
    /** Bug 类型（可选，默认 codeerror） */
    type?: string;
}

// ============================================================
// 登录结果
// ============================================================

export interface ZentaoLoginResult {
    success: boolean;
    token?: string;
    error?: string;
}

// ============================================================
// ZentaoPlatform 实现
// ============================================================

export class ZentaoPlatform extends BasePlatform {
    readonly name = '禅道';

    private config: ZentaoConfig;
    /** 登录后缓存的 Token（优先于 config.apiToken） */
    private _token: string | null = null;
    /** 上次验证/登录失败的具体原因 */
    private _lastError: string = '';

    constructor(config: ZentaoConfig) {
        super();
        this.config = {
            ...config,
            baseUrl: config.baseUrl.replace(/\/+$/, '')
        };
    }

    // ---------- 配置更新 ----------

    updateConfig(config: Partial<ZentaoConfig>): void {
        this.config = {
            ...this.config,
            ...config,
            baseUrl: config.baseUrl
                ? config.baseUrl.replace(/\/+$/, '')
                : this.config.baseUrl
        };
        this._token = null;
        this._lastError = '';
    }

    // ---------- 登录 ----------

    /**
     * 使用账号密码登录禅道，自动换取 API Token
     * 成功后将 Token 缓存到实例中，后续 API 调用自动使用
     */
    async login(): Promise<ZentaoLoginResult> {
        const { baseUrl, account, password } = this.config;

        if (!account || !password) {
            this._lastError = '缺少账号或密码';
            return { success: false, error: this._lastError };
        }

        try {
            const response = await fetch(`${baseUrl}/api.php/v2/users/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ account, password })
            });

            if (!response.ok) {
                const body = await response.text().catch(() => '');
                this._lastError = `登录请求失败 (${response.status}): ${body.slice(0, 200)}`;
                console.error(`[BugReplay] 禅道${this._lastError}`);
                return { success: false, error: this._lastError };
            }

            const result = await response.json();

            if (result.status === 'success' && result.token) {
                this._token = result.token;
                this._lastError = '';
                console.log('[BugReplay] 禅道登录成功, Token 已缓存');
                return { success: true, token: result.token };
            }

            this._lastError = (result.message || result.reason || '账号或密码错误') as string;
            console.error(`[BugReplay] 禅道登录失败: ${this._lastError}`, JSON.stringify(result));
            return { success: false, error: this._lastError };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this._lastError = `登录异常: ${msg}`;
            console.error('[BugReplay] 禅道登录异常:', err);
            return { success: false, error: this._lastError };
        }
    }

    /** 当前是否已有可用 Token */
    get hasToken(): boolean {
        return !!(this._token || this.config.apiToken);
    }

    /** 获取上次错误信息 */
    get lastError(): string {
        return this._lastError;
    }

    // ---------- 配置验证 ----------

    async validateConfig(): Promise<boolean> {
        try {
            // 如果没有 Token，尝试自动登录
            if (!this.hasToken) {
                const loginResult = await this.login();
                if (!loginResult.success) {
                    console.error(
                        `[BugReplay] 禅道自动登录失败: ${loginResult.error}`
                    );
                    return false;
                }
            }

            // 禅道验证：先尝试 v1，失败则回退到 v2
            const verifyResult = await this.tryVerify('v1');
            if (verifyResult) return true;

            console.warn('[BugReplay] 禅道 v1 验证失败，尝试 v2...');
            const v2Result = await this.tryVerify('v2');
            if (v2Result) return true;

            this._lastError = 'v1/v2 API 均验证失败，请确认禅道 REST API 已启用且账号密码正确';
            return false;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this._lastError = `验证异常: ${msg}`;
            console.error('[BugReplay] 禅道配置验证异常:', err);
            return false;
        }
    }

    /** 尝试指定版本的 API 验证 */
    private async tryVerify(version: 'v1' | 'v2'): Promise<boolean> {
        const path = version === 'v1' ? '/api.php/v1/user' : '/api.php/v2/user';
        try {
            const response = await fetch(
                `${this.config.baseUrl}${path}`,
                { headers: this.getAuthHeaders() }
            );

            if (!response.ok) {
                const body = await response.text().catch(() => '');
                console.warn(`[BugReplay] 禅道 ${version} 验证 HTTP ${response.status}: ${body.slice(0, 150)}`);
                return false;
            }

            const result = await response.json();

            // 禅道 v1 返回 { profile: {...} } 或 { id, account, ... }
            // 禅道 v2 返回 { status: "success", data: "..." }
            const isV1Success = version === 'v1' && (result.profile || result.id || result.account);
            const isV2Success = version === 'v2' && result.status === 'success';

            if (isV1Success || isV2Success) {
                this._lastError = '';
                console.log(`[BugReplay] 禅道 ${version} 验证成功`);
                return true;
            }

            console.warn(`[BugReplay] 禅道 ${version} 验证返回非预期格式: ${JSON.stringify(result).slice(0, 200)}`);
            return false;
        }
        catch (err) {
            console.warn(`[BugReplay] 禅道 ${version} 验证异常:`, err);
            return false;
        }
    }

    // ---------- 创建 Bug ----------

    async submitBug(rrtPackage: RRTPackage): Promise<SubmitResult> {
        try {
            // 1. 验证配置
            const valid = await this.validateConfig();
            if (!valid) {
                return {
                    success: false,
                    error: `禅道配置验证失败: ${this._lastError || '请检查 URL / 账号密码 / 产品 ID'}`
                };
            }

            // 2. 构建 Bug 数据
            const meta = rrtPackage.metadata;
            const _env = rrtPackage.environment;

            const steps = this.buildSteps(rrtPackage);

            const bugPayload: Record<string, unknown> = {
                product: this.config.productId,
                title: meta.title || 'Bug Report (BugReplay)',
                type: this.config.type || 'codeerror', // 默认：代码错误
                steps,
                severity: this.config.severity ?? 3, // 默认 3（一般）
                pri: this.config.priority ?? 3 // 默认 3（一般）
            };

            // 可选字段
            if (this.config.moduleId) {
                bugPayload.module = this.config.moduleId;
            }
            if (meta.tags?.length) {
                bugPayload.keywords = meta.tags.join(',');
            }

            // 3. 发送创建请求
            // 提交目标：v1 接口不支持 project 参数，选择项目时走 v2 创建 Bug，否则保持原 v1 逻辑
            // 注意：禅道 v2 API 会对路由参数（如 productID）先于 JSON body 做必填校验，
            // 因此 productID 必须放在 URL query 中，否则返回 "Missing required parameter: productID."
            const createResponse = this.config.projectId
                ? await fetch(
                        `${this.config.baseUrl}/api.php/v2/bugs?productID=${this.config.productId}`,
                        {
                            method: 'POST',
                            headers: {
                                ...this.getAuthHeaders(),
                                'Content-Type': 'application/json'
                            },
                            // v2 请求体字段为 productID（必填）+ openedBuild（必填）+ project（关联所属项目）
                            body: JSON.stringify({
                                ...bugPayload,
                                productID: this.config.productId,
                                openedBuild: ['trunk'],
                                project: this.config.projectId
                            })
                        }
                    )
                : await fetch(
                        `${this.config.baseUrl}/api.php/v1/products/${this.config.productId}/bugs`,
                        {
                            method: 'POST',
                            headers: {
                                ...this.getAuthHeaders(),
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(bugPayload)
                        }
                    );

            if (!createResponse.ok) {
                const errText = await createResponse.text();
                console.error(
                    `[BugReplay] 禅道创建 Bug 失败: HTTP ${createResponse.status}`,
                    errText
                );
                return {
                    success: false,
                    error: `创建 Bug 失败 (${createResponse.status}): ${errText.slice(0, 200)}`
                };
            }

            const result = await createResponse.json();

            // 禅道 v1 创建成功直接返回裸 Bug 对象（含 id 字段，status 是 Bug 自身状态如 active），
            // v2 返回 { status: 'success', data: {...} }，两种格式都要判定为成功
            const isV2Success = result.status === 'success' && result.data !== undefined;
            const isV1Success = typeof result.id === 'number' || typeof result.id === 'string';

            if (!isV2Success && !isV1Success) {
                return {
                    success: false,
                    error: `创建 Bug 失败: ${result.message || result.reason || '未知错误'}`
                };
            }

            // 提取 Bug ID：兼容 { data: { id } }、{ data: 7 }、裸对象 { id: 7 } 三种形态
            const rawBugId = result.data !== undefined
                ? (typeof result.data === 'object' ? result.data.id : result.data)
                : result.id;
            const bugIdStr = String(rawBugId);

            console.log(`[BugReplay] 禅道 Bug 创建成功，ID: ${bugIdStr}`);

            // 4. 上传 .rrt 附件
            const attachResult = await this.uploadAttachment(bugIdStr, rrtPackage);

            const submitResult: SubmitResult = {
                success: true,
                issueId: bugIdStr,
                // 禅道 22.x 网页版 Bug 详情地址格式（/index.php?m=bug&f=view&bugID=xx）
                issueUrl: `${this.config.baseUrl}/index.php?m=bug&f=view&bugID=${bugIdStr}`
            };

            if (!attachResult.success) {
                console.warn(
                    `[BugReplay] 禅道 Bug #${bugIdStr} 创建成功，但附件上传失败: ${attachResult.error}`
                );
                submitResult.warning = `Bug 已提交，但 .rrt 附件上传失败: ${attachResult.error}`;
            }

            return submitResult;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[BugReplay] 禅道 submitBug 异常:', err);
            return { success: false, error: msg };
        }
    }

    // ---------- 项目列表 ----------

    /**
     * 获取禅道项目列表（提交 Bug 时供用户选择目标项目）
     *
     * 先尝试 v1（返回 { projects: [...] }），失败则回退 v2（{ status, data } 包装或数组）。
     * 禅道项目列表接口不按产品过滤，拉全量列表供用户选择。
     */
    async getProjects(): Promise<ZentaoProjectsResult> {
        try {
            // 确保有可用 Token
            if (!this.hasToken) {
                const loginResult = await this.login();
                if (!loginResult.success) {
                    this._lastError = loginResult.error || '登录失败';
                    return { success: false, error: this._lastError };
                }
            }

            const v1Result = await this.tryFetchProjects('v1');
            if (v1Result.success) return v1Result;

            console.warn('[BugReplay] 禅道 v1 获取项目列表失败，尝试 v2...');
            const v2Result = await this.tryFetchProjects('v2');
            if (v2Result.success) return v2Result;

            return {
                success: false,
                error: this._lastError || '获取项目列表失败，请确认禅道 REST API 已启用'
            };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this._lastError = `获取项目列表异常: ${msg}`;
            console.error('[BugReplay] 禅道 getProjects 异常:', err);
            return { success: false, error: this._lastError };
        }
    }

    /** 尝试从指定版本 API 拉取项目列表 */
    private async tryFetchProjects(version: 'v1' | 'v2'): Promise<ZentaoProjectsResult> {
        const path = version === 'v1' ? '/api.php/v1/projects?limit=1000' : '/api.php/v2/projects?limit=1000';
        try {
            const response = await fetch(
                `${this.config.baseUrl}${path}`,
                { headers: this.getAuthHeaders() }
            );

            if (!response.ok) {
                const body = await response.text().catch(() => '');
                this._lastError = `获取项目列表失败 (HTTP ${response.status}): ${body.slice(0, 150)}`;
                console.warn(`[BugReplay] 禅道 ${version} 获取项目列表 HTTP ${response.status}: ${body.slice(0, 150)}`);
                return { success: false, error: this._lastError };
            }

            const result = await response.json();

            //  v1 返回 { projects: [...] }；v2 返回 { status, data }（data 为数组或对象）
            // 部分版本可能直接返回数组，做兼容处理
            let list: unknown = result;
            if (Array.isArray(result)) {
                list = result;
            }
            else if (result && typeof result === 'object') {
                const anyResult = result as Record<string, unknown>;
                if (Array.isArray(anyResult.projects)) {
                    list = anyResult.projects;
                }
                else if (anyResult.data && typeof anyResult.data === 'object') {
                    const data: unknown = anyResult.data;
                    if (Array.isArray(data)) {
                        list = data;
                    }
                    else if (data && typeof data === 'object') {
                        const dataObj = data as Record<string, unknown>;
                        if (Array.isArray(dataObj.projects)) {
                            list = dataObj.projects;
                        }
                    }
                }
            }

            if (!Array.isArray(list)) {
                this._lastError = `获取项目列表失败: 非预期响应格式 ${JSON.stringify(result).slice(0, 150)}`;
                console.warn('[BugReplay] 禅道 项目列表非预期格式:', JSON.stringify(result).slice(0, 200));
                return { success: false, error: this._lastError };
            }

            const projects: ZentaoProject[] = (list as Array<Record<string, unknown>>)
                .filter(p => p && (typeof p.id === 'number' || typeof p.id === 'string'))
                .map(p => ({
                    id: Number(p.id),
                    name: String(p.name || p.code || `项目 ${p.id}`)
                }));

            console.log(`[BugReplay] 禅道 ${version} 获取项目列表成功: ${projects.length} 个项目`);
            return { success: true, projects };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this._lastError = `获取项目列表异常: ${msg}`;
            console.warn(`[BugReplay] 禅道 ${version} 获取项目列表异常:`, err);
            return { success: false, error: this._lastError };
        }
    }

    // ---------- 产品列表 ----------

    /**
     * 获取禅道产品列表（提交 Bug 时供用户选择目标产品）
     *
     * 先尝试 v1（直接返回产品数组），失败则回退 v2（{ status, data } 包装格式）。
     */
    async getProducts(): Promise<ZentaoProductsResult> {
        try {
            // 确保有可用 Token
            if (!this.hasToken) {
                const loginResult = await this.login();
                if (!loginResult.success) {
                    this._lastError = loginResult.error || '登录失败';
                    return { success: false, error: this._lastError };
                }
            }

            const v1Result = await this.tryFetchProducts('v1');
            if (v1Result.success) return v1Result;

            console.warn('[BugReplay] 禅道 v1 获取产品列表失败，尝试 v2...');
            const v2Result = await this.tryFetchProducts('v2');
            if (v2Result.success) return v2Result;

            return {
                success: false,
                error: this._lastError || '获取产品列表失败，请确认禅道 REST API 已启用'
            };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this._lastError = `获取产品列表异常: ${msg}`;
            console.error('[BugReplay] 禅道 getProducts 异常:', err);
            return { success: false, error: this._lastError };
        }
    }

    /** 尝试从指定版本 API 拉取产品列表 */
    private async tryFetchProducts(version: 'v1' | 'v2'): Promise<ZentaoProductsResult> {
        const path = version === 'v1' ? '/api.php/v1/products' : '/api.php/v2/products';
        try {
            const response = await fetch(
                `${this.config.baseUrl}${path}`,
                { headers: this.getAuthHeaders() }
            );

            if (!response.ok) {
                const body = await response.text().catch(() => '');
                this._lastError = `获取产品列表失败 (HTTP ${response.status}): ${body.slice(0, 150)}`;
                console.warn(`[BugReplay] 禅道 ${version} 获取产品列表 HTTP ${response.status}: ${body.slice(0, 150)}`);
                return { success: false, error: this._lastError };
            }

            const result = await response.json();

            // v1 直接返回数组；v2 返回 { status, data }；部分版本可能是 { products: [...] }
            const list = Array.isArray(result)
                ? result
                : (result?.data ?? result?.products);

            if (!Array.isArray(list)) {
                this._lastError = `获取产品列表失败: 非预期响应格式 ${JSON.stringify(result).slice(0, 150)}`;
                console.warn(`[BugReplay] 禅道 ${version} 产品列表非预期格式:`, JSON.stringify(result).slice(0, 200));
                return { success: false, error: this._lastError };
            }

            const products: ZentaoProduct[] = (list as Array<Record<string, unknown>>)
                .filter(p => p && (typeof p.id === 'number' || typeof p.id === 'string'))
                .map(p => ({
                    id: Number(p.id),
                    name: String(p.name || p.title || `产品 ${p.id}`)
                }));

            console.log(`[BugReplay] 禅道 ${version} 获取产品列表成功: ${products.length} 个产品`);
            return { success: true, products };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this._lastError = `获取产品列表异常: ${msg}`;
            console.warn(`[BugReplay] 禅道 ${version} 获取产品列表异常:`, err);
            return { success: false, error: this._lastError };
        }
    }

    // ---------- 上传附件 ----------

    async uploadAttachment(
        issueId: string,
        rrtPackage: RRTPackage
    ): Promise<SubmitResult> {
        try {
            // 完整序列化为 .rrt 文件内容（不能使用 safeStringify——它会按 5000 字符/5 层深度截断，导致附件不完整）
            const rrtJson = JSON.stringify(rrtPackage);
            if (!rrtJson) {
                return { success: false, error: '序列化 .rrt 数据失败' };
            }

            // 直接上传 .rrt 文件（内容为录制 JSON），下载后即可用 BugReplay 回放
            const filename = `bugreplay-${(rrtPackage.metadata.title || 'recording').replace(/[\\/:*?"<>|]/g, '_')}-${Date.now()}.rrt`;
            const blob = new Blob([rrtJson], { type: 'application/octet-stream' });

            // 路径 1：REST v2 files 接口（禅道官方标准接口，见 /dev/f=api&module=v2 文档）
            const v2Result = await this.uploadViaRestV2(issueId, blob, filename);
            if (v2Result.success) {
                return v2Result;
            }

            // 路径 2：Web 会话上传（跨版本兜底；需账号密码）
            const webResult = await this.uploadViaWebSession(issueId, blob, filename);
            if (webResult.success) {
                return webResult;
            }

            // 两条路径均失败，返回完整诊断信息
            return {
                success: false,
                error: `REST v2: ${v2Result.error}；Web 会话: ${webResult.error}`
            };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { success: false, error: msg };
        }
    }

    /**
     * 路径 1：REST v2 files 接口（禅道官方推荐的附件上传方式）
     *
     * POST /api.php/v2/files，multipart 表单字段：
     * - file：文件本体
     * - objectType：关联对象类型（bug / story / task / testcase）
     * - objectID：关联对象 ID
     * 响应：{ status: 'success', id, url }（仅失败时返回 fail/error + message）
     */
    private async uploadViaRestV2(
        issueId: string,
        blob: Blob,
        filename: string
    ): Promise<SubmitResult> {
        try {
            const formData = new FormData();
            formData.append('file', blob, filename);
            formData.append('objectType', 'bug');
            formData.append('objectID', issueId);

            const response = await fetch(
                `${this.config.baseUrl}/api.php/v2/files`,
                {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: formData
                }
            );

            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                return {
                    success: false,
                    error: `HTTP ${response.status}: ${errText.slice(0, 200)}`
                };
            }

            const result = await response.json().catch(() => null);
            if (!result) {
                return { success: false, error: '响应不是合法 JSON' };
            }

            // 上传成功返回 { status: 'success' } 或带 id/url；失败才返回 fail/error + message
            const isUploadSuccess = result.status === 'success' || result.id !== undefined;
            if (!isUploadSuccess) {
                return {
                    success: false,
                    error: typeof result.message === 'string' ? result.message : '未知错误'
                };
            }

            console.log(`[BugReplay] .rrt 附件上传到禅道成功 (REST v2): ${filename}`);
            return { success: true };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { success: false, error: msg };
        }
    }

    /**
     * 路径 2：Web 会话上传（禅道官方推荐的跨版本方案，见 extension-dev/1341）
     *
     * 流程：getSessionID 获取会话 → user/login 会话登录 → file/ajaxUpload 上传并关联到 Bug。
     * 相比 REST API，Web 会话方式在所有禅道版本上都能工作。
     */
    private async uploadViaWebSession(
        issueId: string,
        blob: Blob,
        filename: string
    ): Promise<SubmitResult> {
        const { account, password } = this.config;
        if (!account || !password) {
            return {
                success: false,
                error: '需要账号密码才能走 Web 会话上传（当前仅配置 API Token）'
            };
        }

        try {
            // 1. 获取会话
            const sidResp = await fetch(
                `${this.config.baseUrl}/index.php?m=api&f=getSessionID&t=json`,
                { headers: { Accept: 'application/json' } }
            );
            const sidJson = await sidResp.json().catch(() => null);
            const sidData = (sidJson?.data || sidJson) as Record<string, unknown>;
            const sessionName = (sidData.sessionName as string) || 'zentaosid';
            const sessionID = sidData.sessionID as string;
            if (!sessionID) {
                return {
                    success: false,
                    error: '获取禅道会话失败 (getSessionID 未返回 sessionID)'
                };
            }
            const sidQuery = `${sessionName}=${sessionID}`;

            // 2. 会话登录
            const loginForm = new FormData();
            loginForm.append('account', account);
            loginForm.append('password', password);
            const loginResp = await fetch(
                `${this.config.baseUrl}/index.php?m=user&f=login&${sidQuery}`,
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: loginForm
                }
            );
            const loginText = await loginResp.text().catch(() => '');
            let loginErr = '';
            try {
                const loginJson = loginText ? JSON.parse(loginText) : {};
                if (loginJson.result === 'fail' || loginJson.status === 'fail') {
                    loginErr = (loginJson.message as string) || '登录失败';
                }
            }
            catch { /* 登录成功时部分版本返回 HTML 或空响应，非失败 */ }

            // 3. 上传附件：禅道 file->ajaxUpload 读取 $_FILES['files']，multipart 字段名为 files[]
            // 同时挂 imgFile 兼容部分旧版本，避免服务端因字段名不匹配拒收
            const uploadForm = new FormData();
            uploadForm.append('files[]', blob, filename);
            uploadForm.append('imgFile', blob, filename);
            const uploadResp = await fetch(
                `${this.config.baseUrl}/index.php?m=file&f=ajaxUpload&objectType=bug&objectID=${issueId}&${sidQuery}`,
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: uploadForm
                }
            );
            const uploadText = await uploadResp.text().catch(() => '');
            let uploadJson: Record<string, unknown> = {};
            try {
                uploadJson = uploadText ? JSON.parse(uploadText) : {};
            }
            catch { /* 非 JSON 响应 */ }

            const uploadOk = uploadJson.result === 'success'
                || uploadJson.status === 'success'
                || uploadJson.id !== undefined;
            if (uploadOk) {
                console.log(`[BugReplay] .rrt 附件上传到禅道成功 (Web 会话): ${filename}`);
                return { success: true };
            }

            const uploadErr = typeof uploadJson.message === 'string' ? uploadJson.message : '';
            return {
                success: false,
                error: loginErr
                    ? `登录失败: ${loginErr}`
                    : (uploadErr || `上传响应异常 (HTTP ${uploadResp.status}): ${uploadText.slice(0, 200)}`)
            };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { success: false, error: msg };
        }
    }

    // ============================================================
    // 私有辅助方法
    // ============================================================

    /** 生成 Token 认证 Headers（优先使用登录 Token） */
    private getAuthHeaders(): Record<string, string> {
        const token = this._token || this.config.apiToken || '';
        return {
            Token: token,
            Accept: 'application/json'
        };
    }

    /** 从 .rrt 数据构建 Bug 复现步骤 */
    private buildSteps(rrt: RRTPackage): string {
        const m = rrt.metadata;
        const env = rrt.environment;

        const lines: string[] = [];

        // 原始描述
        if (m.description) {
            lines.push(`<p><strong>问题描述：</strong>${this.escapeHtml(m.description)}</p>`);
        }

        // 环境信息
        lines.push('<hr>', '<h3>录制环境</h3>', '<table>');
        if (env.url) {
            lines.push(`<tr><td>页面 URL</td><td>${this.escapeHtml(env.url)}</td></tr>`);
        }
        if (m.duration) {
            lines.push(`<tr><td>录制时长</td><td>${formatTimePrecise(m.duration)}</td></tr>`);
        }
        if (env.userAgent) {
            lines.push(`<tr><td>浏览器</td><td>${this.escapeHtml(env.userAgent)}</td></tr>`);
        }
        if (env.screenResolution) {
            lines.push(`<tr><td>分辨率</td><td>${env.screenResolution.width}×${env.screenResolution.height}</td></tr>`);
        }
        if (m.createdBy) {
            lines.push(`<tr><td>录制者</td><td>${this.escapeHtml(m.createdBy)}</td></tr>`);
        }
        lines.push('</table>');

        // 统计信息
        lines.push(
            '<hr>',
            '<h3>录制统计</h3>',
            '<ul>',
            `<li>网络请求：${rrt.networkLogs.length} 条</li>`,
            `<li>控制台日志：${rrt.consoleLogs.length} 条</li>`,
            `<li>标注：${rrt.annotations.length} 条</li>`,
            '</ul>'
        );

        // 附言
        lines.push(
            '<hr>',
            '<blockquote>',
            '使用 <strong>BugReplay</strong> 浏览器扩展录制。<br>',
            '下载附件 <code>.rrt</code> 文件，用 BugReplay 回放页面打开即可 100% 还原案发现场。',
            '</blockquote>'
        );

        return lines.join('\n');
    }

    private escapeHtml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
