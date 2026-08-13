/**
 * src/background/handlers/sessions.ts — 会话管理消息处理
 *
 * 处理会话列表 / 详情 / 删除 / 清空 / 元数据更新 / .rrt 导出。
 */

import type { BackgroundToContentMessage } from '@shared/types';
import { BackgroundToContentAction } from '@shared/types';
import { copyRRTToClipboard, downloadRRTFile } from '../rrt-builder';
import { storageManager } from '../storage-manager';

export async function handleGetSessions(
    _payload: unknown,
    requestId?: string
): Promise<BackgroundToContentMessage> {
    const sessions = await storageManager.getAllSessions();
    // 只返回摘要，不返回 events/networkLogs/consoleLogs 等大字段
    const summaries = sessions.map(s => ({
        id: s.id,
        title: s.title,
        startTime: s.startTime,
        endTime: s.endTime,
        duration: s.endTime ? s.endTime - s.startTime : 0,
        tags: s.tags,
        hasAnnotations: s.annotations.length > 0,
        networkLogCount: s.networkLogs.length,
        consoleLogCount: s.consoleLogs.length
    }));
    return {
        action: BackgroundToContentAction.SESSIONS_LIST,
        payload: summaries,
        requestId
    };
}

export async function handleGetSession(
    payload: unknown,
    requestId?: string
): Promise<BackgroundToContentMessage> {
    const { sessionId } = payload as { sessionId: string };
    const session = await storageManager.getSession(sessionId);
    if (!session) {
        return { action: BackgroundToContentAction.ERROR, payload: 'Session not found', requestId };
    }
    return {
        action: BackgroundToContentAction.SESSION_DATA,
        payload: session,
        requestId
    };
}

export async function handleDeleteSession(
    payload: unknown,
    requestId?: string
): Promise<BackgroundToContentMessage> {
    const { sessionId } = payload as { sessionId: string };
    await storageManager.deleteSession(sessionId);
    return {
        action: BackgroundToContentAction.SESSION_DELETED,
        payload: { sessionId },
        requestId
    };
}

export async function handleDeleteAllSessions(
    _payload: unknown,
    requestId?: string
): Promise<BackgroundToContentMessage> {
    await storageManager.clearAll();
    return {
        action: BackgroundToContentAction.SESSIONS_CLEARED,
        requestId
    };
}

export async function handleUpdateSessionMeta(
    payload: unknown,
    requestId?: string
): Promise<BackgroundToContentMessage> {
    const { sessionId, updates } = payload as {
        sessionId: string;
        updates: { title?: string; tags?: string[]; description?: string };
    };
    const session = await storageManager.getSession(sessionId);
    if (!session) {
        return { action: BackgroundToContentAction.ERROR, payload: 'Session not found', requestId };
    }
    if (updates.title !== undefined) session.title = updates.title;
    if (updates.tags !== undefined) session.tags = updates.tags;
    if (updates.description !== undefined) session.description = updates.description;
    await storageManager.saveSession(session);
    return {
        action: BackgroundToContentAction.SESSION_UPDATED,
        payload: { sessionId, updates },
        requestId
    };
}

export async function handleExportRRT(
    payload: unknown,
    requestId?: string
): Promise<BackgroundToContentMessage> {
    const { sessionId, clipboard } = payload as { sessionId: string; clipboard?: boolean };
    const session = await storageManager.getSession(sessionId);
    if (!session) {
        return { action: BackgroundToContentAction.ERROR, payload: 'Session not found', requestId };
    }
    if (clipboard) {
        await copyRRTToClipboard(session);
    }
    else {
        await downloadRRTFile(session);
    }
    return { action: BackgroundToContentAction.EXPORT_READY, payload: { sessionId }, requestId };
}
