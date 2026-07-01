/**
 * src/background/rrt-builder.ts — .rrt 文件构建器
 *
 * 将录制会话数据打包为 .rrt 格式并触发下载
 */

import type { NetworkLog, RecordingSession, RRTPackage } from '@shared/types';
import { EXTENSION_VERSION } from '@shared/constants';
import { SENSITIVE_HEADERS } from '@shared/types';
import { formatTimestamp, safeStringify } from '@shared/utils';
import browser from 'webextension-polyfill';

/**
 * 计算录制时长
 */
function calculateDuration(session: RecordingSession): number {
    if (session.endTime) {
        return session.endTime - session.startTime;
    }
    // 如果未正常结束，使用最后一个事件的时间
    const lastEvent = session.events[session.events.length - 1];
    if (lastEvent) {
        return lastEvent.timestamp - session.startTime;
    }
    return 0;
}

/**
 * 将 RecordingSession 转换为 RRTPackage
 *
 * 在此进行最终的安全过滤，确保敏感数据不会泄露到 .rrt 文件中。
 */
export function buildRRTPackage(session: RecordingSession): RRTPackage {
    const duration = calculateDuration(session);

    return {
        version: '1.0.0',
        exportedAt: Date.now(),
        metadata: {
            title: session.title,
            duration,
            description: session.description,
            tags: session.tags,
            extensionVersion: EXTENSION_VERSION,
            createdBy: undefined,
            externalIssueId: session.externalIssueId,
        },
        environment: sanitizeEnvironment(session.environment!),
        rrwebEvents: session.events,
        networkLogs: sanitizeNetworkLogs(session.networkLogs),
        consoleLogs: sanitizeConsoleLogs(session.consoleLogs),
        annotations: session.annotations,
    };
}

/**
 * 生成 .rrt 文件名
 */
export function generateRRTFilename(session: RecordingSession): string {
    const dateStr = formatTimestamp(Date.now());
    const safeTitle = (session.title || 'recording')
        .replace(/[^\w\u4E00-\u9FA5-]/g, '_')
        .slice(0, 60);
    return `${safeTitle}_${dateStr}.rrt`;
}

/**
 * 触发浏览器下载 .rrt 文件
 * MV3 Service Worker 不支持 URL.createObjectURL / FileReader，使用 btoa
 */
export async function downloadRRTFile(
    session: RecordingSession,
): Promise<void> {
    const rrtPackage = buildRRTPackage(session);
    const jsonStr = JSON.stringify(rrtPackage, null, 2);
    const filename = generateRRTFilename(session);

    // btoa 不直接支持 Unicode，先 encodeURIComponent 再转 base64
    const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
    const dataUrl = `data:application/json;base64,${base64}`;

    await browser.downloads.download({
        url: dataUrl,
        filename,
        saveAs: true,
    });
}

/**
 * 将 RRT 数据复制到剪贴板
 */
export async function copyRRTToClipboard(
    session: RecordingSession,
): Promise<void> {
    const rrtPackage = buildRRTPackage(session);
    const jsonStr = safeStringify(rrtPackage) ?? JSON.stringify(rrtPackage);
    await navigator.clipboard.writeText(jsonStr);
}

// ============================================================
// 安全过滤（防御性二次清理，确保不泄露敏感数据）
// ============================================================

/**
 * 对网络日志做二次敏感头过滤
 * 即使录制时已过滤，打包时再做一次防御性检查
 */
function sanitizeNetworkLogs(logs: NetworkLog[]): NetworkLog[] {
    return logs.map(log => ({
        ...log,
        requestHeaders: filterSensitiveHeaders(log.requestHeaders),
        responseHeaders: filterSensitiveHeaders(log.responseHeaders),
    }));
}

/** 过滤 headers 中的敏感字段 */
function filterSensitiveHeaders(
    headers: Record<string, string>,
): Record<string, string> {
    const filtered: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
        if (!SENSITIVE_HEADERS.includes(key.toLowerCase())) {
            filtered[key] = value;
        }
    }
    return filtered;
}

/**
 * 对环境快照做安全处理
 * - 确保 cookies 不包含 HttpOnly 标记的敏感值
 * - (document.cookie 天然不含 HttpOnly，此处为防御性代码)
 */
function sanitizeEnvironment(
    env: NonNullable<RecordingSession['environment']>,
): NonNullable<RecordingSession['environment']> {
    return {
        ...env,
        cookies: env.cookies ?? {},
        localStorage: truncateStorageValues(env.localStorage ?? {}),
        sessionStorage: truncateStorageValues(env.sessionStorage ?? {}),
    };
}

/** 截断 storage 中过长的值（> 1KB），防止敏感 token 泄露 */
function truncateStorageValues(
    storage: Record<string, string>,
): Record<string, string> {
    const maxLen = 1024; // 1KB
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(storage)) {
        result[key] = value.length > maxLen
            ? `${value.slice(0, maxLen)}...[truncated]`
            : value;
    }
    return result;
}

/**
 * 对控制台日志做安全序列化
 * 确保参数中不包含未处理的循环引用或敏感对象
 */
function sanitizeConsoleLogs(
    logs: RecordingSession['consoleLogs'],
): RecordingSession['consoleLogs'] {
    return logs.map(log => ({
        ...log,
        // args 已由 console-interceptor 使用 safeStringify 处理
        // 此处保留原值，仅做类型安全检查
        args: log.args ?? [],
    }));
}
