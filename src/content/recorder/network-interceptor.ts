/**
 * src/content/recorder/network-interceptor.ts
 *
 * 网络请求拦截器 — 基于 @mswjs/interceptors
 * 在 content script 注入时（document_start）立即启动拦截，
 * 所有日志缓冲到内存，录制开始时刷入 session。
 */

import type { HttpMethod, NetworkLog } from '@shared/types';
import { MAX_RESPONSE_BODY_SIZE } from '@shared/types';
import { generateUUID } from '@shared/utils';
import { BatchInterceptor } from '@mswjs/interceptors';
import { FetchInterceptor } from '@mswjs/interceptors/fetch';
import { XMLHttpRequestInterceptor } from '@mswjs/interceptors/XMLHttpRequest';

// ---- 工具函数 ----

const SENSITIVE_HEADER_KEYS = new Set([
    'authorization', 'cookie', 'set-cookie', 'x-api-key',
    'x-auth-token', 'proxy-authorization', 'x-csrf-token',
]);

function filterHeaders(headers: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
        result[key] = SENSITIVE_HEADER_KEYS.has(key.toLowerCase()) ? '[FILTERED]' : value;
    }
    return result;
}

function headersToRecord(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => { result[key] = value; });
    return result;
}

async function readBody(
    body: ReadableStream<Uint8Array> | null | undefined,
    maxSize: number,
): Promise<string | null> {
    if (!body) return null;
    try {
        const reader = body.getReader();
        let total = 0;
        const chunks: Uint8Array[] = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.length;
            chunks.push(value);
            if (total >= maxSize) break;
        }
        const merged = new Uint8Array(Math.min(total, maxSize));
        let offset = 0;
        for (const chunk of chunks) {
            const copy = Math.min(chunk.length, maxSize - offset);
            merged.set(chunk.subarray(0, copy), offset);
            offset += copy;
            if (offset >= maxSize) break;
        }
        const text = new TextDecoder().decode(merged);
        return total > maxSize ? `${text}\n... [TRUNCATED]` : text;
    }
    catch {
        return null;
    }
}

// ---- 待处理请求 ----

interface PendingEntry {
    id: string;
    method: HttpMethod;
    url: string;
    requestHeaders: Record<string, string>;
    requestBody: string | null;
    startTime: number;
}

// ---- 主类 ----

export interface NetworkInterceptorOptions {
    onLog: (log: NetworkLog) => void;
}

export class NetworkInterceptor {
    private interceptor: BatchInterceptor<
        [XMLHttpRequestInterceptor, FetchInterceptor]
    > | null = null;

    private pending = new Map<string, PendingEntry>();
    private onLog: (log: NetworkLog) => void;
    private started = false;

    // 录制开始前的缓冲
    private buffer: NetworkLog[] = [];
    private buffering = true;

    constructor(options: NetworkInterceptorOptions) {
        this.onLog = options.onLog;
    }

    // ============================================================
    // 生命周期
    // ============================================================

    /** 立即启动拦截（document_start 时调用） */
    start(): void {
        if (this.started) return;
        this.started = true;

        this.interceptor = new BatchInterceptor({
            name: 'bugreplay-network',
            interceptors: [
                new XMLHttpRequestInterceptor(),
                new FetchInterceptor(),
            ],
        });

        this.interceptor.apply();
        this.interceptor.on('request', this.onRequest);
        this.interceptor.on('response', this.onResponse);
    }

    /** 开始录制：停止缓冲，回放已缓冲日志 */
    flush(): NetworkLog[] {
        this.buffering = false;
        const flushed = [...this.buffer];
        this.buffer = [];
        for (const log of flushed) {
            this.onLog(log);
        }
        return flushed;
    }

    /** 停止拦截并清理 */
    stop(): void {
        this.interceptor?.dispose();
        this.interceptor = null;
        this.pending.clear();
        this.buffer = [];
        this.buffering = true;
        this.started = false;
    }

    /** 更新 onLog 回调（录制开始时切换为写入 session） */
    setOnLog(fn: (log: NetworkLog) => void): void {
        this.onLog = fn;
    }

    // ============================================================
    // 事件处理
    // ============================================================

    private onRequest = ({ request, requestId }: {
        request: Request;
        requestId: string;
    }) => {
        const headers: Record<string, string> = {};
        request.headers.forEach((value, key) => { headers[key] = value; });

        this.pending.set(requestId, {
            id: generateUUID(),
            method: request.method as HttpMethod,
            url: request.url,
            requestHeaders: headers,
            requestBody: null,
            startTime: Date.now(),
        });

        // 异步读取请求体
        if (request.body) {
            readBody(request.body, MAX_RESPONSE_BODY_SIZE).then((body) => {
                const entry = this.pending.get(requestId);
                if (entry) entry.requestBody = body;
            }).catch(() => {});
        }
    };

    private onResponse = ({ response, requestId }: {
        response: Response;
        requestId: string;
    }) => {
        const entry = this.pending.get(requestId);
        this.pending.delete(requestId);
        if (!entry) return;

        const endTime = Date.now();
        const resHeaders = headersToRecord(response.headers);

        readBody(response.body, MAX_RESPONSE_BODY_SIZE).then((resBody) => {
            this.emitLog(entry, response.status, response.statusText, resHeaders, resBody, endTime);
        }).catch(() => {
            this.emitLog(entry, response.status, response.statusText, resHeaders, null, endTime);
        });
    };

    private emitLog(
        entry: PendingEntry,
        status: number,
        statusText: string,
        resHeaders: Record<string, string>,
        resBody: string | null,
        endTime: number,
    ): void {
        const log: NetworkLog = {
            id: entry.id,
            url: entry.url,
            method: entry.method,
            requestHeaders: filterHeaders(entry.requestHeaders),
            requestBody: entry.requestBody,
            status,
            statusText,
            responseHeaders: filterHeaders(resHeaders),
            responseBody: resBody,
            startTime: entry.startTime,
            duration: endTime - entry.startTime,
            requestType: 'fetch',
            isError: status === 0 || status >= 400,
            error: status >= 400 ? `HTTP ${status} ${statusText}` : undefined,
        };

        if (this.buffering) {
            this.buffer.push(log);
        }
        else {
            this.onLog(log);
        }
    }
}
