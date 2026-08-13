/**
 * src/upload/ai-context.ts — 将录制会话内容构建为 AI 分析用的上下文
 *
 * 录制数据可能很大（rrweb 事件流、大量控制台/网络日志），不能直接全量塞给 AI，
 * 这里采用“优先级 + 预算 + 抽样 + 截断”四重优化：
 *
 * 1. 优先级：错误/警告日志、失败请求（4xx/5xx）最高 → 一般日志/正常请求 → 页面跳转；
 *    环境信息最关键且最短，单独预留，始终保留。
 * 2. 预算：全局字符上限 AI_CONTEXT_BUDGET（按模型上下文容量估算，约 3k~6k token），
 *    按优先级从高到低填充，超预算即丢弃低优先级内容。
 * 3. 抽样：日志/请求过多时按时间均匀抽样，覆盖整个录制时段，避免只截取开头。
 * 4. 截断：每条日志/请求体限制长度，防止单条超长数据占满预算。
 *
 * 另外 rrweb 原始事件流（events）是 DOM 操作序列，不适合直接给 AI，
 * 这里只取其中可读的证据（控制台/网络/页面跳转/环境）。
 */

import type { ConsoleLog, NetworkLog, PageEvent, RecordingSession } from '@shared/types';

/** AI 上下文总字符预算（约 3k~6k token；中文字符约 1~1.5 token/字） */
export const AI_CONTEXT_BUDGET = 12000;

/** 单条日志 / 网络记录的最大字符数（超出截断） */
const MAX_ENTRY_LENGTH = 240;

/** 控制台日志：error / warn / 一般 条数上限 */
const LOG_LIMITS = { error: 30, warn: 20, normal: 15 };

/** 网络请求：失败 / 正常 条数上限 */
const REQUEST_LIMITS = { error: 20, normal: 12 };

/** 页面跳转条数上限 */
const PAGE_EVENT_LIMIT = 8;

/** 网络请求体（requestBody / responseBody）单侧最大字符数 */
const MAX_BODY_LENGTH = 180;

/** 按时间均匀抽样，避免数量过多时只保留开头而丢失中后段异常 */
function sample<T>(items: T[], limit: number): T[] {
    if (items.length <= limit)
        return items;
    const picked: T[] = [];
    const step = items.length / limit;
    for (let i = 0; i < limit; i++) {
        picked.push(items[Math.min(items.length - 1, Math.floor(i * step))]);
    }
    return picked;
}

function truncate(text: string, max: number): string {
    return text.length <= max ? text : `${text.slice(0, max)}…`;
}

function formatTime(ts: number): string {
    const d = new Date(ts);
    const p = (n: number) => n.toString().padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 构建控制台日志段落（error → warn → 一般，各自抽样限条） */
function buildConsoleSection(logs: ConsoleLog[]): string {
    const errors = logs.filter(l => l.level === 'error');
    const warns = logs.filter(l => l.level === 'warn');
    const normals = logs.filter(l => l.level !== 'error' && l.level !== 'warn');

    const lines: string[] = [];
    const push = (log: ConsoleLog) => {
        const msg = log.args.join(' ').trim() || '(空)';
        let line = `- [${formatTime(log.timestamp)}] [${log.level}] ${truncate(msg, MAX_ENTRY_LENGTH)}`;
        if (log.stackTrace)
            line += `\n  stack: ${truncate(log.stackTrace, MAX_ENTRY_LENGTH)}`;
        lines.push(line);
    };

    sample(errors, LOG_LIMITS.error).forEach(push);
    sample(warns, LOG_LIMITS.warn).forEach(push);
    sample(normals, LOG_LIMITS.normal).forEach(push);

    if (!lines.length)
        return '';
    return `## 控制台日志\n共 ${logs.length} 条（error ${errors.length} / warn ${warns.length}，以下为抽样）\n${lines.join('\n')}`;
}

/** 构建网络请求段落（失败请求优先，正常请求抽样） */
function buildNetworkSection(requests: NetworkLog[]): string {
    const errors = requests.filter(r => r.isError || r.status >= 400);
    const normals = requests.filter(r => !r.isError && r.status < 400);

    const lines: string[] = [];
    const push = (req: NetworkLog) => {
        const body = req.requestBody ? ` req:${truncate(req.requestBody, MAX_BODY_LENGTH)}` : '';
        const resp = req.responseBody ? ` resp:${truncate(req.responseBody, MAX_BODY_LENGTH)}` : '';
        const err = req.error ? ` err:${req.error}` : '';
        lines.push(
            `- [${req.method}] ${req.status} ${truncate(req.url, 140)} ${req.duration}ms${err}${body}${resp}`
        );
    };

    sample(errors, REQUEST_LIMITS.error).forEach(push);
    sample(normals, REQUEST_LIMITS.normal).forEach(push);

    if (!lines.length)
        return '';
    return `## 网络请求\n共 ${requests.length} 条（失败/异常 ${errors.length} 条，以下为抽样）\n${lines.join('\n')}`;
}

/** 构建页面跳转段落（仅 url_change，减少 storage 噪音） */
function buildPageEventSection(events: PageEvent[]): string {
    const urls = events.filter(e => e.type === 'url_change');
    if (!urls.length)
        return '';
    const lines = sample(urls, PAGE_EVENT_LIMIT).map(e => {
        const d = e.data as { from?: string; to?: string };
        const from = d.from ? truncate(d.from, 120) : '?';
        const to = d.to ? truncate(d.to, 120) : '?';
        return `- [${formatTime(e.timestamp)}] ${from} → ${to}`;
    });
    return `## 页面跳转\n${lines.join('\n')}`;
}

/** 构建环境信息段落（始终保留，最短且最关键） */
function buildEnvSection(session: RecordingSession): string {
    const env = session.environment;
    const lines = [
        '## 环境信息',
        `- 页面 URL: ${env?.url || '未知'}`,
        `- 页面标题: ${session.title || '未知'}`
    ];
    if (env?.userAgent)
        lines.push(`- 浏览器: ${truncate(env.userAgent, 140)}`);
    if (env?.screenResolution)
        lines.push(`- 分辨率: ${env.screenResolution.width}×${env.screenResolution.height}`);
    if (session.tags?.length)
        lines.push(`- 标签: ${session.tags.join(', ')}`);
    return lines.join('\n');
}

/**
 * 构建 AI 分析用的录制上下文。
 *
 * 环境信息先预留，其余部分按优先级填充剩余预算；
 * 超预算时丢弃低优先级内容，保证异常证据不丢失。
 */
export function buildAIContext(session: RecordingSession): string {
    const envText = buildEnvSection(session);
    const detailBudget = Math.max(0, AI_CONTEXT_BUDGET - envText.length - 4);

    // 优先级从高到低：控制台日志 > 网络请求 > 页面跳转
    const sections = [
        { text: buildConsoleSection(session.consoleLogs || []), priority: 4 },
        { text: buildNetworkSection(session.networkLogs || []), priority: 3 },
        { text: buildPageEventSection(session.pageEvents || []), priority: 2 }
    ]
        .filter(s => s.text)
        .sort((a, b) => b.priority - a.priority);

    const parts: string[] = [];
    let used = 0;
    for (const section of sections) {
        const chunk = section.text;
        if (used + chunk.length + 2 > detailBudget) {
            if (!parts.length) {
                // 连第一段都放不下：兜底截断后仍保留
                parts.push(truncate(chunk, detailBudget));
            }
            break;
        }
        parts.push(chunk);
        used += chunk.length + 2;
    }

    const full = [envText, ...parts].join('\n\n');
    return full.length > AI_CONTEXT_BUDGET ? `${full.slice(0, AI_CONTEXT_BUDGET)}…` : full;
}
