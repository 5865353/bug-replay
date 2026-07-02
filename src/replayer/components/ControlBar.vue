<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  showAnnotations: boolean
  devtoolsVisible: boolean
}>()

const emit = defineEmits<{
  toggleAnnotations: []
  toggleDevtools: []
  replay: []
  fileSelected: [event: Event]
}>()

const fileInput = ref<HTMLInputElement>()

function openFile() {
  fileInput.value?.click()
}
</script>

<template>
  <div class="flex items-center gap-2.5 px-3 py-1.5 bg-surface border-t border-border flex-shrink-0">
    <label class="btn btn-primary btn-sm cursor-pointer">
      📂 打开
      <input
        ref="fileInput"
        type="file"
        accept=".rrt,.json"
        class="hidden"
        @change="emit('fileSelected', $event)"
      >
    </label>
    <button class="btn btn-sm" title="切换标注图层" @click="emit('toggleAnnotations')">
      🖊 标注
    </button>
    <button class="btn btn-sm" title="重新播放" @click="emit('replay')">
      ↺ 重新播放
    </button>
    <div class="flex-1" />
    <button class="btn btn-sm" @click="emit('toggleDevtools')">
      {{ devtoolsVisible ? '🔽 面板' : '🔼 面板' }}
    </button>
  </div>
</template>
