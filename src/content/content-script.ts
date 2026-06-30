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
                break;

            case 'RECORDING_RESUMED':
                this.recorder.resume();
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

            // 显示标注工具栏
            this.annotator = new Annotator({
                sessionId: this.currentSession.id,
                onChange: (annotations) => {
                    if (this.currentSession) {
                        this.currentSession.annotations = annotations;
                    }
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

            // 合并标注数据
            session.annotations = this.annotator.getAnnotations();

            // 隐藏标注工具栏
            this.annotator.hide();

            // 发送完整会话数据给 Service Worker 存储
            const message: ContentToBackgroundMessage = {
                action: 'STOP_RECORDING',
                payload: session,
            };
            await browser.runtime.sendMessage(message);

            this.currentSession = null;
        }
        catch (error) {
            console.error(`[${EXTENSION_NAME}] Failed to stop recording:`, error);
        }
    }
}

// 启动 Content Script Controller
void new ContentScriptController();
