/**
 * src/content/content-script.ts — Content Script 主入口
 *
 * 注入到目标页面的脚本，负责：
 * 1. 接收 Service Worker 的录制控制指令
 * 2. 协调 Recorder 和 Annotator 模块
 * 3. 将录制数据实时发送给 Service Worker 持久化
 *
 * 使用 document_start 时机注入，确保尽早拦截网络和控制台
 */

import type {
    BackgroundToContentMessage,
    ContentToBackgroundMessage,
    RecordingSession,
} from '@shared/types';

import { EXTENSION_NAME } from '@shared/constants';
import browser from 'webextension-polyfill';
import { Annotator } from './annotator/index';
import { Recorder } from './recorder/index';

class ContentScriptController {
    private recorder: Recorder;
    private annotator: Annotator;
    private currentSession: RecordingSession | null = null;

    constructor() {
        this.recorder = new Recorder();
        this.annotator = new Annotator({
            sessionId: '',
            onChange: (annotations) => {
                if (this.currentSession) {
                    this.currentSession.annotations = annotations;
                }
            },
        });

        this.init();
    }

    /**
     * 初始化：监听 Service Worker 消息
     */
    private init(): void {
        browser.runtime.onMessage.addListener(
            (message: unknown) => {
                const msg = message as BackgroundToContentMessage;
                console.log(`[${EXTENSION_NAME}] CS received: ${msg.action}`);
                this.handleMessage(msg);
                // 返回 undefined 表示异步响应（Manifest V3）
                return undefined;
            },
        );

        console.log(`[${EXTENSION_NAME}] Content script initialized`);
    }

    /**
     * 处理来自 Service Worker 的消息
     */
    private async handleMessage(message: BackgroundToContentMessage): Promise<void> {
        switch (message.action) {
            case 'RECORDING_STARTED':
                await this.startRecording();
                break;

            case 'RECORDING_STOPPED':
                await this.stopRecording();
                break;

            case 'RECORDING_PAUSED':
                this.recorder.pause();
                this.annotator.setPaused();
                break;

            case 'RECORDING_RESUMED':
                this.recorder.resume();
                this.annotator.setResumed();
                break;

            default:
                break;
        }
    }

    /**
     * 开始录制
     */
    private async startRecording(): Promise<void> {
        try {
            this.currentSession = await this.recorder.start();

            // 创建标注器并显示——工具栏同时包含录制控制和标注工具
            this.annotator = new Annotator({
                sessionId: this.currentSession.id,
                onChange: (annotations) => {
                    if (this.currentSession) {
                        this.currentSession.annotations = annotations;
                    }
                },
                onPause: () => {
                    this.recorder.pause();
                    browser.runtime.sendMessage({ action: 'PAUSE_RECORDING' }).catch(() => {});
                },
                onResume: () => {
                    this.recorder.resume();
                    browser.runtime.sendMessage({ action: 'RESUME_RECORDING' }).catch(() => {});
                },
                onStop: async () => {
                    await this.stopRecording();
                },
            });
            this.annotator.show();
        }
        catch (error) {
            console.error(`[${EXTENSION_NAME}] Failed to start recording:`, error);
        }
    }

    /**
     * 停止录制
     */
    private async stopRecording(): Promise<void> {
        try {
            const session = await this.recorder.stop();
            session.annotations = this.annotator.getAnnotations();
            this.annotator.hide();

            // 通过 chrome.storage 传递大体积数据，避免 sendMessage 大小限制
            const key = `temp_session_${session.id}`;
            await browser.storage.local.set({ [key]: session });

            // 通知 SW 读取并存储
            await browser.runtime.sendMessage({
                action: 'STOP_RECORDING',
                payload: { sessionId: session.id },
            });

            this.currentSession = null;
        }
        catch (error) {
            console.error(`[${EXTENSION_NAME}] Failed to stop recording:`, error);
        }
    }
}

// 启动 Content Script Controller
void new ContentScriptController();
