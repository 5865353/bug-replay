<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  isRecording: boolean
  isPaused: boolean
}>()

const status = computed(() => {
  if (props.isRecording && props.isPaused) return 'paused'
  if (props.isRecording) return 'recording'
  return 'idle'
})

const statusText = computed(() => {
  switch (status.value) {
    case 'recording': return '录制中'
    case 'paused': return '已暂停'
    default: return '就绪'
  }
})

const statusClasses = computed(() => ({
  'bg-red-100 text-red-600 animate-pulse': status.value === 'recording',
  'bg-yellow-100 text-yellow-600': status.value === 'paused',
  'bg-gray-100 text-gray-500': status.value === 'idle',
}))
</script>

<template>
  <span
    class="text-xs px-2.5 py-0.5 rounded-full font-medium"
    :class="statusClasses"
  >
    {{ statusText }}
  </span>
</template>
