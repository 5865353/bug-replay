// ============================================================
// src/content/recorder/index.ts — Recorder 统一入口
// ============================================================

import type { RecordingSession, RecordingStatus } from '@shared/types';
import { EXTENSION_NAME, MAX_RECORDING_DURATION } from '@shared/constants';
import { generateUUID } from '@shared/utils';
import { ConsoleInterceptor } from './console-interceptor';
import { EnvironmentCollector } from './environment-snapshot';
import { NetworkInterceptor } from './network-interceptor';
import { RRWebRecorder } from './rrweb-recorder';

/**
 * Recorder 控制器 — 协调 rrweb 录制、网络拦截、控制台劫持、环境快照
 */
export class Recorder {
    private session: RecordingSession | null = null;
    private rrwebRecorder: RRWebRecorder | null = null;
    private networkInterceptor: NetworkInterceptor | null = null;
    private consoleInterceptor: ConsoleInterceptor | null = null;
    private maxDurationTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * 开始录制
     */
    async start(): Promise<RecordingSession> {
        if (this.session && this.session.status === 'recording') {
            throw new Error('Recording is already in progress');
        }

        // 如果处于暂停状态，则恢复
        if (this.session && this.session.status === 'paused') {
            this.resume();
            return this.session;
        }

        // 创建新会话
        this.session = this.createEmptySession();

        // 1. 采集环境快照（最先执行，确保拿到初始状态）
        this.session.environment = EnvironmentCollector.collect();

        // 2. 启动 rrweb DOM 录制
        this.rrwebRecorder = new RRWebRecorder({
            onEvent: (event) => {
                if (this.session) {
                    this.session.events.push(event);
                }
            },
            maskAllInputs: true,
        });
        await this.rrwebRecorder.start();

        // 3. 启动网络拦截
        this.networkInterceptor = new NetworkInterceptor({
            onLog: (log) => {
                if (this.session) {
                    this.session.networkLogs.push(log);
                }
            },
        });
        this.networkInterceptor.start();

        // 4. 启动控制台劫持
        this.consoleInterceptor = new ConsoleInterceptor({
            onLog: (log) => {
                if (this.session) {
                    // 对齐 rrweb 事件序号
                    log.rrwebEventIndex = this.rrwebRecorder?.eventTotal ?? 0;
                    this.session.consoleLogs.push(log);
                }
            },
        });
        this.consoleInterceptor.start();

        // 5. 设置最大录制时长（30 分钟自动停止）
        this.maxDurationTimer = setTimeout(() => {
            if (this.session?.status === 'recording') {
                console.warn(
                    `[${EXTENSION_NAME}] Max recording duration reached (${MAX_RECORDING_DURATION / 60000}min), auto-stopping...`,
                );
                this.stop();
            }
        }, MAX_RECORDING_DURATION);

        console.log(`[${EXTENSION_NAME}] Recording started: ${this.session.id}`);
        return this.session;
    }

    /**
     * 暂停录制（仅暂停 rrweb，网络和 console 继续采集）
     */
    pause(): void {
        if (!this.session || this.session.status !== 'recording') return;

        this.rrwebRecorder?.stop();
        this.session.status = 'paused';
        if (this.maxDurationTimer) {
            clearTimeout(this.maxDurationTimer);
            this.maxDurationTimer = null;
        }
        console.log(`[${EXTENSION_NAME}] Recording paused`);
    }

    /**
     * 恢复录制
     */
    async resume(): Promise<void> {
        if (!this.session || this.session.status !== 'paused') return;

        this.session.status = 'recording';
        await this.rrwebRecorder?.start();

        // 重设最大时长计时器
        const elapsed = Date.now() - this.session.startTime;
        const remaining = MAX_RECORDING_DURATION - elapsed;
        if (remaining > 0) {
            this.maxDurationTimer = setTimeout(() => {
                if (this.session?.status === 'recording') {
                    this.stop();
                }
            }, remaining);
        }

        console.log(`[${EXTENSION_NAME}] Recording resumed`);
    }

    /**
     * 停止录制，返回完整会话数据
     */
    async stop(): Promise<RecordingSession> {
        if (!this.session) {
            throw new Error('No active recording session');
        }

        // 停止所有子模块
        this.rrwebRecorder?.stop();
        this.rrwebRecorder = null;

        this.networkInterceptor?.stop();
        this.networkInterceptor = null;

        this.consoleInterceptor?.stop();
        this.consoleInterceptor = null;

        if (this.maxDurationTimer) {
            clearTimeout(this.maxDurationTimer);
            this.maxDurationTimer = null;
        }

        // 更新结束时间
        this.session.status = 'stopped';
        this.session.endTime = Date.now();

        const session = { ...this.session };
        this.session = null;

        console.log(
            `[${EXTENSION_NAME}] Recording stopped: ${session.id} (${session.events.length} events, ${session.networkLogs.length} network, ${session.consoleLogs.length} console)`,
        );
        return session;
    }

    /**
     * 获取当前录制状态
     */
    getStatus(): RecordingStatus {
        return this.session?.status || 'idle';
    }

    /**
     * 获取当前会话（只读引用）
     */
    getSession(): Readonly<RecordingSession> | null {
        return this.session;
    }

    /**
     * 创建空白会话
     */
    private createEmptySession(): RecordingSession {
        return {
            id: generateUUID(),
            title: `${document.title || 'Untitled'} - ${new Date().toLocaleString()}`,
            status: 'recording',
            startTime: Date.now(),
            events: [],
            networkLogs: [],
            consoleLogs: [],
            annotations: [],
            environment: null,
            tags: [],
        };
    }
}
