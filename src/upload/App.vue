<script setup lang="ts">
import BugForm from './components/BugForm.vue';
import PlatformSelector from './components/PlatformSelector.vue';
import SessionInfoCard from './components/SessionInfoCard.vue';
import { useUpload } from './composables/useUpload';

const { settings, sessionInfo, platform, title, description, submitting, generatingAi, hasAi, generateDescription, submit } = useUpload();

function closePage() {
    window.close();
}
</script>

<template>
    <div class="shell">
        <header class="header">
            <button class="back-btn" @click="closePage">
                ← 返回
            </button>
            <h1 class="header-title">
                提交 Bug 报告
            </h1>
        </header>

        <main class="body">
            <SessionInfoCard v-if="sessionInfo" :session-info="sessionInfo" />
            <PlatformSelector v-model:platform="platform" :settings="settings" />
            <BugForm
                v-model:title="title"
                v-model:description="description"
                :has-ai="hasAi"
                :generating-ai="generatingAi"
                @generate-ai="generateDescription"
            />
        </main>

        <footer class="footer">
            <button class="btn-cancel" @click="closePage">
                取消
            </button>
            <button class="btn-submit" :disabled="!platform || submitting" @click="submit">
                {{ submitting ? '提交中...' : `提交到 ${platform === 'jira' ? 'Jira' : platform === 'zentao' ? '禅道' : '平台'}` }}
            </button>
        </footer>
    </div>
</template>

<style lang="scss" scoped>
.shell {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #1c1c24;
}

.header {
    flex-shrink: 0;
    padding: 16px 20px;
    background: #22222c;
    border-bottom: 1px solid #32323e;
    display: flex;
    align-items: center;
    gap: 14px;
}

.back-btn {
    border: none;
    background: transparent;
    color: #7ba4f5;
    font-size: 14px;
    cursor: pointer;
    padding: 0;
}

.header-title {
    font-size: 17px;
    font-weight: 700;
    color: #d0d0dc;
    margin: 0;
}

.body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.footer {
    flex-shrink: 0;
    padding: 12px 16px;
    background: #22222c;
    border-top: 1px solid #32323e;
    display: flex;
    gap: 10px;
}

.btn-cancel {
    flex: 1;
    padding: 13px;
    border: 1px solid #3a3a4e;
    border-radius: 10px;
    background: transparent;
    color: #6b6b80;
    font-size: 14px;
    cursor: pointer;
}

.btn-submit {
    flex: 2;
    padding: 13px;
    border: none;
    border-radius: 10px;
    background: #5b8def;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;

    &:hover { background: #6b9df5; }
    &:disabled { opacity: .4; cursor: not-allowed; }
}
</style>
