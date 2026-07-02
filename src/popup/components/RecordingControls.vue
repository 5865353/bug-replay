<script setup lang="ts">
defineProps<{
  isRecording: boolean
  isPaused: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()
</script>

<template>
  <button
    class="w-full py-3 text-base font-semibold rounded-lg transition-all duration-150 flex items-center justify-center gap-2"
    :class="isRecording
      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
      : 'bg-red-500 text-white hover:bg-red-600 cursor-pointer'"
    :disabled="isRecording"
    @click="emit('toggle')"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle v-if="!isRecording" cx="12" cy="12" r="8" />
      <template v-else>
        <rect x="6" y="4" width="4" height="16" rx="1" />
        <rect x="14" y="4" width="4" height="16" rx="1" />
      </template>
    </svg>
    <span>{{ isRecording ? (isPaused ? '已暂停' : '录制中...') : '开始录制' }}</span>
  </button>
</template>
