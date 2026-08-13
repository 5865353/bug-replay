/**
 * src/background/handlers/zentao-download.ts — 禅道附件后台下载处理
 *
 * 页面主世界 helper 不可用时的回退通道：
 * Service Worker 拥有 host_permissions（<all_urls>），fetch 不受 CORS 限制，
 * 且 credentials:'include' 会携带目标站点 Cookie（登录会话），可直接下载附件。
 */

import type { BackgroundToContentMessage } from '@shared/types';
import { EXTENSION_NAME } from '@shared/constants';
import { BackgroundToContentAction } from '@shared/types';

export async function handleDownloadAttachment(
    payload: unknown,
    requestId?: string
): Promise<BackgroundToContentMessage> {
    try {
        const { url } = payload as { url?: string };
        if (!url || !/^https?:\/\//i.test(url)) {
            throw new Error('缺少有效的下载地址');
        }

        const resp = await fetch(url, { credentials: 'include', cache: 'no-store' });
        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
        }
        const text = await resp.text();
        console.log(`[${EXTENSION_NAME}] 后台下载附件成功: ${url} 长度=${text.length}`);
        return {
            action: BackgroundToContentAction.DOWNLOAD_ATTACHMENT_RESULT,
            payload: { text },
            requestId
        };
    }
    catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[${EXTENSION_NAME}] 后台下载附件失败:`, msg);
        return {
            action: BackgroundToContentAction.ERROR,
            payload: `附件下载失败: ${msg}`,
            requestId
        };
    }
}
