// ============================================================
// src/shared/messages.ts — 消息协议辅助工具
// ============================================================

import type {
    BackgroundToContentAction,
    BackgroundToContentMessage,
    ContentToBackgroundAction,
    ContentToBackgroundMessage,
} from './types';
import browser from 'webextension-polyfill';

/**
 * 生成唯一请求 ID
 */
export function generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 构造 Content Script → Service Worker 消息
 */
export function createContentMessage(
    action: ContentToBackgroundAction,
    payload?: unknown,
): ContentToBackgroundMessage {
    return {
        action,
        payload,
        requestId: generateRequestId(),
    };
}

/**
 * 构造 Service Worker → Content Script 消息
 */
export function createBackgroundMessage(
    action: BackgroundToContentAction,
    payload?: unknown,
    requestId?: string,
): BackgroundToContentMessage {
    return {
        action,
        payload,
        requestId,
    };
}

/**
 * 向 Service Worker 发送消息并等待响应
 */
export async function sendToBackground(
    action: ContentToBackgroundAction,
    payload?: unknown,
): Promise<BackgroundToContentMessage> {
    const message = createContentMessage(action, payload);
    return browser.runtime.sendMessage(message);
}

/**
 * 向当前活跃 Tab 的 Content Script 发送消息
 */
export async function sendToContentScript(
    tabId: number,
    action: BackgroundToContentAction,
    payload?: unknown,
): Promise<void> {
    const message = createBackgroundMessage(action, payload);
    await browser.tabs.sendMessage(tabId, message);
}
