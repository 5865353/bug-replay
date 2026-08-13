/**
 * src/background/webrequest-capture.ts — webRequest 头信息捕获
 *
 * 通过 chrome.webRequest 捕获完整请求/响应头（不受 CORS 限制），
 * 用于在录制停止时丰富 NetworkLog 列表。
 */

import type { NetworkLog } from '@shared/types';
import { recordingState } from './recording-state';

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
function initHeaderEntry(details: chrome.webRequest.OnBeforeSendHeadersDetails): WebRequestHeaderInfo {
    return {
        url: details.url,
        method: details.method,
        requestHeaders: {},
        responseHeaders: {},
        status: 0,
        statusText: '',
        startTime: details.timeStamp
    };
}

/** 注册 webRequest 监听（在 Service Worker 顶层调用一次） */
export function registerWebRequestCapture(): void {
    chrome.webRequest.onBeforeSendHeaders.addListener(
        (details): chrome.webRequest.BlockingResponse | undefined => {
            if (details.tabId < 0 || !recordingState.activeTabIds.has(details.tabId)) return;

            const entry = initHeaderEntry(details);
            if (details.requestHeaders) {
                for (const h of details.requestHeaders) {
                    entry.requestHeaders[h.name] = h.value || '';
                }
            }
            webRequestHeaders.set(details.requestId, entry);
        },
        { urls: ['<all_urls>'] },
        ['requestHeaders']
    );

    chrome.webRequest.onHeadersReceived.addListener(
        (details): chrome.webRequest.BlockingResponse | undefined => {
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
        ['responseHeaders']
    );
}

/** 用 webRequest 捕获的完整头信息丰富 NetworkLog 列表 */
export function enrichNetworkLogs(logs: NetworkLog[]): void {
    // 构建 URL+时间 → webRequest entry 的索引
    const wrEntries = [...webRequestHeaders.values()];

    for (const log of logs) {
        // 匹配：相同 URL，且 startTime 相差在 500ms 内
        const match = wrEntries.find(
            e => e.url === log.url && Math.abs(e.startTime - log.startTime) < 500
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

/** 清理积累的 webRequest 数据（新录制开始 / 会话停止时调用） */
export function clearWebRequestHeaders(): void {
    webRequestHeaders.clear();
}
