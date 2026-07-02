<script setup lang="ts">
import { onMounted } from 'vue'
import StatusBadge from './components/StatusBadge.vue'
import RecordingControls from './components/RecordingControls.vue'
import SessionsList from './components/SessionsList.vue'
import FooterActions from './components/FooterActions.vue'
import { useRecording } from './composables/useRecording'
import { useSessions } from './composables/useSessions'

const { isRecording, isPaused, activeSessionId, toggleRecording, initStatus } = useRecording()
const { sessions, loadSessions, deleteSession } = useSessions()

onMounted(async () => {
  await initStatus()
  await loadSessions()
})
</script>

<template>
  <div class="flex flex-col h-full min-h-420px">
    <!-- Header -->
    <header class="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
      <div class="flex items-center gap-2">
        <img src="/icons/icon-48.png" width="20" height="20" alt="" class="flex-shrink-0">
        <h1 class="text-lg font-bold text-gray-900">BugReplay</h1>
      </div>
      <StatusBadge :is-recording="isRecording" :is-paused="isPaused" />
    </header>

    <!-- Main -->
    <main class="flex-1 px-4 py-3 overflow-y-auto">
      <RecordingControls
        :is-recording="isRecording"
        :is-paused="isPaused"
        @toggle="toggleRecording"
      />

      <p class="text-xs text-gray-400 text-center my-2 leading-relaxed">
        录制开始后，页面底部会弹出统一工具栏，<br>
        可进行暂停/停止录制、绘制标注等操作。
      </p>

      <SessionsList
        :sessions="sessions"
        :active-session-id="activeSessionId"
        @delete="deleteSession"
      />
    </main>

    <!-- Footer -->
    <FooterActions
      :active-session-id="activeSessionId"
      :sessions="sessions"
    />
  </div>
</template>
