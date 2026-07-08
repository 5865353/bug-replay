/**
 * src/upload/composables/useUpload.ts — 上传逻辑 hooks
 */
import type { BackgroundToContentMessage, RecordingSession } from '@shared/types';
import { ContentToBackgroundAction } from '@shared/types';
import { showToast } from 'vant';
import { computed, onMounted, ref } from 'vue';
import browser from 'webextension-polyfill';
import type { UploadSettings } from '../constants';
import { AI_SYSTEM_PROMPT, DEFAULT_SETTINGS, TOAST_AI_FAIL, TOAST_AI_OK, TOAST_NETWORK_ERROR } from '../constants';

export function useUpload() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('sessionId') || '';
    const initialTitle = decodeURIComponent(params.get('title') || '');

    const settings = ref<UploadSettings>({ ...DEFAULT_SETTINGS });
    const sessionInfo = ref<RecordingSession | null>(null);
    const platform = ref<'jira' | 'zentao' | ''>('');
    const title = ref(initialTitle);
    const description = ref('');
    const submitting = ref(false);
    const generatingAi = ref(false);

    const hasAi = computed(() => !!settings.value.aiProvider && !!settings.value.aiApiKey);

    onMounted(async () => {
        const s = await browser.storage.local.get('bugreplay_settings');
        if (s.bugreplay_settings) Object.assign(settings.value, s.bugreplay_settings);
        if (settings.value.jiraEnabled) platform.value = 'jira';
        else if (settings.value.zentaoEnabled) platform.value = 'zentao';

        if (sessionId) {
            const resp = await browser.runtime.sendMessage({
                action: ContentToBackgroundAction.GET_SESSION,
                payload: { sessionId },
            }) as BackgroundToContentMessage;
            if (resp.payload) sessionInfo.value = resp.payload as RecordingSession;
        }
    });

    async function generateDescription(): Promise<void> {
        if (!hasAi.value || !sessionInfo.value) return;
        generatingAi.value = true;
        try {
            const ctx = [
                `页面: ${sessionInfo.value.environment?.url || '未知'}`,
                `标题: ${sessionInfo.value.title}`,
                `网络请求: ${sessionInfo.value.networkLogs?.length || 0} 条`,
                `控制台日志: ${sessionInfo.value.consoleLogs?.length || 0} 条`,
            ].join('\n');

            const resp = await fetch(`${settings.value.aiBaseUrl}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.value.aiApiKey}` },
                body: JSON.stringify({
                    model: settings.value.aiModel,
                    messages: [{ role: 'system', content: AI_SYSTEM_PROMPT }, { role: 'user', content: ctx }],
                }),
            });
            const data = await resp.json();
            description.value = (data.choices?.[0]?.message?.content || '').trim();
            showToast({ message: TOAST_AI_OK, duration: 1500 });
        } catch {
            showToast({ message: TOAST_AI_FAIL, duration: 2000 });
        } finally {
            generatingAi.value = false;
        }
    }

    async function submit(): Promise<void> {
        if (!sessionId || !platform.value) return;
        submitting.value = true;
        try {
            const cfg: Record<string, unknown> = platform.value === 'jira'
                ? { baseUrl: settings.value.jiraBaseUrl, email: settings.value.jiraEmail, apiToken: settings.value.jiraApiToken, projectKey: settings.value.jiraProjectKey }
                : { baseUrl: settings.value.zentaoBaseUrl, apiToken: settings.value.zentaoApiToken, productId: Number(settings.value.zentaoProductId) || 0 };

            const resp = await browser.runtime.sendMessage({
                action: ContentToBackgroundAction.SUBMIT_TO_PLATFORM,
                payload: { sessionId, platform: platform.value, config: cfg },
            }) as BackgroundToContentMessage;

            if (resp.action === 'SESSION_UPDATED') {
                const r = resp.payload as { issueUrl?: string };
                showToast({ message: r.issueUrl ? `已提交: ${r.issueUrl}` : '提交成功', duration: 4000 });
                setTimeout(() => window.close(), 2000);
            } else {
                showToast({ message: `失败: ${resp.payload || '未知错误'}`, duration: 3000 });
            }
        } catch (err: unknown) {
            showToast({ message: `失败: ${err instanceof Error ? err.message : TOAST_NETWORK_ERROR}`, duration: 3000 });
        } finally {
            submitting.value = false;
        }
    }

    return { settings, sessionInfo, platform, title, description, submitting, generatingAi, hasAi, generateDescription, submit };
}
