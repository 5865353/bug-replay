// ============================================================
// src/shared/utils.ts — 通用工具函数
// ============================================================

import {
    MAX_ARG_SERIALIZE_LENGTH,
    MAX_SERIALIZE_DEPTH,
} from './constants';

// ============================================================
// UUID 生成
// ============================================================

/**
 * 生成简化的 UUID v4
 */
export function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// ============================================================
// 安全序列化
// ============================================================

/**
 * 安全序列化任意值为 JSON 字符串
 * - 处理循环引用
 * - 处理 BigInt、Symbol、undefined、Function 等特殊类型
 * - 限制序列化深度和长度
 */
export function safeStringify(value: unknown): string {
    const seen = new WeakSet<object>();

    function serialize(val: unknown, depth: number): unknown {
        // 深度限制
        if (depth > MAX_SERIALIZE_DEPTH) {
            return '[MaxDepth Exceeded]';
        }

        // null / undefined
        if (val === null) return null;
        if (val === undefined) return '[undefined]';

        // 基本类型
        const type = typeof val;
        if (type === 'string' || type === 'number' || type === 'boolean') {
            return val;
        }

        // BigInt
        if (type === 'bigint') {
            return `[BigInt: ${val.toString()}]`;
        }

        // Symbol
        if (type === 'symbol') {
            return `[Symbol: ${(val as symbol).toString()}]`;
        }

        // Function
        if (type === 'function') {
            return `[Function: ${(val as (..._: unknown[]) => unknown).name || 'anonymous'}]`;
        }

        // 循环引用检测
        if (type === 'object') {
            const obj = val as object;
            if (seen.has(obj)) {
                return '[Circular Reference]';
            }
            seen.add(obj);

            // Array
            if (Array.isArray(obj)) {
                return obj.map(item => serialize(item, depth + 1));
            }

            // Error
            if (obj instanceof Error) {
                return {
                    name: obj.name,
                    message: obj.message,
                    stack: obj.stack,
                };
            }

            // Date
            if (obj instanceof Date) {
                return `[Date: ${obj.toISOString()}]`;
            }

            // RegExp
            if (obj instanceof RegExp) {
                return `[RegExp: ${obj.toString()}]`;
            }

            // Map
            if (obj instanceof Map) {
                const entries: Array<[unknown, unknown]> = [];
                obj.forEach((v, k) => {
                    entries.push([serialize(k, depth + 1), serialize(v, depth + 1)]);
                });
                return { __type: 'Map', entries };
            }

            // Set
            if (obj instanceof Set) {
                const values: unknown[] = [];
                obj.forEach(v => values.push(serialize(v, depth + 1)));
                return { __type: 'Set', values };
            }

            // WeakMap / WeakSet
            if (obj instanceof WeakMap || obj instanceof WeakSet) {
                return `[${obj.constructor.name}]`;
            }

            // 普通对象（包括 DOM 节点等）
            try {
                const result: Record<string, unknown> = {};
                // 使用 Object.keys 而非 for-in，避免原型链属性
                const keys = Object.keys(obj).slice(0, 50); // 最多 50 个 key
                for (const key of keys) {
                    try {
                        result[key] = serialize((obj as Record<string, unknown>)[key], depth + 1);
                    }
                    catch {
                        result[key] = '[Serialization Error]';
                    }
                }
                if (Object.keys(obj).length > 50) {
                    result.__truncated__ = `${Object.keys(obj).length - 50} more keys`;
                }
                return result;
            }
            catch {
                return `[Object: ${obj.constructor?.name || 'unknown'}]`;
            }
        }

        return '[Unknown Type]';
    }

    const serialized = serialize(value, 0);
    let json = JSON.stringify(serialized);

    // 截断过长结果
    if (json.length > MAX_ARG_SERIALIZE_LENGTH) {
        json = `${json.slice(0, MAX_ARG_SERIALIZE_LENGTH)}... [Truncated]`;
    }

    return json;
}

/**
 * 安全序列化 console.log 参数数组
 */
export function serializeConsoleArgs(args: unknown[]): string[] {
    return args.map(arg => safeStringify(arg));
}

// ============================================================
// 时间格式化
// ============================================================

/**
 * 格式化毫秒为 mm:ss 格式
 */
export function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * 格式化毫秒为 mm:ss.ms 格式
 */
export function formatTimePrecise(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const millis = ms % 1000;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

/**
 * 格式化时间戳为文件名安全格式 YYYY-MM-DD_HH-mm-ss
 */
export function formatTimestamp(ts: number): string {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

// ============================================================
// 文件操作
// ============================================================

/**
 * 生成 .rrt 文件名
 */
export function generateRRTFilename(title: string): string {
    const sanitized = title
        .replace(/[^\w\u4E00-\u9FA5-]/g, '_')
        .slice(0, 100);
    const dateStr = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19);
    return `${sanitized}_${dateStr}.rrt`;
}

/**
 * 触发浏览器下载文件
 */
export function downloadFile(content: string, filename: string, mimeType = 'application/json'): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============================================================
// 敏感信息过滤
// ============================================================

/**
 * 过滤对象中的敏感键
 */
export function filterSensitiveKeys(
    obj: Record<string, string>,
    sensitiveKeys: string[],
): Record<string, string> {
    const filtered: Record<string, string> = {};
    const lowerSensitiveKeys = sensitiveKeys.map(k => k.toLowerCase());

    for (const [key, value] of Object.entries(obj)) {
        if (!lowerSensitiveKeys.includes(key.toLowerCase())) {
            filtered[key] = value;
        }
    }

    return filtered;
}

// ============================================================
// 捕获调用栈
// ============================================================

/**
 * 获取当前调用栈（排除自身和代理层）
 */
export function captureStackTrace(skipFrames = 3): string {
    const err = new Error('Stack trace capture');
    const stack = err.stack || '';
    const lines = stack.split('\n');
    // 跳过 Error 行和前 skipFrames 帧
    return lines.slice(skipFrames).join('\n');
}
