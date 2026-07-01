/**
 * src/popup/popup.ts — Extension Popup 窗口逻辑
 *
 * Popup 仅作为启动器和会话列表：
 * 1. 点击"开始录制"启动录制，之后工具栏注入页面
 * 2. 显示历史会话列表
 * 3. 导出 .rrt 文件
 */

import type {
    BackgroundToContentMessage,
    RecordingSessionSummary,
} from '@shared/types';

import { EXTENSION_NAME } from '@shared/constants';
import browser from 'webextension-polyfill';

// ============================================================
// DOM 引用
// ============================================================

const btnRecord = document.getElementById('btn-record') as HTMLButtonElement;
const btnExport = document.getElementById('btn-export') as HTMLButtonElement;
const btnClipboard = document.getElementById('btn-clipboard') as HTMLButtonElement;
const sessionsList = document.getElementById('sessions-list') as HTMLDivElement;

// ============================================================
// 状态
// ============================================================

let isRecording = false;
let isPaused = false;
let activeSessionId: string | null = null;

// ============================================================
// 事件绑定
// ============================================================

if (btnRecord) btnRecord.addEventListener('click', startRecording);
if (btnExport) btnExport.addEventListener('click', exportRRT);
if (btnClipboard) btnClipboard.addEventListener('click', copyToClipboard);

// 打开回放页面
const btnReplay = document.getElementById('btn-replay') as HTMLButtonElement;
if (btnReplay) {
    btnReplay.addEventListener('click', () => {
        browser.tabs.create({ url: browser.runtime.getURL('src/replayer/index.html') });
    });
}

// 监听 SW 推送的录制状态变更
browser.runtime.onMessage.addListener(onRecordingStateChange);

// ============================================================
// 初始化：查询当前录制状态
// ============================================================

async function initRecordingStatus(): Promise<void> {
    try {
        const response: BackgroundToContentMessage = await browser.runtime.sendMessage({ action: 'GET_RECORDING_STATUS' });
        if (response.action === 'RECORDING_STATUS') {
            const status = response.payload as { isRecording: boolean; isPaused: boolean };
            if (status.isRecording) {
                isRecording = true;
                isPaused = status.isPaused;
                updateRecordingUI();
            }
        }
    }
    catch { /* SW 可能尚未就绪 */ }
}

// ============================================================
// 录制控制
// ============================================================

async function startRecording(): Promise<void> {
    try {
        await browser.runtime.sendMessage({ action: 'START_RECORDING' });

        isRecording = true;
        isPaused = false;
        activeSessionId = null;
        updateRecordingUI();
    }
    catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[BugReplay] Popup: START_RECORDING failed:', msg);
    }
}

function onRecordingStateChange(message: unknown): void {
    const msg = message as BackgroundToContentMessage;
    if (msg.action === 'RECORDING_STOPPED') {
        isRecording = false;
        isPaused = false;
        resetUI();
        loadSessions();

        if (msg.payload) {
            const p = msg.payload as { sessionId?: string };
            if (p.sessionId) {
                activeSessionId = p.sessionId;
                if (btnExport) btnExport.disabled = false;
                if (btnClipboard) btnClipboard.disabled = false;
            }
        }
    }
    if (msg.action === 'RECORDING_PAUSED') {
        isPaused = true;
        updateRecordingUI();
    }
    if (msg.action === 'RECORDING_RESUMED') {
        isPaused = false;
        updateRecordingUI();
    }
}

function setBtnText(btn: HTMLButtonElement, text: string): void {
    const span = btn.querySelector('span');
    if (span) span.textContent = text;
}

function resetUI(): void {
    if (btnRecord) {
        btnRecord.disabled = false;
        setBtnText(btnRecord, '开始录制');
        btnRecord.style.opacity = '1';
    }
}

function updateRecordingUI(): void {
    if (!isRecording) {
        resetUI();
        return;
    }
    if (btnRecord) {
        btnRecord.disabled = true;
        setBtnText(btnRecord, isPaused ? '已暂停' : '录制中...');
        btnRecord.style.opacity = '0.6';
    }
    if (btnExport) btnExport.disabled = true;
    if (btnClipboard) btnClipboard.disabled = true;
}

async function copyToClipboard(): Promise<void> {
    await ensureActiveSession();
    if (activeSessionId) {
        await browser.runtime.sendMessage({
            action: 'EXPORT_RRT',
            payload: { sessionId: activeSessionId, clipboard: true },
        });
    }
}

async function exportRRT(): Promise<void> {
    await ensureActiveSession();
    if (activeSessionId) {
        await browser.runtime.sendMessage({
            action: 'EXPORT_RRT',
            payload: { sessionId: activeSessionId },
        });
    }
}

async function ensureActiveSession(): Promise<void> {
    if (activeSessionId) return;
    const response: BackgroundToContentMessage = await browser.runtime.sendMessage({ action: 'GET_SESSIONS' });
    if (response.action === 'SESSIONS_LIST') {
        const sessions = response.payload as RecordingSessionSummary[];
        if (sessions.length > 0) activeSessionId = sessions[sessions.length - 1].id;
    }
}

async function deleteSession(sessionId: string): Promise<void> {
    await browser.runtime.sendMessage({
        action: 'DELETE_SESSION',
        payload: { sessionId },
    });
    if (activeSessionId === sessionId) activeSessionId = null;
    loadSessions();
}

// ============================================================
// 会话列表
// ============================================================

async function loadSessions(): Promise<void> {
    try {
        const response = await browser.runtime.sendMessage({
            action: 'GET_SESSIONS',
        });
        const typedResponse = response as BackgroundToContentMessage;

        if (typedResponse.action === 'SESSIONS_LIST') {
            const sessions = typedResponse.payload as RecordingSessionSummary[];
            if (!sessions || sessions.length === 0) {
                if (sessionsList) sessionsList.innerHTML = '<p class="empty-state">暂无录制记录</p>';
            }
            else {
                if (sessionsList) {
                    sessionsList.innerHTML = sessions
                        .map(
                            s => `
          <div class="session-item${s.id === activeSessionId ? ' session-item-selected' : ''}" data-id="${s.id}">
            <div class="session-item-main">
              <div class="session-item-title">${escapeHtml(s.title)}</div>
              <div class="session-item-time">${new Date(s.startTime).toLocaleString()}</div>
            </div>
            <button class="session-item-del" data-del="${s.id}" title="删除">✕</button>
          </div>
        `,
                        )
                        .join('');

                    // 点击选中会话
                    sessionsList.querySelectorAll('.session-item').forEach((item) => {
                        item.addEventListener('click', (e) => {
                            const target = e.target as HTMLElement;
                            if (target.classList.contains('session-item-del')) return;
                            const id = (item as HTMLElement).dataset.id!;
                            activeSessionId = id;
                            if (btnExport) btnExport.disabled = false;
                            if (btnClipboard) btnClipboard.disabled = false;
                            loadSessions(); // 刷新高亮
                        });
                    });

                    // 删除按钮
                    sessionsList.querySelectorAll('.session-item-del').forEach((btn) => {
                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const id = (btn as HTMLElement).dataset.del!;
                            deleteSession(id);
                        });
                    });
                }
                if (btnExport) btnExport.disabled = isRecording || !activeSessionId;
                if (btnClipboard) btnClipboard.disabled = isRecording || !activeSessionId;
            }
        }
    }
    catch (err) {
        console.error('[BugReplay] Popup: loadSessions failed:', err);
    }
}

function escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================================
// 初始化
// ============================================================

console.log(`[${EXTENSION_NAME}] Popup initialized`);
initRecordingStatus();
loadSessions();
