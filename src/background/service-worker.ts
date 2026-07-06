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

import type { JiraConfig } from '../platforms/jira';
import type { ZentaoConfig } from '../platforms/zentao';
import { EXTENSION_NAME } from '@shared/constants';
import browser from 'webextension-polyfill';
import { JiraPlatform } from '../platforms/jira';
import { ZentaoPlatform } from '../platforms/zentao';
import { buildRRTPackage, copyRRTToClipboard, downloadRRTFile } from './rrt-builder';
import { StorageManager } from './storage-manager';

// ============================================================
// 初始化
// ============================================================

const storageManager = new StorageManager();
let activeRecordingTabIds = new Set<number>();
let activeRecordingOrigin = '';
let activeSessionId = '';
let isPaused = false;

console.log(`[${EXTENSION_NAME}] Service Worker initialized`);

// ============================================================
// 跨标签页录制：监听新标签页
// ============================================================

browser.tabs.onCreated.addListener(async (tab) => {
    if (!isPaused && activeRecordingTabIds.size > 0 && tab.id !== undefined) {
        // 等待页面开始加载后检查 URL
        // onUpdated 会处理实际注入
    }
});

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // 只在正在录制且新页面加载完成时处理
    if (isPaused || activeRecordingTabIds.size === 0) return;
    if (tabId === undefined) return;

    // 跳过已记录的 tab
    if (activeRecordingTabIds.has(tabId)) return;

    // 只在页面开始加载时检查（status: 'loading'）
    if (changeInfo.status !== 'loading') return;

    const url = tab.url || changeInfo.url || '';
    if (!url) return;

    try {
        const targetOrigin = new URL(url).origin;
        if (targetOrigin === activeRecordingOrigin) {
            console.log(`[${EXTENSION_NAME}] 🔗 检测到同源新标签页: tab ${tabId}, ${url}`);
            activeRecordingTabIds.add(tabId);

            // 等页面完全加载后再注入
            setTimeout(async () => {
                try {
                    await sendMessageToTab(tabId, {
                        action: 'RECORDING_STARTED',
                        payload: { sessionId: activeSessionId },
                    });
                    console.log(`[${EXTENSION_NAME}] ✅ 跨标签页录制已启动: tab ${tabId}`);
                }
                catch (err) {
                    console.warn(`[${EXTENSION_NAME}] ⚠️ 无法注入新标签页:`, err);
                    activeRecordingTabIds.delete(tabId);
                }
            }, 1000);
        }
    }
    catch { /* invalid URL, skip */ }
});

// ============================================================
// 工具：确保 content script 已注入目标 tab
// ============================================================

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
async function sendMessageToTab(
    tabId: number,
    message: BackgroundToContentMessage,
): Promise<void> {
    // 检查 tab URL 是否允许注入
    try {
        const tab = await browser.tabs.get(tabId);
        const url = tab.url || '';

        const RESTRICTED_PREFIXES = [
            'chrome://',
            'chrome-extension://',
            'moz-extension://',
            'about:',
            'edge://',
            'brave://',
        ];

        for (const prefix of RESTRICTED_PREFIXES) {
            if (url.startsWith(prefix)) {
                throw new Error(
                    `当前页面 (${prefix}...) 不支持注入，请切换到普通网页后再试`,
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
                files: allFiles,
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
            try {
                const tabs = await browser.tabs.query({ active: true, currentWindow: true });
                const tabId = tabs[0]?.id;
                if (tabId === undefined) {
                    return { action: 'ERROR', payload: '未找到活跃页面', requestId };
                }

                // 记录录制源 origin（用于跨标签页检测）
                const url = tabs[0]?.url || '';
                try {
                    activeRecordingOrigin = new URL(url).origin;
                }
                catch {
                    activeRecordingOrigin = '';
                }

                // 生成 session ID（由第一个 tab 的 content script 创建）
                activeSessionId = '';

                console.log(`[${EXTENSION_NAME}] SW: sending RECORDING_STARTED to tab ${tabId}, origin=${activeRecordingOrigin}`);
                await sendMessageToTab(tabId, { action: 'RECORDING_STARTED' });
                activeRecordingTabIds = new Set([tabId]);
                isPaused = false;
                console.log(`[${EXTENSION_NAME}] SW: RECORDING_STARTED sent successfully`);
            }
            catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`[${EXTENSION_NAME}] SW: failed to send RECORDING_STARTED:`, msg);
                return { action: 'ERROR', payload: `无法连接到页面: ${msg}`, requestId };
            }
            return { action: 'RECORDING_STARTED', requestId };
        }

        case 'STOP_RECORDING': {
            const data = payload as RecordingSession | { sessionId: string } | undefined;

            if (data && 'sessionId' in data && !('events' in data)) {
                const key = `temp_session_${data.sessionId}`;
                const stored = await browser.storage.local.get(key);
                const session = stored[key] as RecordingSession | undefined;
                if (session) {
                    await storageManager.saveSession(session);
                    await browser.storage.local.remove(key);
                    activeRecordingTabIds.clear();
                    activeRecordingOrigin = '';
                    activeSessionId = '';
                    isPaused = false;
                    console.log(`[${EXTENSION_NAME}] Session saved: ${session.id}`);

                    browser.runtime.sendMessage({
                        action: 'RECORDING_STOPPED',
                        payload: { sessionId: session.id },
                    }).catch(() => {});
                }
            }
            else if (data && 'events' in data) {
                const session = data as RecordingSession;
                await storageManager.saveSession(session);
                activeRecordingTabIds.clear();
                activeRecordingOrigin = '';
                activeSessionId = '';
                isPaused = false;
                console.log(`[${EXTENSION_NAME}] Session saved: ${session.id}`);

                browser.runtime.sendMessage({
                    action: 'RECORDING_STOPPED',
                    payload: { sessionId: session.id },
                }).catch(() => {});
            }
            else {
                // Popup 发来的停止指令 → 广播给所有录制中的 tab
                const tabIds = [...activeRecordingTabIds];
                for (const tid of tabIds) {
                    try {
                        await sendMessageToTab(tid, { action: 'RECORDING_STOPPED' });
                    }
                    catch { /* tab may be closed */ }
                }
            }
            return { action: 'RECORDING_STOPPED', requestId };
        }

        case 'PAUSE_RECORDING': {
            isPaused = true;
            for (const tid of activeRecordingTabIds) {
                try {
                    await sendMessageToTab(tid, { action: 'RECORDING_PAUSED' });
                }
                catch { /* */ }
            }
            return { action: 'RECORDING_PAUSED', requestId };
        }

        case 'RESUME_RECORDING': {
            isPaused = false;
            for (const tid of activeRecordingTabIds) {
                try {
                    await sendMessageToTab(tid, { action: 'RECORDING_RESUMED' });
                }
                catch { /* */ }
            }
            return { action: 'RECORDING_RESUMED', requestId };
        }

        case 'GET_RECORDING_STATUS': {
            return {
                action: 'RECORDING_STATUS',
                payload: { isRecording: activeRecordingTabIds.size > 0, isPaused },
                requestId,
            };
        }

        // ---- 会话管理 ----
        case 'GET_SESSIONS': {
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
            }));
            return {
                action: 'SESSIONS_LIST',
                payload: summaries,
                requestId,
            };
        }

        case 'GET_SESSION': {
            const { sessionId } = payload as { sessionId: string };
            const session = await storageManager.getSession(sessionId);
            if (!session) {
                return { action: 'ERROR', payload: 'Session not found', requestId };
            }
            return {
                action: 'SESSION_DATA',
                payload: session,
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
            const { sessionId, clipboard } = payload as { sessionId: string; clipboard?: boolean };
            const session = await storageManager.getSession(sessionId);
            if (!session) {
                return { action: 'ERROR', payload: 'Session not found', requestId };
            }
            if (clipboard) {
                await copyRRTToClipboard(session);
            }
            else {
                await downloadRRTFile(session);
            }
            return { action: 'EXPORT_READY', payload: { sessionId }, requestId };
        }

        case 'SUBMIT_TO_PLATFORM': {
            const { sessionId, platform, config } = payload as {
                sessionId: string;
                platform: 'jira' | 'zentao';
                config: JiraConfig | ZentaoConfig;
            };

            try {
                // 1. 从存储获取会话
                const session = await storageManager.getSession(sessionId);
                if (!session) {
                    return {
                        action: 'ERROR',
                        payload: '会话不存在',
                        requestId,
                    };
                }

                // 2. 构建 .rrt 包
                const rrtPackage = buildRRTPackage(session);

                // 3. 根据平台提交
                let result;

                if (platform === 'jira') {
                    const jira = new JiraPlatform(config as JiraConfig);
                    result = await jira.submitBug(rrtPackage);
                }
                else {
                    const zentao = new ZentaoPlatform(config as ZentaoConfig);
                    result = await zentao.submitBug(rrtPackage);
                }

                if (result.success) {
                    // 回写关联的外部 Issue ID 和平台
                    if (result.issueId) {
                        session.externalIssueId = result.issueId;
                        session.externalPlatform = platform;
                        await storageManager.saveSession(session);
                    }

                    return {
                        action: 'SESSION_UPDATED',
                        payload: {
                            sessionId,
                            externalIssueId: result.issueId,
                            issueUrl: result.issueUrl,
                        },
                        requestId,
                    };
                }

                return {
                    action: 'ERROR',
                    payload: result.error || '提交失败',
                    requestId,
                };
            }
            catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`[${EXTENSION_NAME}] SUBMIT_TO_PLATFORM error:`, msg);
                return {
                    action: 'ERROR',
                    payload: `提交异常: ${msg}`,
                    requestId,
                };
            }
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
