/**
 * src/background/handlers/recording.ts — 录制控制消息处理
 *
 * 处理开始 / 停止 / 暂停 / 恢复 / 查询状态，停止时负责 chunk 合并与落库。
 */

import type { BackgroundToContentMessage, RecordingSession } from '@shared/types';
import { EXTENSION_NAME } from '@shared/constants';
import { BackgroundToContentAction } from '@shared/types';
import browser from 'webextension-polyfill';
import {
    broadcastToRecordingTabs,
    getRecordingSettings,
    recordingState
} from '../recording-state';
import { storageManager } from '../storage-manager';
import { sendMessageToTab } from '../tab-messaging';
import { clearWebRequestHeaders, enrichNetworkLogs } from '../webrequest-capture';

// ============================================================
// 开始录制
// ============================================================

export async function handleStartRecording(
    _payload: unknown,
    requestId?: string
): Promise<BackgroundToContentMessage> {
    try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0]?.id;
        if (tabId === undefined) {
            return { action: BackgroundToContentAction.ERROR, payload: '未找到活跃页面', requestId };
        }

        // 记录录制源 origin（用于跨标签页检测）
        const url = tabs[0]?.url || '';
        try {
            recordingState.activeOrigin = new URL(url).origin;
        }
        catch {
            recordingState.activeOrigin = '';
        }

        // 生成 session ID（由第一个 tab 的 content script 创建）
        recordingState.activeSessionId = '';

        console.log(`[${EXTENSION_NAME}] SW: sending RECORDING_STARTED to tab ${tabId}, origin=${recordingState.activeOrigin}`);
        const recSettings = await getRecordingSettings();
        await sendMessageToTab(tabId, {
            action: BackgroundToContentAction.RECORDING_STARTED,
            payload: recSettings
        });
        recordingState.activeTabIds = new Set([tabId]);
        recordingState.isPaused = false;
        // 🔧 新录制开始，清空上次可能残留的 webRequest 数据
        clearWebRequestHeaders();
        console.log(`[${EXTENSION_NAME}] SW: RECORDING_STARTED sent successfully`);
    }
    catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[${EXTENSION_NAME}] SW: failed to send RECORDING_STARTED:`, msg);
        return { action: BackgroundToContentAction.ERROR, payload: `无法连接到页面: ${msg}`, requestId };
    }
    return { action: BackgroundToContentAction.RECORDING_STARTED, requestId };
}

// ============================================================
// 停止录制
// ============================================================

export async function handleStopRecording(
    payload: unknown,
    requestId?: string
): Promise<BackgroundToContentMessage> {
    const data = payload as RecordingSession | { sessionId: string } | undefined;

    if (data && 'sessionId' in data && !('events' in data)) {
        // Content Script 分片上报 → 合并所有 chunk 后保存
        await stopChunkedSession(data.sessionId);
    }
    else if (data && 'events' in data) {
        // Content Script 一次性上报完整会话
        await saveStoppedSession(data as RecordingSession);
    }
    else {
        // Popup 发来的停止指令 → 广播给所有录制中的 tab
        await broadcastToRecordingTabs({ action: BackgroundToContentAction.RECORDING_STOPPED });
    }
    return { action: BackgroundToContentAction.RECORDING_STOPPED, requestId };
}

/** 合并分片上报的会话并保存 */
async function stopChunkedSession(sessionId: string): Promise<void> {
    const metaKey = `temp_session_${sessionId}`;
    const stored = await browser.storage.local.get(metaKey);
    const metadata = stored[metaKey] as (RecordingSession & { chunkCount?: number }) | undefined;

    if (!metadata) return;

    // 🔧 合并所有 chunk 数据
    const chunkCount: number = metadata.chunkCount ?? 0;
    const mergedSession: RecordingSession = {
        ...metadata,
        events: [],
        networkLogs: [],
        consoleLogs: [],
        pageEvents: []
    };

    // 收集所有要清理的 key
    const keysToRemove: string[] = [metaKey];

    for (let i = 0; i < chunkCount; i++) {
        const chunkKey = `temp_session_chunk_${sessionId}_${i}`;
        keysToRemove.push(chunkKey);
        const chunkStored = await browser.storage.local.get(chunkKey);
        const chunk = chunkStored[chunkKey] as {
            events?: typeof mergedSession.events;
            networkLogs?: typeof mergedSession.networkLogs;
            consoleLogs?: typeof mergedSession.consoleLogs;
            pageEvents?: typeof mergedSession.pageEvents;
        } | undefined;

        if (chunk) {
            if (chunk.events) mergedSession.events.push(...chunk.events);
            if (chunk.networkLogs) mergedSession.networkLogs.push(...chunk.networkLogs);
            if (chunk.consoleLogs) mergedSession.consoleLogs.push(...chunk.consoleLogs);
            if (chunk.pageEvents) mergedSession.pageEvents.push(...chunk.pageEvents);
        }
    }

    console.log(
        `[${EXTENSION_NAME}] Merged ${chunkCount} chunks: `
        + `events=${mergedSession.events.length} `
        + `network=${mergedSession.networkLogs.length} `
        + `console=${mergedSession.consoleLogs.length}`
    );

    await saveStoppedSession(mergedSession);
    await browser.storage.local.remove(keysToRemove);
}

/** 保存停止录制的会话：丰富网络头 → 落库 → 重置状态 → 通知 Popup */
async function saveStoppedSession(session: RecordingSession): Promise<void> {
    // 🔧 用 webRequest 捕获的完整头信息丰富 NetworkLog
    enrichNetworkLogs(session.networkLogs);
    clearWebRequestHeaders();

    await storageManager.saveSession(session);
    recordingState.reset();
    console.log(`[${EXTENSION_NAME}] Session saved: ${session.id}`);

    browser.runtime.sendMessage({
        action: BackgroundToContentAction.RECORDING_STOPPED,
        payload: { sessionId: session.id }
    }).catch(() => {});
}

// ============================================================
// 暂停 / 恢复 / 状态查询
// ============================================================

export async function handlePauseRecording(
    _payload: unknown,
    requestId?: string
): Promise<BackgroundToContentMessage> {
    recordingState.isPaused = true;
    await broadcastToRecordingTabs({ action: BackgroundToContentAction.RECORDING_PAUSED });
    return { action: BackgroundToContentAction.RECORDING_PAUSED, requestId };
}

export async function handleResumeRecording(
    _payload: unknown,
    requestId?: string
): Promise<BackgroundToContentMessage> {
    recordingState.isPaused = false;
    await broadcastToRecordingTabs({ action: BackgroundToContentAction.RECORDING_RESUMED });
    return { action: BackgroundToContentAction.RECORDING_RESUMED, requestId };
}

export async function handleGetRecordingStatus(
    _payload: unknown,
    requestId?: string
): Promise<BackgroundToContentMessage> {
    return {
        action: BackgroundToContentAction.RECORDING_STATUS,
        payload: { isRecording: recordingState.isRecording, isPaused: recordingState.isPaused },
        requestId
    };
}
