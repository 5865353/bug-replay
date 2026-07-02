<script setup lang="ts">
import { ref } from 'vue'
import type { RRTPackage } from '@shared/types'

const props = defineProps<{
  package: RRTPackage
}>()

type RightTab = 'meta' | 'keyframes'
const activeTab = ref<RightTab>('meta')

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="w-95 flex-shrink-0 bg-surface border-l border-border flex flex-col">
    <!-- Tabs -->
    <div class="flex border-b border-border flex-shrink-0">
      <button
 v-for="tab in (['meta', 'keyframes'] as RightTab[])"
        :key="tab"
        class="flex-1 py-2.5 text-center text-xs font-medium bg-transparent border-none border-b-2 cursor-pointer transition-all"
        :class="activeTab === tab
          ? 'text-text border-accent'
          : 'text-text3 border-transparent hover:text-text2'"
        @click="activeTab = tab"
      >
        {{ tab === 'meta' ? '📹 录制信息' : '🎬 关键帧' }}
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-3">
      <!-- Meta tab -->
      <div v-if="activeTab === 'meta'" class="text-xs">
        <!-- Metadata -->
        <div class="mb-3">
          <div class="text-xs text-text3 font-medium mb-2">📦 录制元数据</div>
          <div class="flex flex-col gap-0.5">
            <div class="flex justify-between py-0.5">
              <span class="text-text3">标题</span>
              <span class="text-text2 text-right max-w-60 break-all">{{ package.metadata.title }}</span>
            </div>
            <div class="flex justify-between py-0.5">
              <span class="text-text3">时长</span>
              <span class="text-text2">{{ formatDuration(package.metadata.duration) }}</span>
            </div>
            <div class="flex justify-between py-0.5">
              <span class="text-text3">事件数</span>
              <span class="text-text2">{{ package.rrwebEvents.length }}</span>
            </div>
            <div class="flex justify-between py-0.5">
              <span class="text-text3">网络请求</span>
              <span class="text-text2">{{ package.networkLogs.length }}</span>
            </div>
            <div class="flex justify-between py-0.5">
              <span class="text-text3">控制台日志</span>
              <span class="text-text2">{{ package.consoleLogs.length }}</span>
            </div>
            <div class="flex justify-between py-0.5">
              <span class="text-text3">标注数</span>
              <span class="text-text2">{{ package.annotations.length }}</span>
            </div>
            <div v-if="package.metadata.tags?.length" class="flex justify-between py-0.5">
              <span class="text-text3">标签</span>
              <span class="text-text2">{{ package.metadata.tags.join(', ') }}</span>
            </div>
            <div v-if="package.metadata.description" class="flex justify-between py-0.5">
              <span class="text-text3">描述</span>
              <span class="text-text2 text-right max-w-60 break-all">{{ package.metadata.description }}</span>
            </div>
          </div>
        </div>

        <!-- Environment -->
        <div v-if="package.environment">
          <div class="text-xs text-text3 font-medium mb-2">🖥 环境信息</div>
          <div class="flex flex-col gap-0.5">
            <div class="flex justify-between py-0.5">
              <span class="text-text3">页面URL</span>
              <span class="text-text2 text-right max-w-60 break-all truncate">{{ package.environment.url }}</span>
            </div>
            <div class="flex justify-between py-0.5">
              <span class="text-text3">视口</span>
              <span class="text-text2">{{ package.environment.viewport?.width }}×{{ package.environment.viewport?.height }}</span>
            </div>
            <div class="flex justify-between py-0.5">
              <span class="text-text3">UserAgent</span>
              <span class="text-text2 text-right max-w-60 truncate">{{ package.environment.userAgent }}</span>
            </div>
            <div class="flex justify-between py-0.5">
              <span class="text-text3">语言</span>
              <span class="text-text2">{{ package.environment.language }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Keyframes tab -->
      <div v-else>
        <div v-if="package.annotations.length === 0" class="text-xs text-text3 text-center py-4">
          暂无标注关键帧
        </div>
        <div v-else class="flex flex-col gap-0.5">
          <div
            v-for="(ann, i) in package.annotations"
            :key="i"
            class="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer border border-transparent hover:bg-surface2 transition-all text-xs"
          >
            <span class="bg-accent text-bg text-2.5 font-bold px-1.5 py-0.5 rounded flex-shrink-0">Step {{ i + 1 }}</span>
            <span class="text-sm flex-shrink-0">
              {{ ann.type === 'rect' ? '⬜' : ann.type === 'arrow' ? '➡' : ann.type === 'text' ? '📝' : '✏️' }}
            </span>
            <span class="text-text2 truncate">{{ ann.type }}</span>
            <span class="text-text3 text-2.5 tabular-nums ml-auto flex-shrink-0">{{ formatDuration(ann.timestamp) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
