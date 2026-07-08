<script setup lang="ts">
import { ContentToBackgroundAction, type BackgroundToContentMessage } from '@shared/types';
import type { RecordingSession } from '@shared/types';
import { showToast } from 'vant';
import { computed, onMounted, ref } from 'vue';
import browser from 'webextension-polyfill';

// ============================================================
// 读取 URL 参数
// ============================================================
const params = new URLSearchParams(window.location.search);
const sessionId = params.get('sessionId') || '';
const sessionTitle = params.get('title') || '';

// ============================================================
// 设置
// ============================================================
interface Settings { jiraEnabled: boolean; zentaoEnabled: boolean; jiraBaseUrl: string; jiraEmail: string; jiraApiToken: string; jiraProjectKey: string; zentaoBaseUrl: string; zentaoApiToken: string; zentaoProductId: string; aiProvider: string; aiApiKey: string; aiBaseUrl: string; aiModel: string }
const settings = ref<Settings>({ jiraEnabled: false, zentaoEnabled: false, jiraBaseUrl: '', jiraEmail: '', jiraApiToken: '', jiraProjectKey: '', zentaoBaseUrl: '', zentaoApiToken: '', zentaoProductId: '', aiProvider: '', aiApiKey: '', aiBaseUrl: '', aiModel: '' });

// ============================================================
// 表单
// ============================================================
const platform = ref<'jira' | 'zentao' | ''>('');
const title = ref(decodeURIComponent(sessionTitle));
const description = ref('');
const submitting = ref(false);
const generatingAi = ref(false);

// ============================================================
// 会话摘要
// ============================================================
const sessionInfo = ref<RecordingSession | null>(null);

onMounted(async () => {
    const s = await browser.storage.local.get('bugreplay_settings');
    if (s.bugreplay_settings) Object.assign(settings.value, s.bugreplay_settings);
    if (settings.value.jiraEnabled) platform.value = 'jira';
    else if (settings.value.zentaoEnabled) platform.value = 'zentao';

    if (sessionId) {
        const resp = await browser.runtime.sendMessage({ action: ContentToBackgroundAction.GET_SESSION, payload: { sessionId } }) as BackgroundToContentMessage;
        if (resp.payload) sessionInfo.value = resp.payload as RecordingSession;
    }
});

const hasAi = computed(() => !!settings.value.aiProvider && !!settings.value.aiApiKey);

// ============================================================
// AI 生成描述
// ============================================================
async function generateDescription() {
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
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.value.aiApiKey}` },
            body: JSON.stringify({
                model: settings.value.aiModel,
                messages: [{ role: 'system', content: '你是一个专业的 QA 工程师，请根据以下录制信息生成一段简洁的 Bug 描述（中文），包含：复现步骤、预期结果、实际结果' }, { role: 'user', content: ctx }],
            }),
        });
        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content || '';
        description.value = text.trim();
        showToast({ message: 'AI 描述已生成', duration: 1500 });
    } catch {
        showToast({ message: 'AI 生成失败，请检查配置', duration: 2000 });
    } finally {
        generatingAi.value = false;
    }
}

// ============================================================
// 提交
// ============================================================
async function submit() {
    if (!sessionId || !platform.value) return;
    submitting.value = true;
    try {
        const cfg: any = platform.value === 'jira'
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
    } catch (err: any) {
        showToast({ message: `失败: ${err.message || '网络错误'}`, duration: 3000 });
    } finally {
        submitting.value = false;
    }
}

function openSettings() { browser.runtime.openOptionsPage(); }
</script>

<template>
    <div class="shell">
        <header class="header">
            <button class="back-btn" @click="window.close()">← 返回</button>
            <h1 class="header-title">提交 Bug 报告</h1>
        </header>

        <main class="body">
            <!-- 会话信息 -->
            <section class="card" v-if="sessionInfo">
                <div class="flex items-center gap-2 mb-3">
                    <span class="text-14 font-600" style="color:#7ba4f5">📋</span>
                    <span class="text-14 font-600" style="color:#b0b0c4">{{ sessionInfo.title }}</span>
                </div>
                <div class="grid grid-cols-3 gap-3 text-12">
                    <div><span style="color:#6b6b80">网络</span><br><span style="color:#d0d0dc">{{ sessionInfo.networkLogs?.length || 0 }}</span></div>
                    <div><span style="color:#6b6b80">控制台</span><br><span style="color:#d0d0dc">{{ sessionInfo.consoleLogs?.length || 0 }}</span></div>
                    <div><span style="color:#6b6b80">标注</span><br><span style="color:#d0d0dc">{{ sessionInfo.annotations?.length || 0 }}</span></div>
                </div>
            </section>

            <!-- 目标平台 -->
            <section class="card">
                <h3 class="section-title">目标平台</h3>
                <div class="flex gap-2">
                    <button v-if="settings.jiraEnabled" class="platform-btn" :class="{ active: platform === 'jira' }" @click="platform = 'jira'">Jira</button>
                    <button v-if="settings.zentaoEnabled" class="platform-btn" :class="{ active: platform === 'zentao' }" @click="platform = 'zentao'">禅道</button>
                </div>
                <p v-if="!settings.jiraEnabled && !settings.zentaoEnabled" class="hint">
                    ⚠ 未配置 Bug 平台，请先在<a href="#" @click.prevent="openSettings">设置</a>中启用
                </p>
            </section>

            <!-- 标题 -->
            <section class="card">
                <h3 class="section-title">Bug 标题</h3>
                <input v-model="title" class="inp" placeholder="简要描述 Bug 现象" />
            </section>

            <!-- 描述 + AI -->
            <section class="card">
                <div class="flex items-center justify-between mb-3">
                    <h3 class="section-title" style="margin-bottom:0">详细描述</h3>
                    <button v-if="hasAi" class="ai-btn" :disabled="generatingAi" @click="generateDescription">
                        <span>{{ generatingAi ? '⚡ 生成中...' : '🤖 AI 生成' }}</span>
                    </button>
                </div>
                <textarea v-model="description" class="inp ta" rows="8" placeholder="复现步骤、预期结果、实际结果..." />
                <p v-if="!hasAi" class="hint">💡 在<a href="#" @click.prevent="openSettings">设置</a>中配置 AI 后可自动生成描述</p>
            </section>
        </main>

        <footer class="footer">
            <button class="btn-cancel" @click="window.close()">取消</button>
            <button class="btn-submit" :disabled="!platform || submitting" @click="submit">
                {{ submitting ? '提交中...' : `提交到 ${platform === 'jira' ? 'Jira' : platform === 'zentao' ? '禅道' : '平台'}` }}
            </button>
        </footer>
    </div>
</template>

<style lang="scss" scoped>
.shell { height: 100vh; display: flex; flex-direction: column; overflow: hidden; background: #1c1c24; }
.header { flex-shrink: 0; padding: 16px 20px; background: #22222c; border-bottom: 1px solid #32323e; display: flex; align-items: center; gap: 14px; }
.back-btn { border: none; background: transparent; color: #7ba4f5; font-size: 14px; cursor: pointer; padding: 0; }
.header-title { font-size: 17px; font-weight: 700; color: #d0d0dc; margin: 0; }
.body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.footer { flex-shrink: 0; padding: 12px 16px; background: #22222c; border-top: 1px solid #32323e; display: flex; gap: 10px; }

.card { background: #272732; border: 1px solid #32323e; border-radius: 10px; padding: 16px; }
.section-title { font-size: 14px; font-weight: 600; color: #b0b0c4; margin: 0 0 10px; }

.platform-btn { padding: 8px 22px; border: 1px solid #3a3a4e; border-radius: 8px; background: transparent; color: #6b6b80; font-size: 14px; cursor: pointer; transition: .15s; &.active { border-color: #5b8def; background: rgba(91,141,239,.1); color: #7ba4f5; } }
.inp { width: 100%; padding: 10px 12px; border: 1px solid #3a3a4e; border-radius: 8px; background: #1e1e28; color: #d0d0dc; font-size: 14px; outline: none; box-sizing: border-box; &::placeholder { color: #505060; } &:focus { border-color: #5b8def; } }
.ta { resize: vertical; min-height: 120px; }
.hint { font-size: 12px; color: #6b6b80; margin-top: 8px; a { color: #7ba4f5; } }
.ai-btn { padding: 5px 14px; border: 1px solid rgba(91,141,239,.3); border-radius: 6px; background: rgba(91,141,239,.08); color: #7ba4f5; font-size: 12px; cursor: pointer; transition: .15s; &:hover { background: rgba(91,141,239,.15); } &:disabled { opacity: .5; cursor: not-allowed; } }
.btn-cancel { flex: 1; padding: 13px; border: 1px solid #3a3a4e; border-radius: 10px; background: transparent; color: #6b6b80; font-size: 14px; cursor: pointer; }
.btn-submit { flex: 2; padding: 13px; border: none; border-radius: 10px; background: #5b8def; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; &:hover { background: #6b9df5; } &:disabled { opacity: .4; cursor: not-allowed; } }
</style>
