/**
 * src/background/recording-state.ts — 录制状态管理
 *
 * 维护全局录制状态（活跃 tab、来源 origin、会话 ID、暂停标记），
 * 提供设置读取与录制中 tab 广播，并负责跨标签页录制监听。
 */

import type { BackgroundToContentMessage } from '@shared/types';
import { EXTENSION_NAME } from '@shared/constants';
import { BackgroundToContentAction } from '@shared/types';
import browser from 'webextension-polyfill';
import { sendMessageToTab } from './tab-messaging';

const STORAGE_KEY_SETTINGS = 'bugreplay_settings';

/** 录制相关配置 */
export interface RecordingSettings {
    maskInputs: boolean;
    mouseSample: number;
    scrollSample: number;
    maxDuration: number;
}

/** 读取录制相关配置 */
export async function getRecordingSettings(): Promise<RecordingSettings> {
    try {
        const stored = await browser.storage.local.get(STORAGE_KEY_SETTINGS);
        const s = stored[STORAGE_KEY_SETTINGS] as Record<string, unknown> | undefined;
        return {
            maskInputs: (s?.maskInputs as boolean) ?? true,
            mouseSample: (s?.mouseSample as number) ?? 50,
            scrollSample: (s?.scrollSample as number) ?? 150,
            maxDuration: (s?.maxDuration as number) ?? 30
        };
    }
    catch {
        return { maskInputs: true, mouseSample: 50, scrollSample: 150, maxDuration: 30 };
    }
}

/** 录制全局状态（各 handler 共享的单例） */
class RecordingState {
    /** 当前正在录制的 tab id 集合 */
    activeTabIds = new Set<number>();
    /** 录制源页面 origin（用于跨标签页同源检测） */
    activeOrigin = '';
    /** 当前录制会话 id（由 content script 创建） */
    activeSessionId = '';
    /** 是否暂停中 */
    isPaused = false;

    /** 是否正在录制 */
    get isRecording(): boolean {
        return this.activeTabIds.size > 0;
    }

    /** 重置录制状态 */
    reset(): void {
        this.activeTabIds.clear();
        this.activeOrigin = '';
        this.activeSessionId = '';
        this.isPaused = false;
    }
}

export const recordingState = new RecordingState();

/** 向所有录制中的 tab 广播消息 */
export async function broadcastToRecordingTabs(
    message: BackgroundToContentMessage
): Promise<void> {
    for (const tabId of recordingState.activeTabIds) {
        try {
            await sendMessageToTab(tabId, message);
        }
        catch { /* tab may be closed */ }
    }
}

// ============================================================
// 跨标签页录制：监听新标签页
// ============================================================

/** 注册跨标签页录制监听（在 Service Worker 顶层调用一次） */
export function registerCrossTabRecording(): void {
    browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
        // 只在正在录制且新页面加载完成时处理
        if (recordingState.isPaused || recordingState.activeTabIds.size === 0) return;
        if (tabId === undefined) return;

        // 跳过已记录的 tab
        if (recordingState.activeTabIds.has(tabId)) return;

        // 只在页面开始加载时检查（status: 'loading'）
        if (changeInfo.status !== 'loading') return;

        const url = tab.url || changeInfo.url || '';
        if (!url) return;

        try {
            const targetOrigin = new URL(url).origin;
            if (targetOrigin === recordingState.activeOrigin) {
                console.log(`[${EXTENSION_NAME}] 🔗 检测到同源新标签页: tab ${tabId}, ${url}`);
                recordingState.activeTabIds.add(tabId);

                // 等页面完全加载后再注入
                setTimeout(async () => {
                    try {
                        await sendMessageToTab(tabId, {
                            action: BackgroundToContentAction.RECORDING_STARTED,
                            payload: { sessionId: recordingState.activeSessionId }
                        });
                        console.log(`[${EXTENSION_NAME}] ✅ 跨标签页录制已启动: tab ${tabId}`);
                    }
                    catch (err) {
                        console.warn(`[${EXTENSION_NAME}] ⚠️ 无法注入新标签页:`, err);
                        recordingState.activeTabIds.delete(tabId);
                    }
                }, 1000);
            }
        }
        catch { /* invalid URL, skip */ }
    });
}
