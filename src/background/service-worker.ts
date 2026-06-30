/**
 * src/background/service-worker.ts — Service Worker 主入口
 *
 * 负责：
 * 1. 接收 Popup / Content Script 的消息
 * 2. 管理 IndexedDB 中录制数据的增删改查
 * 3. 处理 .rrt 文件导出
 * 4. 第三方平台提交（预留）
 *
 * TODO M6: 实现完整的消息路由和存储逻辑
 */

import type {
    BackgroundToContentMessage,
    ContentToBackgroundMessage,
    RecordingSession,
} from '@shared/types';

import { EXTENSION_NAME } from '@shared/constants';
import browser from 'webextension-polyfill';
import { StorageManager } from './storage-manager';
import { downloadRRTFile } from './rrt-builder';

// ============================================================
// 初始化
// ============================================================

const storageManager = new StorageManager();

console.log(`[${EXTENSION_NAME}] Service Worker initialized`);

// ============================================================
// 消息路由
// ============================================================

browser.runtime.onMessage.addListener(
    (
        message: unknown,
        sender: browser.Runtime.MessageSender,
    ): Promise<BackgroundToContentMessage | void> | void => {
        return handleMessage(message as ContentToBackgroundMessage, sender);
    },
);

async function handleMessage(
    message: ContentToBackgroundMessage,
    sender: browser.Runtime.MessageSender,
): Promise<BackgroundToContentMessage> {
    const { action, payload, requestId } = message;
    console.log(`[${EXTENSION_NAME}] SW received: ${action}`, sender.tab?.id ? `from tab ${sender.tab.id}` : 'from popup');

    switch (action) {
        // ---- 录制控制 ----
        case 'START_RECORDING': {
            // 向当前活跃 tab 的 content script 发送开始指令
            try {
                const tabs = await browser.tabs.query({ active: true, currentWindow: true });
                const tabId = tabs[0]?.id;
                console.log(`[${EXTENSION_NAME}] SW: sending RECORDING_STARTED to tab ${tabId}`);

                if (tabId !== undefined) {
                    await browser.tabs.sendMessage(tabId, {
                        action: 'RECORDING_STARTED',
                    });
                    console.log(`[${EXTENSION_NAME}] SW: RECORDING_STARTED sent successfully`);
                } else {
                    console.warn(`[${EXTENSION_NAME}] SW: no active tab found`);
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`[${EXTENSION_NAME}] SW: failed to send RECORDING_STARTED:`, msg);
                return { action: 'ERROR', payload: `无法连接到页面: ${msg}`, requestId };
            }
            return { action: 'RECORDING_STARTED', requestId };
        }

        case 'STOP_RECORDING': {
            const session = payload as RecordingSession | undefined;
            if (session?.id) {
                // Content script 发来的完整会话数据 → 存储
                await storageManager.saveSession(session);
                console.log(`[${EXTENSION_NAME}] Session saved: ${session.id}`);
            } else {
                // Popup 发来的停止指令 → 转发给 content script
                try {
                    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
                    if (tabs[0]?.id !== undefined) {
                        await browser.tabs.sendMessage(tabs[0].id, {
                            action: 'RECORDING_STOPPED',
                        });
                    }
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err);
                    console.error(`[${EXTENSION_NAME}] SW: failed to send RECORDING_STOPPED:`, msg);
                }
            }
            return {
                action: 'RECORDING_STOPPED',
                payload: session?.id ? { sessionId: session.id } : undefined,
                requestId,
            };
        }

        case 'PAUSE_RECORDING': {
            try {
                const tabs = await browser.tabs.query({ active: true, currentWindow: true });
                if (tabs[0]?.id !== undefined) {
                    await browser.tabs.sendMessage(tabs[0].id, {
                        action: 'RECORDING_PAUSED',
                    });
                }
            } catch (err: unknown) {
                console.error(`[${EXTENSION_NAME}] SW: failed to send RECORDING_PAUSED:`, err);
            }
            return { action: 'RECORDING_PAUSED', requestId };
        }

        case 'RESUME_RECORDING': {
            try {
                const tabs = await browser.tabs.query({ active: true, currentWindow: true });
                if (tabs[0]?.id !== undefined) {
                    await browser.tabs.sendMessage(tabs[0].id, {
                        action: 'RECORDING_RESUMED',
                    });
                }
            } catch (err: unknown) {
                console.error(`[${EXTENSION_NAME}] SW: failed to send RECORDING_RESUMED:`, err);
            }
            return { action: 'RECORDING_RESUMED', requestId };
        }

        // ---- 会话管理 ----
        case 'GET_SESSIONS': {
            const sessions = await storageManager.getAllSessions();
            return {
                action: 'SESSIONS_LIST',
                payload: sessions,
                requestId,
            };
        }

        case 'DELETE_SESSION': {
            const { sessionId } = payload as { sessionId: string };
            await storageManager.deleteSession(sessionId);
            return {
                action: 'SESSION_DELETED',
                payload: { sessionId },
                requestId,
            };
        }

        case 'EXPORT_RRT': {
            const { sessionId } = payload as { sessionId: string };
            const session = await storageManager.getSession(sessionId);
            if (!session) {
                return { action: 'ERROR', payload: 'Session not found', requestId };
            }
            await downloadRRTFile(session);
            return { action: 'EXPORT_READY', payload: { sessionId }, requestId };
        }

        case 'SUBMIT_TO_PLATFORM': {
            // TODO M7: 第三方平台提交
            return { action: 'ERROR', payload: 'Not implemented yet', requestId };
        }

        default:
            return { action: 'ERROR', payload: `Unknown action: ${action}`, requestId };
    }
}

// ============================================================
// Extension 生命周期
// ============================================================

// Service Worker 安装
browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log(`[${EXTENSION_NAME}] Extension installed`);
    }
    else if (details.reason === 'update') {
        console.log(`[${EXTENSION_NAME}] Extension updated`);
    }
});
