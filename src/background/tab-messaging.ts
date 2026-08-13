/**
 * src/background/tab-messaging.ts — 向目标 tab 发送消息
 *
 * 处理 content script 未加载的情况：检查受限页面 → 动态注入 → 递增重试。
 */

import type { BackgroundToContentMessage } from '@shared/types';
import { EXTENSION_NAME } from '@shared/constants';
import browser from 'webextension-polyfill';

const RESTRICTED_PREFIXES = [
    'chrome://',
    'chrome-extension://',
    'moz-extension://',
    'about:',
    'edge://',
    'brave://'
];

/**
 * 向指定 tab 发送消息（带重试）。
 *
 * 在 dev server 模式下，content script 通过异步 import() 动态加载，
 * 需要一定时间才能注册 message listener。此函数会：
 * 1. 先尝试直接发送
 * 2. 失败则检查 URL（过滤受限页面）
 * 3. 尝试动态注入 content script
 * 4. 最多重试 10 次，每次延迟递增，等待 content script 初始化
 */
export async function sendMessageToTab(
    tabId: number,
    message: BackgroundToContentMessage
): Promise<void> {
    // 检查 tab URL 是否允许注入
    try {
        const tab = await browser.tabs.get(tabId);
        const url = tab.url || '';

        for (const prefix of RESTRICTED_PREFIXES) {
            if (url.startsWith(prefix)) {
                throw new Error(
                    `当前页面 (${prefix}...) 不支持注入，请切换到普通网页后再试`
                );
            }
        }
    }
    catch (err) {
        if (err instanceof Error && err.message.includes('不支持注入')) throw err;
        throw new Error('无法访问目标页面，请确保页面已加载');
    }

    // 先尝试直接发送（大多数情况下已加载）
    try {
        await browser.tabs.sendMessage(tabId, message);
        return;
    }
    catch { /* 未加载，继续 */ }

    // 尝试动态注入 content script
    console.log(`[${EXTENSION_NAME}] Tab ${tabId}: content script 未响应，尝试注入...`);

    const manifest = browser.runtime.getManifest();
    const contentScripts = manifest.content_scripts;
    const allFiles: string[] = [];
    if (contentScripts) {
        for (const cs of contentScripts) {
            if (cs.js) allFiles.push(...cs.js);
        }
    }

    if (allFiles.length > 0) {
        try {
            await browser.scripting.executeScript({
                target: { tabId },
                files: allFiles
            });
            console.log(`[${EXTENSION_NAME}] Content script 注入完成`);
        }
        catch (injectErr: unknown) {
            const msg = injectErr instanceof Error ? injectErr.message : String(injectErr);
            console.warn(`[${EXTENSION_NAME}] 注入失败 (可能已存在):`, msg);
            // 注入失败也可能是已经注入过了，继续重试
        }
    }

    // 重试发送（dev server 模式下异步 import 需要时间）
    for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 150 + i * 100));

        try {
            await browser.tabs.sendMessage(tabId, message);
            console.log(`[${EXTENSION_NAME}] 消息发送成功 (重试 ${i + 1} 次)`);
            return;
        }
        catch {
            // 继续重试
        }
    }

    throw new Error('Content script 无响应，请刷新页面后重试');
}
