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

import type { BackgroundToContentMessage, RecordingSession } from '@shared/types';
import type { NetworkLog } from '@shared/types';
import { EXTENSION_NAME } from '@shared/constants';
import { BackgroundToContentAction, ContentToBackgroundAction } from '@shared/types';
import browser from 'webextension-polyfill';
import { useAnnotator } from './composables/useAnnotator';
import { useRecorder } from './composables/useRecorder';

// ============================================================
// 页面主世界网络拦截（注入 <script> 到页面 DOM，拦截页面的 XHR/fetch）
// Content script 隔离世界无法拦截页面的网络请求！
// ============================================================

// 缓冲录制开始前的网络日志
const networkBuffer: NetworkLog[] = [];
let networkLogCallback: ((log: NetworkLog) => void) | null = null;

// 监听注入脚本发回的 postMessage
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.source !== 'bugreplay-network') return;

    const log = event.data.payload as NetworkLog;
    if (networkLogCallback) {
        networkLogCallback(log);
    }
    else {
        networkBuffer.push(log);
    }
});

// 注入拦截脚本到页面主世界（通过 <script src>，不违反 CSP）
function injectNetworkInterceptor(): void {
    const script = document.createElement('script');
    script.src = browser.runtime.getURL('src/content/recorder/page-interceptor.js');
    (document.head || document.documentElement).appendChild(script);
}

// document_start 立即注入
injectNetworkInterceptor();

// ============================================================
// useContentScript — 主 composable
// ============================================================

function useContentScript() {
    let currentSession: RecordingSession | null = null;

    const recorder = useRecorder({
        // 录制开始时：flush 缓冲的网络日志 → session
        onBeforeStart: () => {
            // 之后的新日志实时回调
            networkLogCallback = (log) => {
                if (currentSession) currentSession.networkLogs.push(log);
            };
            // 回放缓冲区中的旧日志
            const flushed = [...networkBuffer];
            networkBuffer.length = 0;
            for (const log of flushed) {
                if (currentSession) currentSession.networkLogs.push(log);
            }
            return flushed;
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
                await startRecording();
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

    async function startRecording(): Promise<void> {
        try {
            currentSession = await recorder.start();

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
            const session = await recorder.stop();
            session.annotations = annotator.getAnnotations();
            annotator.hide();

            // Use chrome.storage for large data (avoids sendMessage size limit)
            const key = `temp_session_${session.id}`;
            await browser.storage.local.set({ [key]: session });

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
