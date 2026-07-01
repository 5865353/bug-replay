/**
 * src/platforms/jira.ts — Jira 平台集成
 *
 * 支持 Jira Cloud REST API v3：
 * - 创建 Issue（Bug 类型）
 * - 上传 .rrt 文件作为附件
 *
 * 认证方式：Email + API Token（Basic Auth）
 * API 文档：https://developer.atlassian.com/cloud/jira/platform/rest/v3/
 */

import type { RRTPackage } from '@shared/types';
import { formatTimePrecise, safeStringify } from '@shared/utils';
import { BasePlatform, type SubmitResult } from './base-platform';

// ============================================================
// Jira 配置接口
// ============================================================

export interface JiraConfig {
    /** Jira 实例 URL（如 https://your-domain.atlassian.net） */
    baseUrl: string;
    /** 认证邮箱 */
    email: string;
    /** API Token（从 https://id.atlassian.com/manage-profile/security/api-tokens 获取） */
    apiToken: string;
    /** 默认项目 Key（如 "PROJ"） */
    projectKey: string;
    /** 默认 Issue 类型名称（如 "Bug"），留空则使用项目默认 */
    issueTypeName?: string;
    /** 优先级名称（如 "High", "Medium"），留空则使用 Jira 默认 */
    priorityName?: string;
}

// ============================================================
// JiraPlatform 实现
// ============================================================

export class JiraPlatform extends BasePlatform {
    readonly name = 'Jira';

    private config: JiraConfig;

    constructor(config: JiraConfig) {
        super();
        // 确保 baseUrl 末尾无斜杠
        this.config = {
            ...config,
            baseUrl: config.baseUrl.replace(/\/+$/, ''),
        };
    }

    // ---------- 配置更新 ----------

    /** 更新配置（如用户在设置页面修改） */
    updateConfig(config: Partial<JiraConfig>): void {
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
            const response = await fetch(
                `${this.config.baseUrl}/rest/api/3/myself`,
                {
                    method: 'GET',
                    headers: this.getAuthHeaders(),
                },
            );

            if (!response.ok) {
                console.error(
                    `[BugReplay] Jira 配置验证失败: HTTP ${response.status}`,
                );
                return false;
            }

            const user = await response.json();
            console.log(
                `[BugReplay] Jira 配置验证成功，当前用户: ${user.displayName}`,
            );
            return true;
        }
        catch (err) {
            console.error('[BugReplay] Jira 配置验证异常:', err);
            return false;
        }
    }

    // ---------- 创建 Bug ----------

    async submitBug(rrtPackage: RRTPackage): Promise<SubmitResult> {
        try {
            // 1. 先验证配置
            const valid = await this.validateConfig();
            if (!valid) {
                return {
                    success: false,
                    error: 'Jira 配置验证失败，请检查 URL / 邮箱 / API Token',
                };
            }

            // 2. 获取或创建 Issue 类型 ID
            const issueTypeId = await this.resolveIssueTypeId();
            if (!issueTypeId) {
                return {
                    success: false,
                    error: `无法找到 Issue 类型: ${this.config.issueTypeName || 'Bug'}`,
                };
            }

            // 3. 构建 Issue 描述（从 .rrt 元数据提取）
            const description = this.buildDescription(rrtPackage);

            // 4. 创建 Issue
            const issuePayload: Record<string, unknown> = {
                fields: {
                    project: { key: this.config.projectKey },
                    summary: rrtPackage.metadata.title || 'Bug Report (BugReplay)',
                    issuetype: { id: issueTypeId },
                    description: {
                        type: 'doc',
                        version: 1,
                        content: [
                            {
                                type: 'paragraph',
                                content: [
                                    {
                                        type: 'text',
                                        text: description,
                                    },
                                ],
                            },
                        ],
                    },
                },
            };

            // 可选：优先级
            if (this.config.priorityName) {
                const priorityId = await this.resolvePriorityId();
                if (priorityId) {
                    (issuePayload.fields as Record<string, unknown>).priority = { id: priorityId };
                }
            }

            // 可选：标签
            if (rrtPackage.metadata.tags?.length) {
                (issuePayload.fields as Record<string, unknown>).labels = rrtPackage.metadata.tags;
            }

            const createResponse = await fetch(
                `${this.config.baseUrl}/rest/api/3/issue`,
                {
                    method: 'POST',
                    headers: {
                        ...this.getAuthHeaders(),
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(issuePayload),
                },
            );

            if (!createResponse.ok) {
                const errBody = await createResponse.text();
                console.error(
                    `[BugReplay] Jira 创建 Issue 失败: HTTP ${createResponse.status}`,
                    errBody,
                );
                return {
                    success: false,
                    error: `创建 Issue 失败 (${createResponse.status}): ${errBody.slice(0, 200)}`,
                };
            }

            const issue = await createResponse.json();
            const issueKey: string = issue.key;
            const issueId: string = issue.id;

            console.log(`[BugReplay] Jira Issue 创建成功: ${issueKey}`);

            // 5. 上传 .rrt 附件
            const attachResult = await this.uploadAttachment(issueId, rrtPackage);

            if (!attachResult.success) {
                console.warn(
                    `[BugReplay] Jira Issue ${issueKey} 创建成功，但附件上传失败: ${attachResult.error}`,
                );
            }

            return {
                success: true,
                issueId: issueKey,
                issueUrl: `${this.config.baseUrl}/browse/${issueKey}`,
            };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[BugReplay] Jira submitBug 异常:', err);
            return { success: false, error: msg };
        }
    }

    // ---------- 上传附件 ----------

    async uploadAttachment(
        issueId: string,
        rrtPackage: RRTPackage,
    ): Promise<SubmitResult> {
        try {
            // 生成 .rrt 文件内容
            const rrtJson = safeStringify(rrtPackage);
            if (!rrtJson) {
                return { success: false, error: '序列化 .rrt 数据失败' };
            }

            const filename = `bugreplay-${rrtPackage.metadata.title || 'recording'}-${Date.now()}.rrt`
                .replace(/[\\/:*?"<>|]/g, '_');

            const blob = new Blob([rrtJson], { type: 'application/json' });

            // Jira 附件上传需要 multipart/form-data
            const formData = new FormData();
            formData.append('file', blob, filename);

            const response = await fetch(
                `${this.config.baseUrl}/rest/api/3/issue/${issueId}/attachments`,
                {
                    method: 'POST',
                    headers: {
                        // Jira 附件上传需要 X-Atlassian-Token 防止 CSRF
                        'X-Atlassian-Token': 'no-check',
                        ...this.getAuthHeaders(),
                        // 注意：不要手动设置 Content-Type，让浏览器自动设置 multipart boundary
                    },
                    body: formData,
                },
            );

            if (!response.ok) {
                const errBody = await response.text();
                return {
                    success: false,
                    error: `附件上传失败 (${response.status}): ${errBody.slice(0, 200)}`,
                };
            }

            console.log(`[BugReplay] .rrt 附件上传成功: ${filename}`);
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

    /** 生成 Basic Auth Headers */
    private getAuthHeaders(): Record<string, string> {
        const encoded = btoa(`${this.config.email}:${this.config.apiToken}`);
        return {
            Authorization: `Basic ${encoded}`,
            Accept: 'application/json',
        };
    }

    /** 解析 Issue Type ID */
    private async resolveIssueTypeId(): Promise<string | null> {
        const typeName = this.config.issueTypeName || 'Bug';

        try {
            const response = await fetch(
                `${this.config.baseUrl}/rest/api/3/issuetype`,
                { headers: this.getAuthHeaders() },
            );

            if (!response.ok) return null;

            const types: Array<{ id: string; name: string }> = await response.json();
            const match = types.find(
                t => t.name.toLowerCase() === typeName.toLowerCase(),
            );
            return match?.id ?? types[0]?.id ?? null;
        }
        catch {
            return null;
        }
    }

    /** 解析优先级 ID */
    private async resolvePriorityId(): Promise<string | null> {
        if (!this.config.priorityName) return null;

        try {
            const response = await fetch(
                `${this.config.baseUrl}/rest/api/3/priority`,
                { headers: this.getAuthHeaders() },
            );

            if (!response.ok) return null;

            const priorities: Array<{ id: string; name: string }> = await response.json();
            const match = priorities.find(
                p => p.name.toLowerCase() === this.config.priorityName!.toLowerCase(),
            );
            return match?.id ?? null;
        }
        catch {
            return null;
        }
    }

    /** 从 .rrt 数据构建 Issue 描述文本 */
    private buildDescription(rrt: RRTPackage): string {
        const m = rrt.metadata;
        const env = rrt.environment;

        const lines: string[] = [];

        if (m.description) {
            lines.push(m.description, '');
        }

        lines.push('---');
        lines.push('## BugReplay 录制信息');
        lines.push('');

        if (m.duration) {
            lines.push(`- **录制时长**: ${formatTimePrecise(m.duration)}`);
        }
        if (env.url) {
            lines.push(`- **录制页面**: ${env.url}`);
        }
        if (env.userAgent) {
            lines.push(`- **浏览器**: ${env.userAgent}`);
        }
        if (env.screenResolution) {
            lines.push(`- **分辨率**: ${env.screenResolution.width}×${env.screenResolution.height}`);
        }
        if (m.createdBy) {
            lines.push(`- **录制者**: ${m.createdBy}`);
        }

        lines.push('');
        lines.push(
            `- **网络请求数**: ${rrt.networkLogs.length}`,
            `- **控制台日志数**: ${rrt.consoleLogs.length}`,
            `- **标注数**: ${rrt.annotations.length}`,
        );

        lines.push('');
        lines.push(
            '> 使用 [BugReplay](https://github.com/bugreplay) 录制。',
            '下载附件 .rrt 文件，用 BugReplay 回放页面打开即可完整还原现场。',
        );

        return lines.join('\n');
    }
}

