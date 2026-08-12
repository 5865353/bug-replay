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
    TOAST_AI_FAIL,
    TOAST_AI_OK,
    TOAST_NETWORK_ERROR,
    TOAST_SAVED,
    TOAST_VERIFY_FAIL,
    TOAST_VERIFY_JIRA_OK,
    TOAST_VERIFY_ZENTAO_OK,
    ZENTAO_LOGIN_PATH,
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
        const { jiraBaseUrl, jiraEmail, jiraApiToken, zentaoBaseUrl, zentaoAccount, zentaoPassword, zentaoApiToken } = settings.value;
        try {
            if (platform === 'jira') {
                const resp = await fetch(
                    `${jiraBaseUrl.replace(/\/+$/, '')}${JIRA_VERIFY_PATH}`,
                    { headers: { Authorization: `Basic ${btoa(`${jiraEmail}:${jiraApiToken}`)}`, Accept: 'application/json' } },
                );
                showToast({ message: resp.ok ? TOAST_VERIFY_JIRA_OK : TOAST_VERIFY_FAIL(resp.status), duration: resp.ok ? 2000 : 3000 });
            }
            else {
                const baseUrl = zentaoBaseUrl.replace(/\/+$/, '');
                let token = zentaoApiToken;

                // 优先用账号密码登录换取 Token
                if (!token && zentaoAccount && zentaoPassword) {
                    const loginResp = await fetch(`${baseUrl}${ZENTAO_LOGIN_PATH}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                        body: JSON.stringify({ account: zentaoAccount, password: zentaoPassword }),
                    });
                    if (loginResp.ok) {
                        const loginData = await loginResp.json();
                        if (loginData.status === 'success' && loginData.token) {
                            token = loginData.token;
                        }
                        else {
                            showToast({ message: `${TOAST_VERIFY_FAIL(401)}: ${loginData.message || '账号或密码错误'}`, duration: 3000 });
                            return;
                        }
                    }
                    else {
                        showToast({ message: TOAST_VERIFY_FAIL(loginResp.status), duration: 3000 });
                        return;
                    }
                }

                if (!token) {
                    showToast({ message: '请填写账号密码或 API Token', duration: 3000 });
                    return;
                }

                const resp = await fetch(
                    `${baseUrl}${ZENTAO_VERIFY_PATH}`,
                    { headers: { Token: token, Accept: 'application/json' } },
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

    // ---- 验证 AI 连接 ----
    async function verifyAiConnection(): Promise<void> {
        isVerifying.value = true;
        const { aiProvider, aiApiKey, aiBaseUrl, aiModel } = settings.value;
        try {
            if (!aiProvider || !aiApiKey) {
                showToast({ message: '请先选择 AI 提供商并填写 API Key', duration: 3000 });
                return;
            }
            const baseUrl = aiBaseUrl.replace(/\/+$/, '');
            const resp = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${aiApiKey}`,
                },
                body: JSON.stringify({
                    model: aiModel,
                    messages: [{ role: 'user', content: 'ping' }],
                    max_tokens: 1,
                }),
            });
            if (resp.ok) {
                showToast({ message: TOAST_AI_OK, duration: 2000 });
            }
            else {
                const errData = await resp.json().catch(() => ({}));
                const errMsg = (errData as { error?: { message?: string } })?.error?.message || `HTTP ${resp.status}`;
                showToast({ message: TOAST_AI_FAIL(errMsg), duration: 3000 });
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

    return { settings, isVerifying, isSaving, save, verifyConnection, verifyAiConnection };
}
