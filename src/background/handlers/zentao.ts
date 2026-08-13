/**
 * src/background/handlers/zentao.ts — 禅道平台消息处理
 *
 * 处理产品 / 项目列表拉取，以及创建 Bug + 上传 .rrt 附件。
 */

import type { BackgroundToContentMessage } from '@shared/types';
import type { ZentaoConfig } from '../../platforms/zentao';
import { EXTENSION_NAME } from '@shared/constants';
import { BackgroundToContentAction } from '@shared/types';
import { ZentaoPlatform } from '../../platforms/zentao';
import { buildRRTPackage } from '../rrt-builder';
import { storageManager } from '../storage-manager';

export async function handleGetZentaoProducts(
    payload: unknown,
    requestId?: string
): Promise<BackgroundToContentMessage> {
    const config = payload as ZentaoConfig;
    try {
        const zentao = new ZentaoPlatform(config);
        const result = await zentao.getProducts();
        return {
            action: BackgroundToContentAction.ZENTAO_PRODUCTS,
            payload: result,
            requestId
        };
    }
    catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[BugReplay] GET_ZENTAO_PRODUCTS error:', msg);
        return {
            action: BackgroundToContentAction.ZENTAO_PRODUCTS,
            payload: { success: false, error: `获取产品列表异常: ${msg}` },
            requestId
        };
    }
}

export async function handleGetZentaoProjects(
    payload: unknown,
    requestId?: string
): Promise<BackgroundToContentMessage> {
    const config = payload as ZentaoConfig;
    try {
        const zentao = new ZentaoPlatform(config);
        const result = await zentao.getProjects();
        return {
            action: BackgroundToContentAction.ZENTAO_PROJECTS,
            payload: result,
            requestId
        };
    }
    catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[BugReplay] GET_ZENTAO_PROJECTS error:', msg);
        return {
            action: BackgroundToContentAction.ZENTAO_PROJECTS,
            payload: { success: false, error: `获取项目列表异常: ${msg}` },
            requestId
        };
    }
}

export async function handleSubmitToPlatform(
    payload: unknown,
    requestId?: string
): Promise<BackgroundToContentMessage> {
    const { sessionId, config } = payload as {
        sessionId: string;
        config: ZentaoConfig;
    };

    try {
        // 1. 从存储获取会话
        const session = await storageManager.getSession(sessionId);
        if (!session) {
            return {
                action: BackgroundToContentAction.ERROR,
                payload: '会话不存在',
                requestId
            };
        }

        // 2. 构建 .rrt 包
        const rrtPackage = await buildRRTPackage(session);

        // 3. 提交到禅道
        const zentao = new ZentaoPlatform(config);
        const result = await zentao.submitBug(rrtPackage);

        if (result.success) {
            // 回写关联的外部 Issue ID 和平台
            if (result.issueId) {
                session.externalIssueId = result.issueId;
                session.externalPlatform = 'zentao';
                await storageManager.saveSession(session);
            }

            return {
                action: BackgroundToContentAction.SESSION_UPDATED,
                payload: {
                    sessionId,
                    externalIssueId: result.issueId,
                    issueUrl: result.issueUrl,
                    warning: result.warning
                },
                requestId
            };
        }

        return {
            action: BackgroundToContentAction.ERROR,
            payload: result.error || '提交失败',
            requestId
        };
    }
    catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[${EXTENSION_NAME}] SUBMIT_TO_PLATFORM error:`, msg);
        return {
            action: BackgroundToContentAction.ERROR,
            payload: `提交异常: ${msg}`,
            requestId
        };
    }
}
