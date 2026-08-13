/**
 * src/background/handlers/rrt-import.ts — .rrt 附件导入处理
 *
 * 接收禅道附件回放请求：解析 .rrt 内容 → 构造回放会话 → 存入 IndexedDB
 * → 打开回放页（?sessionId=xxx），供回放器按会话 ID 加载。
 */

import type { BackgroundToContentMessage, RecordingSession, RRTPackage } from '@shared/types';
import { EXTENSION_NAME } from '@shared/constants';
import { BackgroundToContentAction } from '@shared/types';
import { generateUUID } from '@shared/utils';
import browser from 'webextension-polyfill';
import { storageManager } from '../storage-manager';

export async function handleImportRrt(
    payload: unknown,
    requestId?: string
): Promise<BackgroundToContentMessage> {
    try {
        const { content, filename } = payload as { content: string; filename: string };
        if (typeof content !== 'string' || !content.trim()) {
            throw new Error('附件内容为空');
        }

        let pkg: RRTPackage;
        try {
            pkg = JSON.parse(content) as RRTPackage;
        }
        catch {
            throw new Error('附件不是有效的 JSON / .rrt 录制文件');
        }

        if (!pkg.rrwebEvents || !Array.isArray(pkg.rrwebEvents)) {
            throw new Error('附件缺少 rrwebEvents，不是有效的 .rrt 录制文件');
        }

        const events = pkg.rrwebEvents;
        const startTime = typeof events[0]?.timestamp === 'number' ? events[0].timestamp : Date.now();
        const endTime = typeof events[events.length - 1]?.timestamp === 'number' ? events[events.length - 1].timestamp : startTime;

        const session: RecordingSession = {
            id: generateUUID(),
            title: pkg.metadata?.title || (filename || '禅道附件回放').replace(/\.rrt(\.(json|txt))?$/i, ''),
            status: 'stopped',
            startTime,
            endTime,
            events,
            networkLogs: pkg.networkLogs || [],
            consoleLogs: pkg.consoleLogs || [],
            annotations: pkg.annotations || [],
            environment: pkg.environment || null,
            pageEvents: pkg.pageEvents || [],
            tags: pkg.metadata?.tags || [],
            description: pkg.metadata?.description,
            externalPlatform: 'zentao'
        };

        await storageManager.saveSession(session);

        // 打开回放页（通过 sessionId 参数按会话加载）
        const base = browser.runtime.getURL('src/replayer/index.html');
        await browser.tabs.create({ url: `${base}?sessionId=${session.id}` });

        console.log(`[${EXTENSION_NAME}] 禅道附件已导入回放会话: ${session.id}`);
        return {
            action: BackgroundToContentAction.IMPORTED_RRT,
            payload: { sessionId: session.id },
            requestId
        };
    }
    catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[${EXTENSION_NAME}] IMPORT_RRT error:`, msg);
        return {
            action: BackgroundToContentAction.ERROR,
            payload: `附件导入失败: ${msg}`,
            requestId
        };
    }
}
