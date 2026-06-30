/**
 * src/content/recorder/network-interceptor.ts
 *
 * 网络请求拦截器 — 拦截 XHR 和 Fetch 请求，记录请求/响应详情
 *
 * 安全处理：
 * - 过滤敏感请求头（Authorization, Cookie 等）
 * - 响应体超过 100KB 自动截断
 * - 循环引用安全序列化
 */

import type { HttpMethod, NetworkLog } from '@shared/types';
import { MAX_RESPONSE_BODY_SIZE, SENSITIVE_HEADERS } from '@shared/types';
import { filterSensitiveKeys, generateUUID, safeStringify } from '@shared/utils';

export interface NetworkInterceptorOptions {
    /** 网络日志回调 */
    onLog: (log: NetworkLog) => void;
}

export class NetworkInterceptor {
    private options: NetworkInterceptorOptions;
    // 保存原始方法引用（用于恢复）
    private originalXHROpen: typeof XMLHttpRequest.prototype.open | null = null;
    private originalXHRSend: typeof XMLHttpRequest.prototype.send | null = null;
    private originalFetch: typeof window.fetch | null = null;
    private recordingStartTime = 0;

    constructor(options: NetworkInterceptorOptions) {
        this.options = options;
    }

    /**
     * 开始拦截所有网络请求
     */
    start(): void {
        this.recordingStartTime = Date.now();
        this.interceptXHR();
        this.interceptFetch();
    }

    /**
     * 停止拦截（恢复原始方法）
     */
    stop(): void {
        if (this.originalXHROpen) {
            XMLHttpRequest.prototype.open = this.originalXHROpen;
            this.originalXHROpen = null;
        }
        if (this.originalXHRSend) {
            XMLHttpRequest.prototype.send = this.originalXHRSend;
            this.originalXHRSend = null;
        }
        if (this.originalFetch) {
            window.fetch = this.originalFetch;
            this.originalFetch = null;
        }
    }

    // ============================================================
    // XHR 拦截
    // ============================================================

    private interceptXHR(): void {
        // eslint-disable-next-line ts/no-this-alias
        const self = this;
        this.originalXHROpen = XMLHttpRequest.prototype.open;
        this.originalXHRSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (
            this: XMLHttpRequest & { __bugreplay?: XHRMeta },
            method: string,
            url: string | URL,
            async: boolean = true,
            username?: string | null,
            password?: string | null,
        ) {
            // 在 XHR 实例上挂载元数据
            this.__bugreplay = {
                method: method.toUpperCase() as HttpMethod,
                url: url.toString(),
                startTime: Date.now(),
                requestHeaders: {},
                requestBody: null,
            };
            return self.originalXHROpen!.call(
                this,
                method,
                url,
                async,
                username ?? undefined,
                password ?? undefined,
            );
        };

        XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
            const meta = (this as XMLHttpRequest & { __bugreplay?: XHRMeta }).__bugreplay;
            if (!meta) {
                return self.originalXHRSend!.call(this, body);
            }

            meta.requestBody = self.safeBodyToString(body);
            const startTime = Date.now();

            // 监听 readyState 变化
            const onReadyStateChange = () => {
                if (this.readyState === XMLHttpRequest.DONE) {
                    const endTime = Date.now();
                    const responseHeaders = self.parseXHRHeaders(
                        this.getAllResponseHeaders(),
                    );

                    const log = self.createLog({
                        url: meta.url,
                        method: meta.method,
                        requestHeaders: self.filterHeaders(meta.requestHeaders),
                        requestBody: meta.requestBody,
                        status: this.status,
                        statusText: this.statusText,
                        responseHeaders: self.filterHeaders(
                            self.headersToRecord(responseHeaders),
                        ),
                        responseBody: self.truncateBody(
                            self.safeBodyToString(this.response ?? this.responseText),
                        ),
                        startTime: meta.startTime,
                        duration: endTime - startTime,
                        requestType: 'xhr',
                        isError: this.status === 0 || this.status >= 400,
                        error:
                            this.status === 0
                                ? 'Network Error / CORS / Aborted'
                                : this.status >= 400
                                    ? `HTTP ${this.status} ${this.statusText}`
                                    : undefined,
                    });

                    self.options.onLog(log);
                    this.removeEventListener('readystatechange', onReadyStateChange);
                }
            };

            // 监听 error / abort / timeout
            const onError = (eventType: string) => {
                const endTime = Date.now();
                const log = self.createLog({
                    url: meta.url,
                    method: meta.method,
                    requestHeaders: self.filterHeaders(meta.requestHeaders),
                    requestBody: meta.requestBody,
                    status: 0,
                    statusText: eventType,
                    responseHeaders: {},
                    responseBody: null,
                    startTime: meta.startTime,
                    duration: endTime - startTime,
                    requestType: 'xhr',
                    isError: true,
                    error: `XHR ${eventType}`,
                });
                self.options.onLog(log);
                this.removeEventListener('readystatechange', onReadyStateChange);
            };

            this.addEventListener('readystatechange', onReadyStateChange);
            this.addEventListener('error', () => onError('error'));
            this.addEventListener('abort', () => onError('abort'));
            this.addEventListener('timeout', () => onError('timeout'));

            // 设置请求头拦截
            const originalSetRequestHeader = this.setRequestHeader.bind(this);
            this.setRequestHeader = function (name: string, value: string) {
                meta.requestHeaders[name] = value;
                return originalSetRequestHeader(name, value);
            };

            return self.originalXHRSend!.call(this, body);
        };
    }

    // ============================================================
    // Fetch 拦截
    // ============================================================

    private interceptFetch(): void {
        // eslint-disable-next-line ts/no-this-alias
        const self = this;
        this.originalFetch = window.fetch;

        window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
            const startTime = Date.now();

            // 解析 URL 和 Method
            let url: string;
            let method: HttpMethod = 'GET';
            const requestHeaders: Record<string, string> = {};

            if (typeof input === 'string') {
                url = input;
            }
            else if (input instanceof Request) {
                url = input.url;
                method = input.method as HttpMethod;
                input.headers.forEach((value, key) => {
                    requestHeaders[key] = value;
                });
            }
            else {
                url = input.toString();
            }

            // 合并 init 中的 headers
            if (init?.headers) {
                const initHeaders = new Headers(init.headers);
                initHeaders.forEach((value, key) => {
                    requestHeaders[key] = value;
                });
            }
            if (init?.method) {
                method = init.method.toUpperCase() as HttpMethod;
            }

            const requestBody = self.safeBodyToString(init?.body);

            try {
                const response = await self.originalFetch!.call(window, input, init);
                const endTime = Date.now();

                // 克隆响应以读取 body（避免消费原始流）
                const clonedResponse = response.clone();
                let responseBody: string | null = null;
                try {
                    responseBody = await clonedResponse.text();
                }
                catch {
                    responseBody = '[Unable to read response body]';
                }

                const responseHeaders: Record<string, string> = {};
                response.headers.forEach((value, key) => {
                    responseHeaders[key] = value;
                });

                const log = self.createLog({
                    url,
                    method,
                    requestHeaders: self.filterHeaders(requestHeaders),
                    requestBody,
                    status: response.status,
                    statusText: response.statusText,
                    responseHeaders: self.filterHeaders(
                        self.headersToRecord(responseHeaders),
                    ),
                    responseBody: self.truncateBody(responseBody),
                    startTime,
                    duration: endTime - startTime,
                    requestType: 'fetch',
                    isError: !response.ok,
                    error: response.ok ? undefined : `HTTP ${response.status} ${response.statusText}`,
                });

                self.options.onLog(log);
                return response;
            }
            catch (error) {
                const endTime = Date.now();
                const log = self.createLog({
                    url,
                    method,
                    requestHeaders: self.filterHeaders(requestHeaders),
                    requestBody,
                    status: 0,
                    statusText: 'Network Error',
                    responseHeaders: {},
                    responseBody: null,
                    startTime,
                    duration: endTime - startTime,
                    requestType: 'fetch',
                    isError: true,
                    error: error instanceof Error ? error.message : 'Fetch failed',
                });

                self.options.onLog(log);
                throw error;
            }
        };
    }

    // ============================================================
    // 辅助方法
    // ============================================================

    /** 过滤敏感请求头 */
    private filterHeaders(headers: Record<string, string>): Record<string, string> {
        return filterSensitiveKeys(headers, SENSITIVE_HEADERS);
    }

    /** 截断过大的响应体 */
    private truncateBody(body: string | null): string | null {
        if (body && body.length > MAX_RESPONSE_BODY_SIZE) {
            return (
                `${body.slice(0, MAX_RESPONSE_BODY_SIZE)
                }\n... [Truncated: ${body.length - MAX_RESPONSE_BODY_SIZE} bytes]`
            );
        }
        return body;
    }

    /** 安全地将 body 转为字符串 */
    private safeBodyToString(body: unknown): string | null {
        if (body === null || body === undefined) return null;
        if (typeof body === 'string') return body;

        try {
            if (body instanceof FormData) {
                const obj: Record<string, unknown> = {};
                body.forEach((value, key) => {
                    obj[key] = value instanceof File ? `[File: ${value.name}]` : value;
                });
                return safeStringify(obj);
            }
            if (body instanceof URLSearchParams) {
                return body.toString();
            }
            if (body instanceof Blob) {
                return `[Blob: ${body.size} bytes, type=${body.type}]`;
            }
            if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
                return `[Binary: ${(body as { byteLength?: number }).byteLength ?? 'unknown'} bytes]`;
            }
            return safeStringify(body);
        }
        catch {
            return '[Serialization Failed]';
        }
    }

    /** 解析 XHR getAllResponseHeaders() 返回的原始字符串 */
    private parseXHRHeaders(raw: string): Record<string, string> {
        const headers: Record<string, string> = {};
        raw.trim()
            .split(/[\r\n]+/)
            .forEach((line) => {
                const parts = line.split(': ');
                if (parts.length >= 2) {
                    const key = parts[0];
                    const value = parts.slice(1).join(': ');
                    headers[key] = value;
                }
            });
        return headers;
    }

    /** 将 Headers 对象转为 Record（过滤 content-encoding 等二进制相关头） */
    private headersToRecord(headers: Record<string, string>): Record<string, string> {
        const result: Record<string, string> = {};
        for (const [key, value] of Object.entries(headers)) {
            // 保留文本类 header，跳过大体积二进制 header
            result[key] = value;
        }
        return result;
    }

    /** 创建网络日志条目 */
    private createLog(partial: Omit<NetworkLog, 'id'>): NetworkLog {
        return {
            id: generateUUID(),
            ...partial,
        };
    }
}

/** XHR 实例上的元数据类型 */
interface XHRMeta {
    method: HttpMethod;
    url: string;
    startTime: number;
    requestHeaders: Record<string, string>;
    requestBody: string | null;
}
