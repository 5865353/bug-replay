/**
 * src/background/rrt-builder.ts — .rrt 文件构建器
 *
 * 将录制会话数据打包为 .rrt 格式并触发下载
 */

import type { RecordingSession, RRTPackage } from '@shared/types';
import {
    EXTENSION_VERSION,
    RRT_FILENAME_DATE_FORMAT,
} from '@shared/constants';
import { formatTimestamp } from '@shared/utils';
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
        environment: session.environment!,
        rrwebEvents: session.events,
        networkLogs: session.networkLogs,
        consoleLogs: session.consoleLogs,
        annotations: session.annotations,
    };
}

/**
 * 生成 .rrt 文件名
 */
export function generateRRTFilename(session: RecordingSession): string {
    const dateStr = formatTimestamp(Date.now());
    const safeTitle = (session.title || 'recording')
        .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_')
        .slice(0, 60);
    return `${safeTitle}_${dateStr}.rrt`;
}

/**
 * 触发浏览器下载 .rrt 文件
 */
export async function downloadRRTFile(session: RecordingSession): Promise<void> {
    const rrtPackage = buildRRTPackage(session);
    const jsonStr = JSON.stringify(rrtPackage, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const filename = generateRRTFilename(session);

    try {
        await browser.downloads.download({
            url,
            filename,
            saveAs: true,
        });
    } finally {
        // 延迟释放 ObjectURL
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}

/**
 * 将 RRT 数据复制到剪贴板
 */
export async function copyRRTToClipboard(session: RecordingSession): Promise<void> {
    const rrtPackage = buildRRTPackage(session);
    const jsonStr = JSON.stringify(rrtPackage);
    await navigator.clipboard.writeText(jsonStr);
}
