/**
 * src/content/content-script.ts — Content Script 主入口
 *
 * 注入到目标页面的脚本，使用 composable (hooks) 模式协调各模块。
 * 负责：
 * 1. 接收 Service Worker 的录制控制指令
 * 2. 协调 Recorder 和 Annotator 模块
 * 3. 将录制数据实时发送给 Service Worker 持久化
 *
 * 使用 document_start 时机注入，确保尽早拦截网络和控制台
 */

import type { BackgroundToContentMessage, NetworkLog, PageEvent, RecordingSession } from '@shared/types';

import { EXTENSION_NAME } from '@shared/constants';
import { BackgroundToContentAction, ContentToBackgroundAction } from '@shared/types';
import browser from 'webextension-polyfill';
import { useAnnotator } from './composables/useAnnotator';
import { useRecorder } from './composables/useRecorder';
import {
    INTERCEPTOR_SCRIPT_PATH,
    PM_ACTION_START,
    PM_ACTION_STOP,
    PM_SOURCE_CONTROL,
    PM_SOURCE_NETWORK,
    PM_SOURCE_PAGE_EVENT,
    PM_TARGET_ORIGIN,
    STORAGE_KEY_PREFIX,
} from './constants';

// ============================================================
// 页面主世界拦截器（注入 <script> 到页面 DOM）
// ============================================================

const networkBuffer: NetworkLog[] = [];
let networkLogCallback: ((log: NetworkLog) => void) | null = null;

const pageEventBuffer: PageEvent[] = [];
let pageEventCallback: ((e: PageEvent) => void) | null = null;

/** 每次 flush 的存储 key 前缀 */
const FLUSH_KEY_PREFIX = `${STORAGE_KEY_PREFIX}chunk_`;

/** 每 30 秒自动 flush 一次 */
const FLUSH_INTERVAL_MS = 30000;

/** rrweb 事件数达到此阈值触发 flush */
const FLUSH_EVENT_THRESHOLD = 5000;
function sendInterceptorControl(action: typeof PM_ACTION_START | typeof PM_ACTION_STOP): void {
    window.postMessage({ source: PM_SOURCE_CONTROL, action }, PM_TARGET_ORIGIN);
}

// 监听注入脚本发回的 postMessage（网络 + 页面事件）
window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data?.source === PM_SOURCE_NETWORK) {
        const log = event.data.payload as NetworkLog;
        if (networkLogCallback) {
            networkLogCallback(log);
        }
        else { networkBuffer.push(log); }
    }

    if (event.data?.source === PM_SOURCE_PAGE_EVENT) {
        const ev = event.data.payload as PageEvent;
        if (pageEventCallback) {
            pageEventCallback(ev);
        }
        else { pageEventBuffer.push(ev); }
    }
});

// 注入拦截脚本到页面主世界（通过 <script src>，不违反 CSP）
// document_start 立即注入骨架；脚本内部有 _isRecording 守卫，只在录制时产生日志
function injectNetworkInterceptor(): void {
    const script = document.createElement('script');
    script.src = browser.runtime.getURL(INTERCEPTOR_SCRIPT_PATH);
    (document.head || document.documentElement).appendChild(script);
}

// document_start 立即注入
injectNetworkInterceptor();

// ============================================================
// useContentScript — 主 composable
// ============================================================

function useContentScript() {
    let currentSession: RecordingSession | null = null;
    let flushTimer: ReturnType<typeof setInterval> | null = null;
    /** 当前 session 已 flush 的 chunk 计数 */
    let chunkIndex = 0;

    /** 将当前 session 的大数组刷到 chrome.storage.local，清空内存 */
    async function flushSessionToStorage(): Promise<void> {
        if (!currentSession || currentSession.status !== 'recording') return;

        const sessionId = currentSession.id;
        const chunk = {
            events: currentSession.events.splice(0),
            networkLogs: currentSession.networkLogs.splice(0),
            consoleLogs: currentSession.consoleLogs.splice(0),
            pageEvents: currentSession.pageEvents.splice(0),
        };

        // 跳过空 flush
        if (chunk.events.length === 0
            && chunk.networkLogs.length === 0
            && chunk.consoleLogs.length === 0
            && chunk.pageEvents.length === 0) {
            return;
        }

        const key = `${FLUSH_KEY_PREFIX}${sessionId}_${chunkIndex++}`;
        await browser.storage.local.set({ [key]: chunk });

        console.log(
            `[${EXTENSION_NAME}] Flushed chunk #${chunkIndex - 1}: `
            + `events=${chunk.events.length} network=${chunk.networkLogs.length} `
            + `console=${chunk.consoleLogs.length} pageEvents=${chunk.pageEvents.length}`,
        );
    }

    const recorder = useRecorder({
        onBeforeStart: () => {
            // 重置 chunk 计数
            chunkIndex = 0;

            // 网络日志回调
            networkLogCallback = (log) => {
                if (currentSession) currentSession.networkLogs.push(log);
            };
            // 页面事件回调
            pageEventCallback = (ev) => {
                if (currentSession) currentSession.pageEvents.push(ev);
            };
            // flush 缓冲区
            const flushed = [...networkBuffer];
            networkBuffer.length = 0;
            for (const log of flushed) {
                if (currentSession) currentSession.networkLogs.push(log);
            }
            for (const ev of pageEventBuffer) {
                if (currentSession) currentSession.pageEvents.push(ev);
            }
            pageEventBuffer.length = 0;
            return flushed;
        },
        /** rrweb 事件数达到阈值时触发 flush */
        onEventThreshold: () => {
            flushSessionToStorage().catch((err) => {
                console.error(`[${EXTENSION_NAME}] Flush failed:`, err);
            });
        },
    });
    const annotator = useAnnotator({
        sessionId: '',
        onChange: (annotations) => {
            if (currentSession) currentSession.annotations = annotations;
        },
    });

    // ---- 消息处理 ----

    function init(): void {
        browser.runtime.onMessage.addListener((message: unknown) => {
            const msg = message as BackgroundToContentMessage;
            console.log(`[${EXTENSION_NAME}] CS received: ${msg.action}`);
            handleMessage(msg);
            return undefined;
        });

        console.log(`[${EXTENSION_NAME}] Content script initialized`);
    }

    async function handleMessage(message: BackgroundToContentMessage): Promise<void> {
        switch (message.action) {
            case BackgroundToContentAction.RECORDING_STARTED:
                await startRecording(message.payload);
                break;
            case BackgroundToContentAction.RECORDING_STOPPED:
                await stopRecording();
                break;
            case BackgroundToContentAction.RECORDING_PAUSED:
                recorder.pause();
                annotator.setPaused();
                break;
            case BackgroundToContentAction.RECORDING_RESUMED:
                recorder.resume();
                annotator.setResumed();
                break;
        }
    }

    async function startRecording(settings?: unknown): Promise<void> {
        try {
            // 通知页面主世界拦截器开始上报
            sendInterceptorControl(PM_ACTION_START);
            const recSettings = settings as { maskInputs?: boolean; mouseSample?: number; scrollSample?: number; maxDuration?: number } | undefined;
            currentSession = await recorder.start(recSettings);

            // 🔧 启动定时 flush（每 30 秒）
            flushTimer = setInterval(() => {
                flushSessionToStorage().catch((err) => {
                    console.error(`[${EXTENSION_NAME}] Periodic flush failed:`, err);
                });
            }, FLUSH_INTERVAL_MS);

            // Recreate annotator with proper hooks
            const newAnnotator = useAnnotator({
                sessionId: currentSession.id,
                onChange: (annotations) => {
                    if (currentSession) currentSession.annotations = annotations;
                },
                onPause: () => {
                    recorder.pause();
                    browser.runtime.sendMessage({ action: ContentToBackgroundAction.PAUSE_RECORDING }).catch(() => { });
                },
                onResume: () => {
                    recorder.resume();
                    browser.runtime.sendMessage({ action: ContentToBackgroundAction.RESUME_RECORDING }).catch(() => { });
                },
                onStop: async () => {
                    await stopRecording();
                },
            });

            // Replace annotator instance
            Object.assign(annotator, newAnnotator);
            annotator.show(currentSession!.id);
        }
        catch (error) {
            console.error(`[${EXTENSION_NAME}] Failed to start recording:`, error);
        }
    }

    async function stopRecording(): Promise<void> {
        try {
            // 🔧 停止定时 flush
            if (flushTimer) {
                clearInterval(flushTimer);
                flushTimer = null;
            }

            // 通知页面主世界拦截器停止上报
            sendInterceptorControl(PM_ACTION_STOP);
            // 清空缓冲区，避免残留数据
            networkBuffer.length = 0;
            pageEventBuffer.length = 0;

            // 🔧 最终 flush：确保所有数据落盘
            await flushSessionToStorage();

            const session = await recorder.stop();
            session.annotations = annotator.getAnnotations();
            annotator.hide();

            // 🔧 保存 session 元数据（不含大数组）+ chunk 数量，供后台合并
            const { events: _e, networkLogs: _n, consoleLogs: _c, pageEvents: _p, ...metadata } = session;
            const metaKey = `${STORAGE_KEY_PREFIX}${session.id}`;
            await browser.storage.local.set({
                [metaKey]: { ...metadata, chunkCount: chunkIndex },
            });

            await browser.runtime.sendMessage({
                action: ContentToBackgroundAction.STOP_RECORDING,
                payload: { sessionId: session.id },
            });

            currentSession = null;
        }
        catch (error) {
            console.error(`[${EXTENSION_NAME}] Failed to stop recording:`, error);
        }
    }

    // Start listening
    init();
}

// Boot
useContentScript();
