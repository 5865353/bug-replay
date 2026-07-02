<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import type { RRTPackage } from '@shared/types'

const props = defineProps<{
  hasLoaded: boolean
  currentPackage: RRTPackage | null
}>()

const emit = defineEmits<{
  dropFile: [file: File]
  fileSelected: [event: Event]
}>()

const playerContainer = ref<HTMLDivElement>()
const stageEl = ref<HTMLDivElement>()
const fileInput = ref<HTMLInputElement>()
const isDragOver = ref(false)

// Signal to useReplayer that DOM is ready
const stageReady = ref(false)

defineExpose({ playerContainer, stageEl })

onMounted(() => {
  stageReady.value = true
})

// Drag & drop handlers
function onDragOver(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = true
}
function onDragLeave() {
  isDragOver.value = false
}
function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) emit('dropFile', file)
}

function onClickDropZone() {
  fileInput.value?.click()
}
</script>

<template>
  <div
    ref="stageEl"
    class="flex-1 relative overflow-hidden flex items-center justify-center"
    style="background: radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a10 70%);"
  >
    <!-- Ambient glow -->
    <div class="absolute -inset-15 z-0 pointer-events-none"
      style="background: radial-gradient(circle at 30% 50%, rgba(203,166,247,0.06) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(180,190,254,0.04) 0%, transparent 50%);" />

    <div class="relative z-1 overflow-hidden rounded-lg w-full h-full"
      style="box-shadow: 0 0 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06);">
      <!-- Drop zone -->
      <div
        v-if="!hasLoaded"
        class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3.5 text-text3 bg-bg border-2 border-dashed rounded-lg cursor-pointer transition-all"
        :class="isDragOver ? 'border-accent! text-text2!' : 'border-border'"
        @click="onClickDropZone"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <img src="/icons/icon-16.png" alt="" class="w-14 h-14 op-50">
        <div class="text-sm font-medium">点击或拖放 .rrt 文件</div>
        <div class="text-xs text-text3">支持 .rrt / .json 格式的录制回放文件</div>
        <input
          ref="fileInput"
          type="file"
          accept=".rrt,.json"
          class="hidden"
          @change="emit('fileSelected', $event)"
        >
      </div>

      <!-- rrweb player container -->
      <div
        ref="playerContainer"
        class="w-full h-full relative overflow-hidden"
        :style="{ display: hasLoaded ? 'block' : 'none' }"
      />
    </div>
  </div>
</template>
