<script setup lang="ts">
import type { RecordingSessionSummary } from '@shared/types'
import browser from 'webextension-polyfill'
import { computed } from 'vue'

const props = defineProps<{
  activeSessionId: string | null
  sessions: RecordingSessionSummary[]
}>()

const canExport = computed(() => !!props.activeSessionId || props.sessions.length > 0)

async function getSessionId(): Promise<string | null> {
  if (props.activeSessionId) return props.activeSessionId
  if (props.sessions.length > 0) return props.sessions[props.sessions.length - 1].id
  return null
}

async function exportRRT() {
  const sessionId = await getSessionId()
  if (sessionId) {
    await browser.runtime.sendMessage({
      action: 'EXPORT_RRT',
      payload: { sessionId },
    })
  }
}

async function copyToClipboard() {
  const sessionId = await getSessionId()
  if (sessionId) {
    await browser.runtime.sendMessage({
      action: 'EXPORT_RRT',
      payload: { sessionId, clipboard: true },
    })
  }
}

function openReplayer() {
  browser.tabs.create({ url: browser.runtime.getURL('src/replayer/index.html') })
}
</script>

<template>
  <footer class="flex items-center gap-2 px-4 py-3 bg-white border-t border-gray-200">
    <button
      class="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
      @click="openReplayer"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
      回放
    </button>
    <button
      class="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      :disabled="!canExport"
      @click="exportRRT"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      导出 .rrt
    </button>
    <button
      class="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      :disabled="!canExport"
      @click="copyToClipboard"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      复制
    </button>
  </footer>
</template>
