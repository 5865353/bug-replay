<script setup lang="ts">
import { onMounted, ref } from 'vue';
import browser from 'webextension-polyfill';
import FooterActions from './components/FooterActions.vue';
import RecordingControls from './components/RecordingControls.vue';
import SessionsList from './components/SessionsList.vue';
import StatusBadge from './components/StatusBadge.vue';
import { useRecording } from './composables/useRecording';
import { useSessions } from './composables/useSessions';

const { isRecording, isPaused, toggleRecording, initStatus } = useRecording();
const { sessions, loadSessions, deleteSession } = useSessions();

const selectedSessionId = ref<string | null>(null);

function selectSession(id: string) {
    selectedSessionId.value = id;
}

onMounted(async () => {
    await initStatus();
    await loadSessions();
});
</script>

<template>
    <div class="app-shell">
        <van-nav-bar title="BugReplay" fixed placeholder>
            <template #left>
                <img src="/icons/icon-48.png" width="22" height="22" alt="" class="nav-logo">
            </template>
            <template #right>
                <div class="flex items-center gap-2">
                    <van-icon name="setting-o" size="20" class="settings-icon" @click="browser.runtime.openOptionsPage()" />
                    <StatusBadge :is-recording="isRecording" :is-paused="isPaused" />
                </div>
            </template>
        </van-nav-bar>

        <div class="app-body">
            <div class="card recording-card">
                <RecordingControls
                    :is-recording="isRecording"
                    :is-paused="isPaused"
                    @toggle="toggleRecording"
                />
            </div>

            <div class="card sessions-card">
                <SessionsList
                    :sessions="sessions"
                    :active-session-id="selectedSessionId"
                    @select="selectSession"
                    @delete="deleteSession"
                />
            </div>
        </div>

        <FooterActions
            :active-session-id="selectedSessionId"
            :sessions="sessions"
        />
    </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 420px;
  background: #f2f3f7;
}

.app-body {
  flex: 1;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow: hidden;
}

.card {
  background: #fff;
  border-radius: 14px;
  padding: 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}

.recording-card {
  padding: 16px 14px;
  flex-shrink: 0;
}

.sessions-card {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 12px 14px;
}

.nav-logo {
  border-radius: 5px;
}
</style>
