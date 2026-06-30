/**
 * src/popup/popup.ts — Extension Popup 窗口逻辑
 *
 * 负责：
 * 1. 录制控制（开始/暂停/停止）
 * 2. 显示录制状态和计时
 * 3. 历史会话列表
 * 4. 导出 .rrt 文件
 *
 * TODO M6: 实现完整的 Popup UI 交互逻辑
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
const btnPause = document.getElementById('btn-pause') as HTMLButtonElement;
const btnStop = document.getElementById('btn-stop') as HTMLButtonElement;
const btnExport = document.getElementById('btn-export') as HTMLButtonElement;
const statusBadge = document.getElementById('status-badge') as HTMLSpanElement;
const sessionTimer = document.getElementById('session-timer') as HTMLSpanElement;
const sessionTitle = document.getElementById('session-title') as HTMLDivElement;
const currentSessionEl = document.getElementById('current-session') as HTMLDivElement;
const sessionsList = document.getElementById('sessions-list') as HTMLDivElement;

// ============================================================
// 状态
// ============================================================

let timerInterval: ReturnType<typeof setInterval> | null = null;
let recordingStartTime = 0;
let activeSessionId: string | null = null;

// ============================================================
// 事件绑定
// ============================================================

if (btnRecord) btnRecord.addEventListener('click', startRecording);
if (btnPause) btnPause.addEventListener('click', pauseRecording);
if (btnStop) btnStop.addEventListener('click', stopRecording);
if (btnExport) btnExport.addEventListener('click', exportRRT);

// ============================================================
// 录制控制
// ============================================================

async function startRecording(): Promise<void> {
    try {
        console.log('[BugReplay] Popup: sending START_RECORDING...');
        await browser.runtime.sendMessage({ action: 'START_RECORDING' });
        console.log('[BugReplay] Popup: START_RECORDING acknowledged');
    }
    catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[BugReplay] Popup: START_RECORDING failed:', msg);
        if (statusBadge) {
            statusBadge.textContent = '启动失败';
            statusBadge.className = 'status-badge status-idle';
        }
        return;
    }

    setUIState('recording');
    startTimer();

    // 查询当前活跃 tab 的标题
    try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.title && sessionTitle) {
            sessionTitle.textContent = tabs[0].title;
        }
    }
    catch {
        // tabs query may fail if no permissions, ignore
    }
}

async function pauseRecording(): Promise<void> {
    try {
        await browser.runtime.sendMessage({ action: 'PAUSE_RECORDING' });
    }
    catch (err) {
        console.error('[BugReplay] Popup: PAUSE_RECORDING failed:', err);
        return;
    }
    setUIState('paused');
    stopTimer();
}

async function stopRecording(): Promise<void> {
    try {
        await browser.runtime.sendMessage({ action: 'STOP_RECORDING' });
    }
    catch (err) {
        console.error('[BugReplay] Popup: STOP_RECORDING failed:', err);
        return;
    }
    setUIState('idle');
    stopTimer();
    if (currentSessionEl) currentSessionEl.style.display = 'none';
    loadSessions();
}

async function exportRRT(): Promise<void> {
    if (!activeSessionId) {
        // Pick the most recent session if none is active
        const response: BackgroundToContentMessage = await browser.runtime.sendMessage({ action: 'GET_SESSIONS' });
        if (response.action === 'SESSIONS_LIST') {
            const sessions = response.payload as RecordingSessionSummary[];
            if (sessions.length > 0) {
                activeSessionId = sessions[sessions.length - 1].id;
            }
        }
    }
    if (activeSessionId) {
        await browser.runtime.sendMessage({
            action: 'EXPORT_RRT',
            payload: { sessionId: activeSessionId },
        });
    }
}

// ============================================================
// UI 状态管理
// ============================================================

function setUIState(state: 'idle' | 'recording' | 'paused'): void {
    switch (state) {
        case 'idle':
            if (btnRecord) btnRecord.disabled = false;
            if (btnPause) btnPause.disabled = true;
            if (btnStop) btnStop.disabled = true;
            if (btnExport) btnExport.disabled = true;
            if (statusBadge) {
                statusBadge.textContent = '就绪';
                statusBadge.className = 'status-badge status-idle';
            }
            break;
        case 'recording':
            if (btnRecord) btnRecord.disabled = true;
            if (btnPause) btnPause.disabled = false;
            if (btnStop) btnStop.disabled = false;
            if (btnExport) btnExport.disabled = true;
            if (statusBadge) {
                statusBadge.textContent = '录制中';
                statusBadge.className = 'status-badge status-recording';
            }
            if (currentSessionEl) currentSessionEl.style.display = 'block';
            break;
        case 'paused':
            if (btnRecord) btnRecord.disabled = true;
            if (btnPause) btnPause.disabled = true;
            if (btnStop) btnStop.disabled = false;
            if (btnExport) btnExport.disabled = true;
            if (statusBadge) {
                statusBadge.textContent = '已暂停';
                statusBadge.className = 'status-badge status-paused';
            }
            break;
    }
}

function startTimer(): void {
    recordingStartTime = Date.now();
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

function stopTimer(): void {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimer(): void {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    if (sessionTimer) {
        sessionTimer.textContent
            = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
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
          <div class="session-item">
            <div class="session-item-title">${escapeHtml(s.title)}</div>
            <div class="session-item-time">${new Date(s.startTime).toLocaleString()}</div>
          </div>
        `,
                        )
                        .join('');
                }
                if (btnExport) btnExport.disabled = false;
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
loadSessions();
