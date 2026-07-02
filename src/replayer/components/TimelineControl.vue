<script setup lang="ts">
import { ref, computed } from 'vue'
import { REPLAY_SPEEDS } from '@shared/types'
import { formatTime } from '@shared/utils'

const props = defineProps<{
  currentTime: number
  totalTime: number
  isPlaying: boolean
  speed: number
}>()

const emit = defineEmits<{
  playPause: []
  seek: [time: number]
  speedChange: [speed: number]
  stepForward: []
  stepBack: []
}>()

const isDragging = ref(false)

const progressPct = computed(() => {
  if (props.totalTime <= 0) return 0
  return (props.currentTime / props.totalTime) * 100
})

function onBarClick(e: MouseEvent) {
  const bar = e.currentTarget as HTMLElement
  const rect = bar.getBoundingClientRect()
  const pct = (e.clientX - rect.left) / rect.width
  emit('seek', Math.max(0, Math.min(props.totalTime, pct * props.totalTime)))
}
</script>

<template>
  <div class="px-3 py-1.5 bg-surface border-t border-border flex-shrink-0">
    <!-- Controls row -->
    <div class="flex items-center gap-1.5 mb-1.5">
      <button class="btn-icon" title="后退 1s (←)" @click="emit('stepBack')">⏮</button>
      <button
        class="w-7 h-7 flex items-center justify-center bg-accent text-bg rounded-full border-none cursor-pointer hover:bg-accent2 transition-colors"
        @click="emit('playPause')"
      >
        {{ isPlaying ? '⏸' : '▶' }}
      </button>
      <button class="btn-icon" title="前进 1s (→)" @click="emit('stepForward')">⏭</button>
      <span class="text-xs text-text2 tabular-nums min-w-9 text-center">{{ formatTime(currentTime) }}</span>
      <span class="text-xs text-text3">/</span>
      <span class="text-xs text-text2 tabular-nums min-w-9 text-center">{{ formatTime(totalTime) }}</span>
      <select
        class="ml-auto px-1.5 py-0.5 border border-border rounded bg-transparent text-text2 text-xs cursor-pointer"
        :value="speed"
        @change="emit('speedChange', Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="s in REPLAY_SPEEDS" :key="s" :value="s">{{ s }}x</option>
      </select>
    </div>

    <!-- Progress bar -->
    <div
      class="relative h-1.5 bg-border rounded cursor-pointer group"
      @click="onBarClick"
    >
      <div
        class="h-full bg-accent rounded transition-all duration-100"
        :style="{ width: `${progressPct}%` }"
      />
      <div
        class="absolute top-1/2 w-3.5 h-3.5 bg-accent border-2 border-bg rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
        :style="{ left: `${progressPct}%` }"
      />
    </div>
  </div>
</template>
