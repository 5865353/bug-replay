import type { BackgroundToContentMessage } from '@shared/types';
import { ref } from 'vue';
import browser from 'webextension-polyfill';

export function useRecording() {
    const isRecording = ref(false);
    const isPaused = ref(false);
    const activeSessionId = ref<string | null>(null);

    async function initStatus() {
        try {
            const response: BackgroundToContentMessage = await browser.runtime.sendMessage({
                action: 'GET_RECORDING_STATUS',
            });
            if (response.action === 'RECORDING_STATUS') {
                const status = response.payload as { isRecording: boolean; isPaused: boolean };
                if (status.isRecording) {
                    isRecording.value = true;
                    isPaused.value = status.isPaused;
                }
            }
        }
        catch {
            // SW may not be ready yet
        }
    }

    async function toggleRecording() {
        if (isRecording.value) return;

        try {
            await browser.runtime.sendMessage({ action: 'START_RECORDING' });
            isRecording.value = true;
            isPaused.value = false;
            activeSessionId.value = null;
        }
        catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[BugReplay] START_RECORDING failed:', msg);
        }
    }

    // Listen for state changes from SW
    browser.runtime.onMessage.addListener((message: unknown) => {
        const msg = message as BackgroundToContentMessage;

        if (msg.action === 'RECORDING_STOPPED') {
            isRecording.value = false;
            isPaused.value = false;
            if (msg.payload) {
                const p = msg.payload as { sessionId?: string };
                if (p.sessionId) activeSessionId.value = p.sessionId;
            }
        }
        if (msg.action === 'RECORDING_PAUSED') {
            isPaused.value = true;
        }
        if (msg.action === 'RECORDING_RESUMED') {
            isPaused.value = false;
        }
    });

    return { isRecording, isPaused, activeSessionId, toggleRecording, initStatus };
}
