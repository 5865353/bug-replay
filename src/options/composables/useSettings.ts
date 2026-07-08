/**
 * src/options/composables/useSettings.ts — 设置数据管理
 */
import type { Settings } from '../constants';
import { showToast } from 'vant';
import { onMounted, ref } from 'vue';
import browser from 'webextension-polyfill';
import {
    DEFAULT_SETTINGS,
    JIRA_VERIFY_PATH,
    STORAGE_KEY_SETTINGS,
    TOAST_NETWORK_ERROR,
    TOAST_SAVED,
    TOAST_VERIFY_FAIL,
    TOAST_VERIFY_JIRA_OK,
    TOAST_VERIFY_ZENTAO_OK,
    ZENTAO_VERIFY_PATH,
} from '../constants';

export function useSettings() {
    const settings = ref<Settings>({ ...DEFAULT_SETTINGS });
    const isVerifying = ref(false);
    const isSaving = ref(false);

    // ---- 加载 ----
    onMounted(async () => {
        const stored = await browser.storage.local.get(STORAGE_KEY_SETTINGS);
        if (stored[STORAGE_KEY_SETTINGS]) {
            settings.value = { ...DEFAULT_SETTINGS, ...stored[STORAGE_KEY_SETTINGS] };
        }
    });

    // ---- 保存 ----
    async function save(): Promise<void> {
        isSaving.value = true;
        try {
            await browser.storage.local.set({ [STORAGE_KEY_SETTINGS]: settings.value });
            showToast({ message: TOAST_SAVED, duration: 1500 });
        }
        finally {
            isSaving.value = false;
        }
    }

    // ---- 验证连接 ----
    async function verifyConnection(platform: 'jira' | 'zentao'): Promise<void> {
        isVerifying.value = true;
        const { jiraBaseUrl, jiraEmail, jiraApiToken, zentaoBaseUrl, zentaoApiToken } = settings.value;
        try {
            if (platform === 'jira') {
                const resp = await fetch(
                    `${jiraBaseUrl.replace(/\/+$/, '')}${JIRA_VERIFY_PATH}`,
                    { headers: { Authorization: `Basic ${btoa(`${jiraEmail}:${jiraApiToken}`)}`, Accept: 'application/json' } },
                );
                showToast({ message: resp.ok ? TOAST_VERIFY_JIRA_OK : TOAST_VERIFY_FAIL(resp.status), duration: resp.ok ? 2000 : 3000 });
            }
            else {
                const resp = await fetch(
                    `${zentaoBaseUrl.replace(/\/+$/, '')}${ZENTAO_VERIFY_PATH}`,
                    { headers: { Token: zentaoApiToken, Accept: 'application/json' } },
                );
                showToast({ message: resp.ok ? TOAST_VERIFY_ZENTAO_OK : TOAST_VERIFY_FAIL(resp.status), duration: resp.ok ? 2000 : 3000 });
            }
        }
        catch (err: unknown) {
            showToast({
                message: `连接失败: ${err instanceof Error ? err.message : TOAST_NETWORK_ERROR}`,
                duration: 3000,
            });
        }
        finally {
            isVerifying.value = false;
        }
    }

    return { settings, isVerifying, isSaving, save, verifyConnection };
}
