<script setup lang="ts">
import type { RecordingSessionSummary } from '@shared/types'

defineProps<{
  session: RecordingSessionSummary
  isActive: boolean
}>()

const emit = defineEmits<{
  delete: [sessionId: string]
}>()
</script>

<template>
  <div
    class="flex items-center justify-between p-2.5 rounded-lg border transition-colors"
    :class="isActive ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-200 hover:bg-gray-50'"
  >
    <div class="flex-1 min-w-0">
      <div class="text-sm font-medium text-gray-800 truncate">
        {{ session.title }}
      </div>
      <div class="text-xs text-gray-400 mt-0.5">
        {{ new Date(session.startTime).toLocaleString() }}
      </div>
    </div>
    <button
      class="flex-shrink-0 p-1 ml-2 text-gray-400 hover:text-red-500 transition-colors rounded"
      title="删除"
      @click="emit('delete', session.id)"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M8 6v14h8V6M10 6V4h4v4" />
      </svg>
    </button>
  </div>
</template>
