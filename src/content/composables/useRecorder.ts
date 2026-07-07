/**
 * src/content/composables/useRecorder.ts — Recorder composable (hooks pattern)
 *
 * 协调 rrweb 录制、网络拦截、控制台劫持、环境快照
 *
 * 网络拦截由 content-script.ts 在 document_start 时全局启动，
 * 录制开始时通过 onBeforeStart 回调 flush 缓冲日志到 session。
 */

import type { NetworkLog, RecordingSession, RecordingStatus } from '@shared/types';
import { EXTENSION_NAME, MAX_RECORDING_DURATION } from '@shared/constants';
import { generateUUID } from '@shared/utils';
import { ConsoleInterceptor } from '../recorder/console-interceptor';
import { EnvironmentCollector } from '../recorder/environment-snapshot';
import { RRWebRecorder } from '../recorder/rrweb-recorder';

export interface RecorderHooks {
    onSessionUpdate?: (session: RecordingSession) => void;
    onStatusChange?: (status: RecordingStatus) => void;
    /** 录制开始前回调 — 用于 flush 网络拦截缓冲 */
    onBeforeStart?: () => NetworkLog[];
    /** 录制期间实时网络日志回调 */
    onNetworkLog?: (log: NetworkLog) => void;
}

export function useRecorder(hooks: RecorderHooks = {}) {
    let session: RecordingSession | null = null;
    let rrwebRecorder: RRWebRecorder | null = null;
    let consoleInterceptor: ConsoleInterceptor | null = null;
    let maxDurationTimer: ReturnType<typeof setTimeout> | null = null;

    async function start(): Promise<RecordingSession> {
        if (session && session.status === 'recording') {
            throw new Error('Recording is already in progress');
        }

        if (session && session.status === 'paused') {
            resume();
            return session;
        }

        session = createEmptySession();
        session.environment = EnvironmentCollector.collect();

        // 把 document_start 起缓冲的网络日志刷入 session
        if (hooks.onBeforeStart) {
            const bufferedLogs = hooks.onBeforeStart();
            session.networkLogs = bufferedLogs;
        }

        // Start sub-modules
        rrwebRecorder = new RRWebRecorder({
            onEvent: (event) => {
                if (session) session.events.push(event);
            },
            maskAllInputs: true,
        });
        await rrwebRecorder.start();

        consoleInterceptor = new ConsoleInterceptor({
            onLog: (log) => {
                if (session) {
                    log.rrwebEventIndex = rrwebRecorder?.eventTotal ?? 0;
                    session.consoleLogs.push(log);
                }
            },
        });
        consoleInterceptor.start();

        // Max duration timer
        maxDurationTimer = setTimeout(() => {
            if (session?.status === 'recording') {
                console.warn(`[${EXTENSION_NAME}] Max duration reached, auto-stopping...`);
                stop();
            }
        }, MAX_RECORDING_DURATION);

        hooks.onStatusChange?.(session.status);
        console.log(`[${EXTENSION_NAME}] Recording started: ${session.id}`);
        return session;
    }

    function pause(): void {
        if (!session || session.status !== 'recording') return;
        rrwebRecorder?.stop();
        session.status = 'paused';
        if (maxDurationTimer) {
            clearTimeout(maxDurationTimer);
            maxDurationTimer = null;
        }
        hooks.onStatusChange?.(session.status);
        console.log(`[${EXTENSION_NAME}] Recording paused`);
    }

    async function resume(): Promise<void> {
        if (!session || session.status !== 'paused') return;
        session.status = 'recording';
        await rrwebRecorder?.start();

        const elapsed = Date.now() - session.startTime;
        const remaining = MAX_RECORDING_DURATION - elapsed;
        if (remaining > 0) {
            maxDurationTimer = setTimeout(() => {
                if (session?.status === 'recording') stop();
            }, remaining);
        }

        hooks.onStatusChange?.(session.status);
        console.log(`[${EXTENSION_NAME}] Recording resumed`);
    }

    async function stop(): Promise<RecordingSession> {
        if (!session) throw new Error('No active recording session');

        rrwebRecorder?.stop();
        rrwebRecorder = null;
        consoleInterceptor?.stop();
        consoleInterceptor = null;
        if (maxDurationTimer) {
            clearTimeout(maxDurationTimer);
            maxDurationTimer = null;
        }

        session.status = 'stopped';
        session.endTime = Date.now();

        const result = { ...session };
        session = null;

        hooks.onStatusChange?.('idle');
        console.log(`[${EXTENSION_NAME}] Recording stopped: ${result.id}`);
        return result;
    }

    function getStatus(): RecordingStatus {
        return session?.status || 'idle';
    }

    function getSession(): Readonly<RecordingSession> | null {
        return session;
    }

    function createEmptySession(): RecordingSession {
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

    return { start, pause, resume, stop, getStatus, getSession };
}
