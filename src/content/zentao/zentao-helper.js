/**
 * src/content/zentao/zentao-helper.js — 禅道附件下载辅助脚本（页面主世界执行）
 *
 * Content Script 处于扩展隔离世界，其 fetch 请求受 CORS 限制；
 * 而禅道附件下载需要登录会话 Cookie，因此将该脚本注入页面主世界，
 * 用页面自身的 fetch（同源 + 带 Cookie）下载附件内容，再通过 postMessage 回传。
 *
 * 协议（source 均为 'bugreplay-zentao'）：
 * - PING   → 立即回 READY（供 Content Script 感知脚本已就绪）
 * - DOWNLOAD { url, requestId } → 下载后回 RESULT { requestId, ok, text|error }
 * 同一 requestId 的重复 DOWNLOAD 会被忽略（避免重试导致的重复请求）。
 */

(() => {
    const FLAG = '__bugreplay_zentao_helper__';
    if (window[FLAG]) {
        console.log('[BugReplay-helper] 已存在，跳过重复加载');
        return;
    }
    window[FLAG] = true;

    console.log('[BugReplay-helper] 加载完成，开始监听消息');

    const inFlight = new Map();

    window.addEventListener('message', event => {
        const data = event.data;
        if (!data || data.source !== 'bugreplay-zentao')
            return;

        // 跨世界 / 跨窗口的 event.source 比较在部分浏览器/场景下不可靠，
        // 不再用它拦截消息，统一靠 source 命名空间 + requestId 防串扰（留日志便于排查）
        if (event.source !== window) {
            console.warn('[BugReplay-helper] 收到跨窗口消息(不拦截):', data.type, data.requestId || '');
        }

        if (data.type === 'PING') {
            window.postMessage({ source: 'bugreplay-zentao', type: 'READY' }, '*');
            return;
        }

        if (data.type !== 'DOWNLOAD')
            return;
        const { url, requestId } = data;
        if (!url || !requestId || inFlight.has(requestId))
            return;
        inFlight.set(requestId, true);
        console.log('[BugReplay-helper] 开始下载:', requestId, url);
        fetch(url, { credentials: 'include', cache: 'no-store' })
            .then(resp => {
                if (!resp.ok)
                    throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
                return resp.text();
            })
            .then(text => {
                console.log('[BugReplay-helper] 下载完成:', requestId, '长度', text.length);
                window.postMessage({
                    source: 'bugreplay-zentao',
                    type: 'RESULT',
                    requestId,
                    ok: true,
                    text
                }, '*');
            })
            .catch(err => {
                console.error('[BugReplay-helper] 下载失败:', requestId, err);
                window.postMessage({
                    source: 'bugreplay-zentao',
                    type: 'RESULT',
                    requestId,
                    ok: false,
                    error: err instanceof Error ? err.message : String(err)
                }, '*');
            })
            .finally(() => inFlight.delete(requestId));
    });
})();
