/**
 * src/content/zentao/useZentaoReplay.ts — 禅道 Bug 页面 .rrt 附件识别与回放
 *
 * 功能：
 * 1. 识别当前页面是否为禅道 Bug 详情页
 * 2. 从页面（含同源 iframe）解析附件列表，筛选 .rrt / .rrt.json / .rrt.txt 录制文件
 * 3. 在附件列表末尾注入「BugReplay 回放」按钮
 * 4. 点击后通过页面主世界 helper 下载附件（带 Cookie），导入为回放会话并打开回放页
 */

import type { ZentaoRrtAttachment } from '@shared/types';
import { BackgroundToContentAction, ContentToBackgroundAction } from '@shared/types';
import browser from 'webextension-polyfill';
import {
    ZENTAO_HELPER_ELEMENT_ID,
    ZENTAO_HELPER_SCRIPT_PATH,
    ZENTAO_MSG_DOWNLOAD,
    ZENTAO_MSG_PING,
    ZENTAO_MSG_READY,
    ZENTAO_MSG_RESULT,
    ZENTAO_MSG_SOURCE
} from '../constants';

const HELPER_SCRIPT_URL = browser.runtime.getURL(ZENTAO_HELPER_SCRIPT_PATH);

/** 判断 URL 是否为禅道 Bug 详情页（index.php?m=bug&f=view 或 bug-view-{id}.html） */
export function isZentaoBugPage(url: string | undefined): boolean {
    if (!url)
        return false;
    try {
        const u = new URL(url);
        const m = u.searchParams.get('m');
        const f = u.searchParams.get('f');
        if (m === 'bug' && f === 'view')
            return true;
        return /bug-view-\d+\.html/.test(u.pathname);
    }
    catch {
        return false;
    }
}

/** 页面中解析出的禅道附件（含下载链接 DOM 引用） */
interface RawAttachment {
    id: string;
    filename: string;
    url: string;
    sizeText?: string;
    link: HTMLAnchorElement;
}

/** 收集禅道 Bug 附件（顶层文档 + 所有同源 iframe，如禅道 22.x 的 app-qa 框架） */
function collectAttachments(): RawAttachment[] {
    const docs: Document[] = [document];
    for (const frame of document.querySelectorAll('iframe')) {
        try {
            if (frame.contentDocument)
                docs.push(frame.contentDocument);
        }
        catch {
            // 跨域 iframe 忽略
        }
    }

    const result: RawAttachment[] = [];
    const seen = new Set<string>();
    for (const doc of docs) {
        for (const a of Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href*="f=download"], a[href*="file-download"]'))) {
            const href = a.href || '';
            const idMatch = href.match(/fileID=(\d+)/) || href.match(/file-download-(\d+)/);
            const id = idMatch ? idMatch[1] : '';
            if (!id || seen.has(id))
                continue;
            seen.add(id);
            result.push({
                id,
                filename: extractFilename(a),
                url: href,
                sizeText: extractSizeText(a),
                link: a
            });
        }
    }
    return result;
}

/** 从附件链接文本提取文件名（去掉大小文本与多余空白） */
function extractFilename(a: HTMLAnchorElement): string {
    const text = (a.textContent || '').replace(/\s*\(\d+(\.\d+)?\s*(B|KB|MB|GB)\s*\)\s*$/i, '').trim();
    return text || a.getAttribute('title') || '';
}

/** 从附件链接文本提取大小展示（如 "4.92KB"） */
function extractSizeText(a: HTMLAnchorElement): string | undefined {
    const m = (a.textContent || '').match(/\((\d+(\.\d+)?\s*(B|KB|MB|GB))\)/i);
    return m ? m[1] : undefined;
}

/** 文件名是否为 BugReplay 录制文件（.rrt / .rrt.json / .rrt.txt） */
function isRrtFilename(name: string): boolean {
    return /\.rrt(?:\.(?:json|txt))?$/i.test(name.trim());
}

/** 获取当前禅道 Bug 页面的 .rrt 附件列表 */
export function findRrtAttachments(): ZentaoRrtAttachment[] {
    return collectAttachments()
        .filter(item => isRrtFilename(item.filename))
        .map(({ id, filename, url, sizeText }) => ({ id, filename, url, sizeText }));
}

/** 将页面主世界下载 helper 注入顶层页面 */
function injectHelper(): void {
    if (document.getElementById(ZENTAO_HELPER_ELEMENT_ID))
        return;
    const script = document.createElement('script');
    script.id = ZENTAO_HELPER_ELEMENT_ID;
    script.src = HELPER_SCRIPT_URL;
    (document.head || document.documentElement).appendChild(script);
    console.log(`[BugReplay] 禅道下载 helper 已注入: ${HELPER_SCRIPT_URL}`);
}

let downloadSeq = 0;

/** 探测页面主世界 helper 是否就绪（PING → READY 握手） */
function pingHelper(timeoutMs = 2500): Promise<boolean> {
    return new Promise(resolve => {
        let done = false;
        let pingCount = 0;
        let timer = 0;

        function onMessage(event: MessageEvent): void {
            const data = event.data;
            if (data && data.source === ZENTAO_MSG_SOURCE && data.type === ZENTAO_MSG_READY) {
                console.log(`[BugReplay] helper 已就绪（PING ${pingCount} 次）`);
                finish(true);
            }
        }

        function finish(ok: boolean): void {
            if (done)
                return;
            done = true;
            window.clearInterval(timer);
            window.removeEventListener('message', onMessage);
            resolve(ok);
        }

        window.addEventListener('message', onMessage);
        const post = (): void => {
            pingCount++;
            window.postMessage({ source: ZENTAO_MSG_SOURCE, type: ZENTAO_MSG_PING }, '*');
        };
        post();
        timer = window.setInterval(post, 400);
        window.setTimeout(() => {
            if (done)
                return;
            console.warn(`[BugReplay] helper 未响应 PING（共 ${pingCount} 次），判定未就绪`);
            finish(false);
        }, timeoutMs);
    });
}

/** 通过页面主世界 helper 下载附件（携带登录 Cookie），10s 无响应则判定失败 */
function downloadViaHelper(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const requestId = `zentao_dl_${Date.now()}_${++downloadSeq}`;
        let timeout = 0;
        let repostTimer: number | undefined;
        let repostCount = 0;
        let settled = false;
        let onMessage: (event: MessageEvent) => void = () => {};

        const cleanup = (): void => {
            if (settled)
                return;
            settled = true;
            window.clearTimeout(timeout);
            if (repostTimer)
                window.clearInterval(repostTimer);
            window.removeEventListener('message', onMessage);
        };

        onMessage = (event: MessageEvent): void => {
            const data = event.data;
            if (!data || data.source !== ZENTAO_MSG_SOURCE || data.type !== ZENTAO_MSG_RESULT)
                return;
            if (data.requestId !== requestId) {
                console.log(`[BugReplay] 忽略其他请求的 RESULT: ${data.requestId}`);
                return;
            }
            console.log(`[BugReplay] 收到附件下载 RESULT: requestId=${requestId} ok=${data.ok}`);
            cleanup();
            if (data.ok)
                resolve(data.text);
            else
                reject(new Error(data.error || '附件下载失败'));
        };

        window.addEventListener('message', onMessage);
        console.log(`[BugReplay] helper 下载进行中: requestId=${requestId}`);

        // 重复投递 DOWNLOAD 直到收到结果（helper 对同一 requestId 只会发起一次请求）
        const post = (): void => {
            repostCount++;
            if (repostCount === 1 || repostCount % 5 === 0)
                console.log(`[BugReplay] 等待 helper 响应中... requestId=${requestId} 已重投 ${repostCount} 次`);
            window.postMessage({ source: ZENTAO_MSG_SOURCE, type: ZENTAO_MSG_DOWNLOAD, url, requestId }, '*');
        };
        post();
        repostTimer = window.setInterval(post, 400);

        timeout = window.setTimeout(() => {
            console.error(`[BugReplay] helper 下载超时: requestId=${requestId} 已重投 ${repostCount} 次`);
            cleanup();
            reject(new Error('附件下载超时'));
        }, 10_000);
    });
}

/** 通过后台 Service Worker 直接下载（host_permissions 绕过 CORS + 携带 Cookie） */
function downloadViaBackground(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('后台下载超时')), 20_000);
        browser.runtime.sendMessage({
            action: ContentToBackgroundAction.DOWNLOAD_ATTACHMENT,
            payload: { url }
        })
            .then(resp => {
                window.clearTimeout(timer);
                const r = resp as { action: string; payload?: { text?: string } | string } | undefined;
                if (!r || r.action === BackgroundToContentAction.ERROR) {
                    const msg = typeof r?.payload === 'string' ? r.payload : '后台下载失败';
                    reject(new Error(msg));
                    return;
                }
                const text = (r.payload as { text?: string } | undefined)?.text;
                if (typeof text !== 'string') {
                    reject(new Error('后台下载响应缺少内容'));
                    return;
                }
                console.log(`[BugReplay] 后台下载成功: 内容长度=${text.length}`);
                resolve(text);
            })
            .catch(err => {
                window.clearTimeout(timer);
                reject(err instanceof Error ? err : new Error(String(err)));
            });
    });
}

/** 下载附件内容：优先页面主世界 helper（带登录 Cookie），失败则回退后台下载 */
async function downloadAttachment(url: string): Promise<string> {
    injectHelper();
    console.log(`[BugReplay] 开始下载禅道附件: url=${url}`);
    if (await pingHelper()) {
        try {
            return await downloadViaHelper(url);
        }
        catch (helperErr) {
            console.warn('[BugReplay] helper 下载失败，回退后台下载:', helperErr);
        }
    }
    else {
        console.warn('[BugReplay] helper 未就绪，直接走后台下载');
    }
    return downloadViaBackground(url);
}

/** 下载 .rrt 附件并导入为回放会话（background 负责存库 + 打开回放页） */
async function playAttachment(att: ZentaoRrtAttachment): Promise<boolean> {
    try {
        console.log(`[BugReplay] 回放开始: id=${att.id} filename=${att.filename}`);
        const content = await downloadAttachment(att.url);
        console.log(`[BugReplay] 附件下载完成: filename=${att.filename} 内容长度=${content.length}`);
        console.log(`[BugReplay] 发送 IMPORT_RRT 到后台: filename=${att.filename}`);
        const resp = await browser.runtime.sendMessage({
            action: ContentToBackgroundAction.IMPORT_RRT,
            payload: { content, filename: att.filename }
        }) as { action: BackgroundToContentAction.IMPORTED_RRT; payload: { sessionId: string } } | { action: BackgroundToContentAction.ERROR; payload?: string } | undefined;
        console.log(`[BugReplay] IMPORT_RRT 响应: action=${resp?.action}`, resp?.payload);

        if (!resp || resp.action === BackgroundToContentAction.ERROR) {
            console.error('[BugReplay] 禅道附件导入失败:', resp);
            return false;
        }
        console.log(`[BugReplay] 禅道附件已导入回放会话: ${resp.payload.sessionId}`);
        return true;
    }
    catch (err) {
        console.error('[BugReplay] 禅道附件回放失败:', err);
        return false;
    }
}

/** 播放图标（内联 SVG，避免依赖页面图标库） */
const ICON_PLAY = '<svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor" style="vertical-align:-1px"><path d="M5 3v10l8-5z"/></svg>';

/** 加载动画（SVG 内联动画，无需额外 CSS） */
const SPINNER_HTML = '<svg viewBox="0 0 24 24" width="12" height="12" style="vertical-align:-2px"><circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="3"/><path d="M12 2a10 10 0 0 1 10 10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></path></svg>';

const BUTTON_IDLE_HTML = `${ICON_PLAY}<span>BugReplay 回放</span>`;
const BUTTON_LOADING_HTML = `${SPINNER_HTML}<span>回放中...</span>`;

/** 创建禅道附件条目内的「BugReplay 回放」按钮（自带点击加载态） */
function createPlayButton(att: ZentaoRrtAttachment): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.bugreplayReplayBtn = 'true';
    button.style.cssText = 'display:inline-flex;align-items:center;gap:4px;margin-left:6px;'
        + 'padding:2px 10px;border:0;border-radius:13px;'
        + 'background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;'
        + 'font-size:12px;font-weight:600;line-height:20px;cursor:pointer;vertical-align:middle;'
        + 'box-shadow:0 1px 4px rgba(109,40,217,.3);transition:filter .15s ease,opacity .15s ease;';
    button.innerHTML = BUTTON_IDLE_HTML;

    const setLoading = (loading: boolean): void => {
        button.disabled = loading;
        button.style.cursor = loading ? 'wait' : 'pointer';
        button.style.opacity = loading ? '0.75' : '1';
        button.innerHTML = loading ? BUTTON_LOADING_HTML : BUTTON_IDLE_HTML;
    };

    button.addEventListener('mouseenter', () => {
        if (!button.disabled)
            button.style.filter = 'brightness(1.12)';
    });
    button.addEventListener('mouseleave', () => {
        button.style.filter = '';
    });
    button.addEventListener('click', () => {
        if (button.disabled)
            return;
        console.log(`[BugReplay] 页面回放按钮点击: id=${att.id} filename=${att.filename}`);
        setLoading(true);
        void playAttachment(att).finally(() => setLoading(false));
    });

    return button;
}

/** 在每条 .rrt 附件的条目内追加「BugReplay 回放」按钮（幂等：已注入的条目跳过，可反复调用自愈） */
function injectPlayButton(): boolean {
    const attachments = findRrtAttachments();
    if (!attachments.length)
        return false;

    const raws = collectAttachments();
    let injected = false;
    for (const att of attachments) {
        const raw = raws.find(item => item.id === att.id);
        if (!raw)
            continue;
        const host = raw.link.closest('li') || raw.link.parentElement;
        if (!host)
            continue;
        // 该附件条目已注入过按钮（iframe 重渲染后按钮丢失时需补注）
        if (host.querySelector('[data-bugreplay-replay-btn]'))
            continue;

        const button = createPlayButton(att);
        host.appendChild(button);
        injected = true;
        console.log(`[BugReplay] 已在禅道页面注入回放按钮: id=${att.id} filename=${att.filename}`);
    }
    return injected;
}

/** 判断顶层文档或任一同源 iframe 是否为禅道 Bug 详情页 */
function isZentaoBugDocument(): boolean {
    if (isZentaoBugPage(window.location.href))
        return true;
    for (const frame of document.querySelectorAll('iframe')) {
        try {
            if (frame.contentDocument && isZentaoBugPage(frame.contentDocument.location.href))
                return true;
        }
        catch {
            // 跨域 iframe 忽略
        }
    }
    return false;
}

/** 启动禅道回放检测：持续轮询，识别禅道页面 → 注入 helper + 回放按钮 */
export function startZentaoReplay(): void {
    let attempts = 0;
    const timer = window.setInterval(() => {
        attempts++;
        if (isZentaoBugDocument()) {
            injectHelper();
            injectPlayButton();
        }
        // 最多轮询 120s：覆盖 iframe 懒渲染 / 重渲染导致按钮丢失的情况
        if (attempts >= 120)
            window.clearInterval(timer);
    }, 1000);
}

/** Popup 查询：返回当前页面 .rrt 附件列表 */
export function handleQueryZentaoAttachments(): { hasRrt: boolean; attachments: ZentaoRrtAttachment[] } {
    const attachments = findRrtAttachments();
    return { hasRrt: attachments.length > 0, attachments };
}

/** Popup 触发：下载第一个 .rrt 附件并打开回放 */
export async function handlePlayZentaoAttachment(): Promise<{ ok: boolean; error?: string }> {
    const attachments = findRrtAttachments();
    if (!attachments.length)
        return { ok: false, error: '当前禅道 Bug 页面没有 .rrt 附件' };
    const ok = await playAttachment(attachments[0]);
    return ok ? { ok: true } : { ok: false, error: '附件下载或导入失败，请查看扩展控制台' };
}
