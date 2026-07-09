/**
 * src/background/service-worker.ts — Service Worker 主入口
 *
 * 负责：
 * 1. 接收 Popup / Content Script 的消息
 * 2. 管理 IndexedDB 中录制数据的增删改查
 * 3. 处理 .rrt 文件导出
 * 4. 第三方平台提交（预留）
 *
 * TODO: 后续考虑按需清理过期会话、导出历史管理
 */

import type { BackgroundToContentMessage, ContentToBackgroundMessage, NetworkLog, RecordingSession } from '@shared/types';

import type { JiraConfig } from '../platforms/jira';
import type { ZentaoConfig } from '../platforms/zentao';
import { EXTENSION_NAME } from '@shared/constants';
import {
    BackgroundToContentAction,

    ContentToBackgroundAction,

} from '@shared/types';
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

const STORAGE_KEY_SETTINGS = 'bugreplay_settings';

/** 读取录制相关配置 */
async function getRecordingSettings(): Promise<{
    maskInputs: boolean;
    mouseSample: number;
    scrollSample: number;
    maxDuration: number;
}> {
    try {
        const stored = await browser.storage.local.get(STORAGE_KEY_SETTINGS);
        const s = stored[STORAGE_KEY_SETTINGS] as Record<string, unknown> | undefined;
        return {
            maskInputs: (s?.maskInputs as boolean) ?? true,
            mouseSample: (s?.mouseSample as number) ?? 50,
            scrollSample: (s?.scrollSample as number) ?? 150,
            maxDuration: (s?.maxDuration as number) ?? 30,
        };
    }
    catch {
        return { maskInputs: true, mouseSample: 50, scrollSample: 150, maxDuration: 30 };
    }
}

console.log(`[${EXTENSION_NAME}] Service Worker initialized`);

// ============================================================
// webRequest 拦截 — 捕获完整请求/响应头（不受 CORS 限制）
// ============================================================

interface WebRequestHeaderInfo {
    url: string;
    method: string;
    requestHeaders: Record<string, string>;
    responseHeaders: Record<string, string>;
    status: number;
    statusText: string;
    startTime: number;
}

/** requestId → 头信息 */
const webRequestHeaders = new Map<string, WebRequestHeaderInfo>();

/** 初始化空的头信息条目 */
function initHeaderEntry(details: chrome.webRequest.WebRequestHeadersDetails): WebRequestHeaderInfo {
    return {
        url: details.url,
        method: details.method,
        requestHeaders: {},
        responseHeaders: {},
        status: 0,
        statusText: '',
        startTime: details.timeStamp,
    };
}

chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        if (details.tabId < 0 || !activeRecordingTabIds.has(details.tabId)) return;

        const entry = initHeaderEntry(details);
        if (details.requestHeaders) {
            for (const h of details.requestHeaders) {
                entry.requestHeaders[h.name] = h.value || '';
            }
        }
        webRequestHeaders.set(details.requestId, entry);
    },
    { urls: ['<all_urls>'] },
    ['requestHeaders'],
);

chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
        const entry = webRequestHeaders.get(details.requestId);
        if (!entry) return;

        if (details.responseHeaders) {
            for (const h of details.responseHeaders) {
                entry.responseHeaders[h.name] = h.value || '';
            }
        }
        entry.status = details.statusCode;
        entry.statusText = details.statusLine || '';
    },
    { urls: ['<all_urls>'] },
    ['responseHeaders'],
);

/** 用 webRequest 捕获的完整头信息丰富 NetworkLog 列表 */
function enrichNetworkLogs(logs: NetworkLog[]): void {
    // 构建 URL+时间 → webRequest entry 的索引
    const wrEntries = [...webRequestHeaders.values()];

    for (const log of logs) {
        // 匹配：相同 URL，且 startTime 相差在 500ms 内
        const match = wrEntries.find(
            e => e.url === log.url && Math.abs(e.startTime - log.startTime) < 500,
        );
        if (match) {
            // 合并请求头（webRequest 的优先，因为它更完整）
            log.requestHeaders = { ...log.requestHeaders, ...match.requestHeaders };
            // 响应头：直接用 webRequest 的（跨域也能拿到完整头）
            log.responseHeaders = match.responseHeaders;
            // 状态码/文本也用 webRequest 的（更准确）
            if (match.status > 0) {
                log.status = match.status;
                log.statusText = match.statusText;
            }
        }
    }
}

/** 清理指定 session 期间积累的 webRequest 数据 */
function clearWebRequestHeaders(): void {
    webRequestHeaders.clear();
}

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
                        action: BackgroundToContentAction.RECORDING_STARTED,
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
        case ContentToBackgroundAction.START_RECORDING: {
            try {
                const tabs = await browser.tabs.query({ active: true, currentWindow: true });
                const tabId = tabs[0]?.id;
                if (tabId === undefined) {
                    return { action: BackgroundToContentAction.ERROR, payload: '未找到活跃页面', requestId };
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
                const recSettings = await getRecordingSettings();
                await sendMessageToTab(tabId, {
                    action: BackgroundToContentAction.RECORDING_STARTED,
                    payload: recSettings,
                });
                activeRecordingTabIds = new Set([tabId]);
                isPaused = false;
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

        case ContentToBackgroundAction.STOP_RECORDING: {
            const data = payload as RecordingSession | { sessionId: string } | undefined;

            if (data && 'sessionId' in data && !('events' in data)) {
                const sessionId = data.sessionId;
                const metaKey = `temp_session_${sessionId}`;
                const stored = await browser.storage.local.get(metaKey);
                const metadata = stored[metaKey] as (RecordingSession & { chunkCount?: number }) | undefined;

                if (metadata) {
                    // 🔧 合并所有 chunk 数据
                    const chunkCount: number = metadata.chunkCount ?? 0;
                    const mergedSession: RecordingSession = {
                        ...metadata,
                        events: [],
                        networkLogs: [],
                        consoleLogs: [],
                        pageEvents: [],
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
                        + `console=${mergedSession.consoleLogs.length}`,
                    );

                    // 🔧 用 webRequest 捕获的完整头信息丰富 NetworkLog
                    enrichNetworkLogs(mergedSession.networkLogs);
                    clearWebRequestHeaders();

                    await storageManager.saveSession(mergedSession);
                    await browser.storage.local.remove(keysToRemove);

                    activeRecordingTabIds.clear();
                    activeRecordingOrigin = '';
                    activeSessionId = '';
                    isPaused = false;
                    console.log(`[${EXTENSION_NAME}] Session saved: ${mergedSession.id}`);

                    browser.runtime.sendMessage({
                        action: BackgroundToContentAction.RECORDING_STOPPED,
                        payload: { sessionId: mergedSession.id },
                    }).catch(() => {});
                }
            }
            else if (data && 'events' in data) {
                const session = data as RecordingSession;
                // 🔧 用 webRequest 捕获的完整头信息丰富 NetworkLog
                enrichNetworkLogs(session.networkLogs);
                clearWebRequestHeaders();

                await storageManager.saveSession(session);
                activeRecordingTabIds.clear();
                activeRecordingOrigin = '';
                activeSessionId = '';
                isPaused = false;
                console.log(`[${EXTENSION_NAME}] Session saved: ${session.id}`);

                browser.runtime.sendMessage({
                    action: BackgroundToContentAction.RECORDING_STOPPED,
                    payload: { sessionId: session.id },
                }).catch(() => {});
            }
            else {
                // Popup 发来的停止指令 → 广播给所有录制中的 tab
                const tabIds = [...activeRecordingTabIds];
                for (const tid of tabIds) {
                    try {
                        await sendMessageToTab(tid, { action: BackgroundToContentAction.RECORDING_STOPPED });
                    }
                    catch { /* tab may be closed */ }
                }
            }
            return { action: BackgroundToContentAction.RECORDING_STOPPED, requestId };
        }

        case ContentToBackgroundAction.PAUSE_RECORDING: {
            isPaused = true;
            for (const tid of activeRecordingTabIds) {
                try {
                    await sendMessageToTab(tid, { action: BackgroundToContentAction.RECORDING_PAUSED });
                }
                catch { /* */ }
            }
            return { action: BackgroundToContentAction.RECORDING_PAUSED, requestId };
        }

        case ContentToBackgroundAction.RESUME_RECORDING: {
            isPaused = false;
            for (const tid of activeRecordingTabIds) {
                try {
                    await sendMessageToTab(tid, { action: BackgroundToContentAction.RECORDING_RESUMED });
                }
                catch { /* */ }
            }
            return { action: BackgroundToContentAction.RECORDING_RESUMED, requestId };
        }

        case ContentToBackgroundAction.GET_RECORDING_STATUS: {
            return {
                action: BackgroundToContentAction.RECORDING_STATUS,
                payload: { isRecording: activeRecordingTabIds.size > 0, isPaused },
                requestId,
            };
        }

        // ---- 会话管理 ----
        case ContentToBackgroundAction.GET_SESSIONS: {
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
                consoleLogCount: s.consoleLogs.length,
            }));
            return {
                action: BackgroundToContentAction.SESSIONS_LIST,
                payload: summaries,
                requestId,
            };
        }

        case ContentToBackgroundAction.GET_SESSION: {
            const { sessionId } = payload as { sessionId: string };
            const session = await storageManager.getSession(sessionId);
            if (!session) {
                return { action: BackgroundToContentAction.ERROR, payload: 'Session not found', requestId };
            }
            return {
                action: BackgroundToContentAction.SESSION_DATA,
                payload: session,
                requestId,
            };
        }

        case ContentToBackgroundAction.DELETE_SESSION: {
            const { sessionId } = payload as { sessionId: string };
            await storageManager.deleteSession(sessionId);
            return {
                action: BackgroundToContentAction.SESSION_DELETED,
                payload: { sessionId },
                requestId,
            };
        }

        case ContentToBackgroundAction.DELETE_ALL_SESSIONS: {
            await storageManager.clearAll();
            return {
                action: BackgroundToContentAction.SESSIONS_CLEARED,
                requestId,
            };
        }

        case ContentToBackgroundAction.UPDATE_SESSION_META: {
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
                requestId,
            };
        }

        case ContentToBackgroundAction.EXPORT_RRT: {
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

        case ContentToBackgroundAction.SUBMIT_TO_PLATFORM: {
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
                        action: BackgroundToContentAction.ERROR,
                        payload: '会话不存在',
                        requestId,
                    };
                }

                // 2. 构建 .rrt 包
                const rrtPackage = await buildRRTPackage(session);

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
                        action: BackgroundToContentAction.SESSION_UPDATED,
                        payload: {
                            sessionId,
                            externalIssueId: result.issueId,
                            issueUrl: result.issueUrl,
                        },
                        requestId,
                    };
                }

                return {
                    action: BackgroundToContentAction.ERROR,
                    payload: result.error || '提交失败',
                    requestId,
                };
            }
            catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`[${EXTENSION_NAME}] SUBMIT_TO_PLATFORM error:`, msg);
                return {
                    action: BackgroundToContentAction.ERROR,
                    payload: `提交异常: ${msg}`,
                    requestId,
                };
            }
        }

        default:
            return { action: BackgroundToContentAction.ERROR, payload: `Unknown action: ${action}`, requestId };
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
