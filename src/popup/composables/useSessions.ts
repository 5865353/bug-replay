import type { BackgroundToContentMessage, RecordingSessionSummary } from '@shared/types';
import { BackgroundToContentAction, ContentToBackgroundAction } from '@shared/types';
import { ref } from 'vue';
import browser from 'webextension-polyfill';

export function useSessions() {
    const sessions = ref<RecordingSessionSummary[]>([]);

    async function loadSessions() {
        try {
            const response = await browser.runtime.sendMessage({
                action: ContentToBackgroundAction.GET_SESSIONS,
            });
            const typedResponse = response as BackgroundToContentMessage;

            if (typedResponse.action === BackgroundToContentAction.SESSIONS_LIST) {
                sessions.value = (typedResponse.payload as RecordingSessionSummary[]) || [];
            }
        }
        catch {
            // SW may not be ready
        }
    }

    async function deleteSession(sessionId: string) {
        await browser.runtime.sendMessage({
            action: ContentToBackgroundAction.DELETE_SESSION,
            payload: { sessionId },
        });
        await loadSessions();
    }

    // Reload sessions when recording stops
    browser.runtime.onMessage.addListener((message: unknown) => {
        const msg = message as BackgroundToContentMessage;
        if (msg.action === BackgroundToContentAction.RECORDING_STOPPED) {
            loadSessions();
        }
    });

    return { sessions, loadSessions, deleteSession };
}
