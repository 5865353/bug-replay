/**
 * src/platforms/zentao.ts — 禅道平台集成
 *
 * 支持禅道 REST API v1：
 * - 创建 Bug
 * - 上传 .rrt 文件作为附件
 *
 * 认证方式：Token（从禅道个人设置页面获取）
 * API 文档：https://www.zentao.net/book/api/
 */

import type { RRTPackage } from '@shared/types';
import type { SubmitResult } from './base-platform';
import { formatTimePrecise, safeStringify } from '@shared/utils';
import { BasePlatform } from './base-platform';

// ============================================================
// 禅道配置接口
// ============================================================

export interface ZentaoConfig {
    /** 禅道实例 URL（如 https://zentao.example.com） */
    baseUrl: string;
    /** API Token（从禅道后台 → 个人设置 → API 密钥获取） */
    apiToken: string;
    /** 产品 ID（数字） */
    productId: number;
    /** 默认模块 ID（可选） */
    moduleId?: number;
    /** 默认严重程度 1-4（可选） */
    severity?: number;
    /** 默认优先级 1-4（可选） */
    priority?: number;
}

// ============================================================
// ZentaoPlatform 实现
// ============================================================

export class ZentaoPlatform extends BasePlatform {
    readonly name = '禅道';

    private config: ZentaoConfig;

    constructor(config: ZentaoConfig) {
        super();
        this.config = {
            ...config,
            baseUrl: config.baseUrl.replace(/\/+$/, ''),
        };
    }

    // ---------- 配置更新 ----------

    updateConfig(config: Partial<ZentaoConfig>): void {
        this.config = {
            ...this.config,
            ...config,
            baseUrl: config.baseUrl
                ? config.baseUrl.replace(/\/+$/, '')
                : this.config.baseUrl,
        };
    }

    // ---------- 配置验证 ----------

    async validateConfig(): Promise<boolean> {
        try {
            // 禅道验证：尝试获取当前用户信息
            const response = await fetch(
                `${this.config.baseUrl}/api.php/v1/user`,
                { headers: this.getAuthHeaders() },
            );

            if (!response.ok) {
                console.error(
                    `[BugReplay] 禅道配置验证失败: HTTP ${response.status}`,
                );
                return false;
            }

            const result = await response.json();
            // 禅道返回格式: { status: "success", data: "..." } 或 { status: "fail", ... }
            if (result.status === 'success') {
                console.log('[BugReplay] 禅道配置验证成功');
                return true;
            }

            console.error(
                `[BugReplay] 禅道配置验证失败: ${result.message || result.reason || '未知错误'}`,
            );
            return false;
        }
        catch (err) {
            console.error('[BugReplay] 禅道配置验证异常:', err);
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
                    error: '禅道配置验证失败，请检查 URL / API Token / 产品 ID',
                };
            }

            // 2. 构建 Bug 数据
            const meta = rrtPackage.metadata;
            const env = rrtPackage.environment;

            const steps = this.buildSteps(rrtPackage);

            const bugPayload: Record<string, unknown> = {
                product: this.config.productId,
                title: meta.title || 'Bug Report (BugReplay)',
                steps,
                severity: this.config.severity ?? 3, // 默认 3（一般）
                pri: this.config.priority ?? 3, // 默认 3（一般）
            };

            // 可选字段
            if (this.config.moduleId) {
                bugPayload.module = this.config.moduleId;
            }
            if (meta.tags?.length) {
                bugPayload.keywords = meta.tags.join(',');
            }

            // 3. 发送创建请求
            const createResponse = await fetch(
                `${this.config.baseUrl}/api.php/v1/products/${this.config.productId}/bugs`,
                {
                    method: 'POST',
                    headers: {
                        ...this.getAuthHeaders(),
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(bugPayload),
                },
            );

            if (!createResponse.ok) {
                const errText = await createResponse.text();
                console.error(
                    `[BugReplay] 禅道创建 Bug 失败: HTTP ${createResponse.status}`,
                    errText,
                );
                return {
                    success: false,
                    error: `创建 Bug 失败 (${createResponse.status}): ${errText.slice(0, 200)}`,
                };
            }

            const result = await createResponse.json();

            if (result.status !== 'success') {
                return {
                    success: false,
                    error: `创建 Bug 失败: ${result.message || result.reason || '未知错误'}`,
                };
            }

            // 禅道返回的 data 可能是 Bug ID 或完整对象
            const bugId = typeof result.data === 'object'
                ? result.data.id
                : result.data;
            const bugIdStr = String(bugId);

            console.log(`[BugReplay] 禅道 Bug 创建成功，ID: ${bugIdStr}`);

            // 4. 上传 .rrt 附件
            const attachResult = await this.uploadAttachment(bugIdStr, rrtPackage);

            if (!attachResult.success) {
                console.warn(
                    `[BugReplay] 禅道 Bug #${bugIdStr} 创建成功，但附件上传失败: ${attachResult.error}`,
                );
            }

            return {
                success: true,
                issueId: bugIdStr,
                issueUrl: `${this.config.baseUrl}/bug-view-${bugIdStr}.html`,
            };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[BugReplay] 禅道 submitBug 异常:', err);
            return { success: false, error: msg };
        }
    }

    // ---------- 上传附件 ----------

    async uploadAttachment(
        issueId: string,
        rrtPackage: RRTPackage,
    ): Promise<SubmitResult> {
        try {
            const rrtJson = safeStringify(rrtPackage);
            if (!rrtJson) {
                return { success: false, error: '序列化 .rrt 数据失败' };
            }

            const filename = `bugreplay-${rrtPackage.metadata.title || 'recording'}-${Date.now()}.rrt`
                .replace(/[\\/:*?"<>|]/g, '_');

            const blob = new Blob([rrtJson], { type: 'application/json' });

            const formData = new FormData();
            // 禅道上传文件参数名称为 'files'，关联对象类型为 'bug'
            formData.append('files', blob, filename);
            formData.append('objectType', 'bug');
            formData.append('objectID', issueId);

            const response = await fetch(
                `${this.config.baseUrl}/api.php/v1/files`,
                {
                    method: 'POST',
                    headers: {
                        ...this.getAuthHeaders(),
                        // 不设置 Content-Type，浏览器自动设置 boundary
                    },
                    body: formData,
                },
            );

            if (!response.ok) {
                const errText = await response.text();
                return {
                    success: false,
                    error: `附件上传失败 (${response.status}): ${errText.slice(0, 200)}`,
                };
            }

            const result = await response.json();

            if (result.status !== 'success') {
                return {
                    success: false,
                    error: `附件上传失败: ${result.message || '未知错误'}`,
                };
            }

            console.log(`[BugReplay] .rrt 附件上传到禅道成功: ${filename}`);
            return { success: true };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { success: false, error: msg };
        }
    }

    // ============================================================
    // 私有辅助方法
    // ============================================================

    /** 生成 Token 认证 Headers */
    private getAuthHeaders(): Record<string, string> {
        return {
            Token: this.config.apiToken,
            Accept: 'application/json',
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
            '</ul>',
        );

        // 附言
        lines.push(
            '<hr>',
            '<blockquote>',
            '使用 <strong>BugReplay</strong> 浏览器扩展录制。<br>',
            '下载附件 <code>.rrt</code> 文件，用 BugReplay 回放页面打开即可 100% 还原案发现场。',
            '</blockquote>',
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
