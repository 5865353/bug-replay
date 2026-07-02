<script setup lang="ts">
import { ref, computed } from 'vue'
import type { RRTPackage, ConsoleLog, NetworkLog } from '@shared/types'
import { CONSOLE_LEVEL_COLORS } from '@shared/types'
import { formatTime } from '@shared/utils'

const props = defineProps<{
  visible: boolean
  collapsed: boolean
  currentPackage: RRTPackage | null
}>()

type DevToolsTab = 'console' | 'network'
const activeTab = ref<DevToolsTab>('console')
const searchQuery = ref('')
const expandedItems = ref(new Set<string>())
const panelHeight = ref(200)
const isDragging = ref(false)

const consoleLogs = computed(() => {
  if (!props.currentPackage) return []
  let logs = props.currentPackage.consoleLogs
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    logs = logs.filter(l =>
      l.args.some(a => String(a).toLowerCase().includes(q))
      || l.level.toLowerCase().includes(q),
    )
  }
  return logs
})

const networkLogs = computed(() => {
  if (!props.currentPackage) return []
  let logs = props.currentPackage.networkLogs
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    logs = logs.filter(l =>
      l.url.toLowerCase().includes(q)
      || l.method.toLowerCase().includes(q),
    )
  }
  return logs
})

function toggleItem(key: string) {
  if (expandedItems.value.has(key)) {
    expandedItems.value.delete(key)
  } else {
    expandedItems.value.add(key)
  }
}

function statusClass(status: number): string {
  if (status >= 200 && status < 300) return 'text-green'
  if (status >= 300 && status < 400) return 'text-yellow'
  return 'text-red'
}

function onResizeStart(e: MouseEvent) {
  isDragging.value = true
  const startY = e.clientY
  const startH = panelHeight.value

  function onMove(ev: MouseEvent) {
    panelHeight.value = Math.max(80, Math.min(600, startH + (startY - ev.clientY)))
  }
  function onUp() {
    isDragging.value = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}
</script>

<template>
  <div
    v-if="visible"
    class="flex-shrink-0 bg-surface flex flex-col relative border-t border-border"
    :class="{ 'h-9': collapsed }"
    :style="{ height: collapsed ? undefined : `${panelHeight}px` }"
  >
    <!-- Resize handle -->
    <div
    class="absolute -top-0.5 left-0 right-0 h-1.5 cursor-ns-resize z-10 flex justify-center items-center group"
    @mousedown="onResizeStart"
    >
      <div class="w-10 h-0.75 bg-border rounded group-hover:bg-accent transition-colors" />
    </div>

    <!-- Tabs -->
    <div class="flex items-center bg-#0f0f14 border-b border-border flex-shrink-0">
      <button
        v-for="tab in (['console', 'network'] as DevToolsTab[])"
        :key="tab"
        class="px-3.5 py-1.5 text-xs font-medium bg-transparent border-none border-b-2 cursor-pointer transition-all"
        :class="activeTab === tab
          ? 'text-text border-accent'
          : 'text-text3 border-transparent hover:text-text2'"
        @click="activeTab = tab"
      >
        {{ tab === 'console' ? '📋 控制台' : '🌐 网络' }}
      </button>
      <div class="flex-1" />
      <button class="px-2.5 py-1 text-sm cursor-pointer border-none bg-transparent text-text3 hover:text-text" @click="$emit('toggleCollapse')">
        {{ collapsed ? '╍' : '╌' }}
      </button>
    </div>

    <!-- Content -->
    <div v-if="!collapsed" class="flex-1 overflow-hidden flex flex-col">
      <!-- Search -->
      <div class="px-2.5 py-1.5 border-b border-border flex-shrink-0">
        <input
          v-model="searchQuery"
          type="text"
          class="w-full px-2.5 py-1.5 border border-border rounded-md bg-#0f0f14 text-text text-xs outline-none focus:border-accent"
          placeholder="搜索..."
        >
      </div>

      <!-- List -->
      <div class="flex-1 overflow-y-auto py-1">
        <!-- Console tab -->
        <template v-if="activeTab === 'console'">
          <div
            v-for="(log, i) in consoleLogs"
            :key="i"
            class="px-2.5 py-1.5 border-b border-white/3 text-xs transition-colors"
          >
            <div
              class="flex items-center gap-1.5 cursor-pointer rounded px-1 py-0.5 -mx-1 -my-0.5 hover:bg-surface2"
              @click="toggleItem(`console-${i}`)"
            >
              <span class="text-text3 tabular-nums text-2.5 min-w-11">{{ formatTime(log.timestamp) }}</span>
              <span class="font-bold text-2.5" :style="{ color: CONSOLE_LEVEL_COLORS[log.level] }">{{ log.level.toUpperCase() }}</span>
              <span class="text-text flex-1 truncate">{{ log.args.map(a => String(a)).join(' ') }}</span>
              <span class="text-text3 text-2.5">{{ expandedItems.has(`console-${i}`) ? '▲' : '▼' }}</span>
            </div>
            <div
              v-if="expandedItems.has(`console-${i}`)"
              class="mt-1 p-2 bg-#0f0f14 rounded text-2.5 text-#bac2de max-h-40 overflow-y-auto whitespace-pre-wrap break-all"
            >
              <div v-for="(arg, j) in log.args" :key="j" class="mb-1">
                <strong class="text-accent">Arg {{ j + 1 }}:</strong>
                {{ typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg) }}
              </div>
              <div v-if="log.stackTrace" class="mt-1 text-red">
                <strong>Stack:</strong>
                <pre class="mt-1 text-2.5">{{ log.stackTrace }}</pre>
              </div>
            </div>
          </div>
        </template>

        <!-- Network tab -->
        <template v-else>
          <div
            v-for="(log, i) in networkLogs"
            :key="i"
            class="px-2.5 py-1.5 border-b border-white/3 text-xs"
          >
            <div
              class="flex items-center gap-1.5 cursor-pointer rounded px-1 py-0.5 -mx-1 -my-0.5 hover:bg-surface2"
              @click="toggleItem(`net-${i}`)"
            >
              <span class="text-text3 tabular-nums text-2.5 min-w-11">{{ formatTime(log.startTime) }}</span>
              <span class="font-bold text-xs min-w-8">{{ log.method }}</span>
              <span class="font-semibold text-xs min-w-6" :class="statusClass(log.status)">{{ log.status }}</span>
              <span class="text-text flex-1 truncate">{{ log.url }}</span>
              <span class="text-text3 text-2.5 min-w-10 text-right">{{ log.duration }}ms</span>
              <span class="text-text3 text-2.5">{{ expandedItems.has(`net-${i}`) ? '▲' : '▼' }}</span>
            </div>
            <div
              v-if="expandedItems.has(`net-${i}`)"
              class="mt-1 p-2 bg-#0f0f14 rounded text-2.5 text-#bac2de"
            >
              <div class="mb-1"><strong class="text-accent">URL:</strong> {{ log.url }}</div>
              <div class="mb-1"><strong class="text-accent">Method:</strong> {{ log.method }}</div>
              <div class="mb-1"><strong class="text-accent">Status:</strong> {{ log.status }} {{ log.statusText }}</div>
              <div class="mb-1"><strong class="text-accent">Duration:</strong> {{ log.duration }}ms</div>
              <div v-if="log.requestHeaders" class="mb-1">
                <strong class="text-accent">Request Headers:</strong>
                <pre class="mt-1 p-2 bg-#0f0f14 rounded text-2.5 text-#a6adc8 max-h-37.5 overflow-y-auto whitespace-pre-wrap break-all">{{ JSON.stringify(log.requestHeaders, null, 2) }}</pre>
              </div>
              <div v-if="log.responseHeaders" class="mb-1">
                <strong class="text-accent">Response Headers:</strong>
                <pre class="mt-1 p-2 bg-#0f0f14 rounded text-2.5 text-#a6adc8 max-h-37.5 overflow-y-auto whitespace-pre-wrap break-all">{{ JSON.stringify(log.responseHeaders, null, 2) }}</pre>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
