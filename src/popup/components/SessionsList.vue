<script setup lang="ts">
import type { RecordingSessionSummary } from '@shared/types'
import SessionItem from './SessionItem.vue'

defineProps<{
  sessions: RecordingSessionSummary[]
  activeSessionId: string | null
}>()

const emit = defineEmits<{
  delete: [sessionId: string]
}>()
</script>

<template>
  <section class="mt-3">
    <h2 class="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
      历史录制
    </h2>

    <div v-if="sessions.length === 0" class="text-center text-sm text-gray-400 py-6">
      暂无录制记录
    </div>

    <div v-else class="flex flex-col gap-2">
      <SessionItem
        v-for="session in sessions"
        :key="session.id"
        :session="session"
        :is-active="session.id === activeSessionId"
        @delete="emit('delete', $event)"
      />
    </div>
  </section>
</template>
