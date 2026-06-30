// ============================================================
// src/shared/types/network.ts — 网络请求日志类型定义
// ============================================================

/** HTTP 请求方法 */
export type HttpMethod
    = | 'GET'
        | 'POST'
        | 'PUT'
        | 'DELETE'
        | 'PATCH'
        | 'HEAD'
        | 'OPTIONS';

/** 网络请求记录 */
export interface NetworkLog {
    /** 唯一标识（自增 UUID） */
    id: string;
    /** 请求完整 URL */
    url: string;
    /** HTTP 方法 */
    method: HttpMethod;
    /** 请求头（已过滤敏感字段，如 Authorization / Cookie） */
    requestHeaders: Record<string, string>;
    /** 请求体（序列化后文本，超过 100KB 截断） */
    requestBody: string | null;
    /** HTTP 响应状态码 */
    status: number;
    /** 响应状态文本 */
    statusText: string;
    /** 响应头 */
    responseHeaders: Record<string, string>;
    /** 响应体（序列化后文本，超过 100KB 截断） */
    responseBody: string | null;
    /** 请求发起时间戳 (ms, 基于 performance.now() 偏移) */
    startTime: number;
    /** 请求耗时 (ms) */
    duration: number;
    /** 请求发起类型 */
    requestType: 'xhr' | 'fetch';
    /** 错误描述（网络超时/CORS/状态码异常等） */
    error?: string;
    /** 是否请求出错（含 HTTP 4xx/5xx） */
    isError: boolean;
}

/** 敏感请求头字段（录制时自动过滤） */
export const SENSITIVE_HEADERS = [
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-auth-token',
    'proxy-authorization',
];

/** 响应体最大字节数（超出截断） */
export const MAX_RESPONSE_BODY_SIZE = 100 * 1024; // 100KB
