<script setup lang="ts">
import { ref } from 'vue';
import AiPlatformSettings from './components/AiPlatformSettings.vue';
import BasicSettings from './components/BasicSettings.vue';
import BugPlatformSettings from './components/BugPlatformSettings.vue';
import { useSettings } from './composables/useSettings';
import { LABEL_SAVE, TAB_AI_PLATFORM, TAB_BASIC, TAB_BUG_PLATFORM, TAB_TITLE_AI, TAB_TITLE_BASIC, TAB_TITLE_BUG } from './constants';

const { settings, isVerifying, isSaving, save, verifyConnection } = useSettings();
const activeTab = ref(TAB_BASIC);
const tabs = [
    { key: TAB_BASIC, icon: '⚙️', label: TAB_TITLE_BASIC },
    { key: TAB_BUG_PLATFORM, icon: '🐛', label: TAB_TITLE_BUG },
    { key: TAB_AI_PLATFORM, icon: '🤖', label: TAB_TITLE_AI },
];
</script>

<template>
    <div class="shell">
        <header class="header">
            <div class="flex items-center gap-3">
                <img src="/icons/icon-48.png" class="w-36 h-36 rounded-lg">
                <div>
                    <h1 class="text-20 font-700 lh-none">
                        BugReplay
                    </h1>
                    <p class="text-13 mt-1" style="color:#6b6b80">
                        设置中心
                    </p>
                </div>
            </div>
        </header>
        <nav class="tabs">
            <button v-for="t in tabs" :key="t.key" class="tab" :class="{ active: activeTab === t.key }" @click="activeTab = t.key">
                <span class="text-16">{{ t.icon }}</span>
                <span class="text-14">{{ t.label }}</span>
            </button>
        </nav>
        <main class="body">
            <BasicSettings
                v-show="activeTab === TAB_BASIC" :settings="settings"
                @update:mask-inputs="settings.maskInputs = $event"
                @update:mouse-sample="settings.mouseSample = $event"
                @update:scroll-sample="settings.scrollSample = $event"
                @update:max-duration="settings.maxDuration = $event"
                @update:replay-speed="settings.replaySpeed = $event"
                @update:show-annotations="settings.showAnnotations = $event"
            />
            <BugPlatformSettings
                v-show="activeTab === TAB_BUG_PLATFORM" :settings="settings" :is-verifying="isVerifying"
                @update:jira-enabled="settings.jiraEnabled = $event"
                @update:jira-base-url="settings.jiraBaseUrl = $event"
                @update:jira-email="settings.jiraEmail = $event"
                @update:jira-api-token="settings.jiraApiToken = $event"
                @update:jira-project-key="settings.jiraProjectKey = $event"
                @update:zentao-enabled="settings.zentaoEnabled = $event"
                @update:zentao-base-url="settings.zentaoBaseUrl = $event"
                @update:zentao-api-token="settings.zentaoApiToken = $event"
                @update:zentao-product-id="settings.zentaoProductId = $event"
                @verify="verifyConnection"
            />
            <AiPlatformSettings
                v-show="activeTab === TAB_AI_PLATFORM" :settings="settings"
                @update:ai-provider="settings.aiProvider = $event"
                @update:ai-api-key="settings.aiApiKey = $event"
                @update:ai-base-url="settings.aiBaseUrl = $event"
                @update:ai-model="settings.aiModel = $event"
            />
        </main>
        <footer class="footer">
            <button class="btn-primary" :disabled="isSaving" @click="save">
                <span v-if="isSaving" class="spinner" /> {{ isSaving ? '保存中...' : LABEL_SAVE }}
            </button>
        </footer>
    </div>
</template>

<style lang="scss" scoped>
.shell { height:100vh; display:flex; flex-direction:column; overflow:hidden; background:#1c1c24; }
.header { flex-shrink:0; padding:20px 20px 16px; background:#22222c; border-bottom:1px solid #2e2e3a; }
.tabs { flex-shrink:0; display:flex; padding:12px 16px; gap:6px; background:#1c1c24; border-bottom:1px solid #2e2e3a; }
.tab {
    flex:1; padding:9px 6px; border-radius:8px; border:1px solid transparent; background:transparent;
    color:#6b6b80; font-weight:500; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px;
    transition:all .15s;
    &:hover { background:#262632; color:#9e9eb0; }
    &.active { background:#2a2a3a; border-color:#3a3a50; color:#b8c2e8; }
}
.body { flex:1; min-height:0; overflow-y:auto; }
.footer { flex-shrink:0; padding:12px 16px; padding-bottom:calc(12px + env(safe-area-inset-bottom)); background:#22222c; border-top:1px solid #2e2e3a; }
.btn-primary {
    width:100%; padding:13px; border:none; border-radius:10px;
    background:#5b8def; color:#fff; font-size:15px; font-weight:600; cursor:pointer;
    display:flex; align-items:center; justify-content:center; gap:8px;
    transition:all .15s;
    &:hover { background:#6b9df5; }
    &:active { background:#4a7ed4; }
    &:disabled { opacity:.5; cursor:not-allowed; }
}
.spinner { width:16px; height:16px; border:2px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; animation:spin .6s linear infinite; }
@keyframes spin { to{transform:rotate(360deg)} }
</style>
