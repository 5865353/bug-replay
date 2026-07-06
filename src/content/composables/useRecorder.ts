/**
 * src/content/composables/useRecorder.ts — Recorder composable (hooks pattern)
 *
 * 协调 rrweb 录制、网络拦截、控制台劫持、环境快照
 */

import type { RecordingSession, RecordingStatus } from '@shared/types';
import { EXTENSION_NAME, MAX_RECORDING_DURATION } from '@shared/constants';
import { generateUUID } from '@shared/utils';
import { ConsoleInterceptor } from '../recorder/console-interceptor';
import { EnvironmentCollector } from '../recorder/environment-snapshot';
import { NetworkInterceptor } from '../recorder/network-interceptor';
import { RRWebRecorder } from '../recorder/rrweb-recorder';

export interface RecorderHooks {
    onSessionUpdate?: (session: RecordingSession) => void;
    onStatusChange?: (status: RecordingStatus) => void;
}

export function useRecorder(hooks: RecorderHooks = {}) {
    let session: RecordingSession | null = null;
    let rrwebRecorder: RRWebRecorder | null = null;
    let networkInterceptor: NetworkInterceptor | null = null;
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

        // Start sub-modules
        rrwebRecorder = new RRWebRecorder({
            onEvent: (event) => {
                if (session) session.events.push(event);
            },
            maskAllInputs: true,
        });
        await rrwebRecorder.start();

        networkInterceptor = new NetworkInterceptor({
            onLog: (log) => {
                if (session) session.networkLogs.push(log);
            },
        });
        networkInterceptor.start();

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
        networkInterceptor?.stop();
        networkInterceptor = null;
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
