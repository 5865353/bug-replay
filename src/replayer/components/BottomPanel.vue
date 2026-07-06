<script setup lang="ts">
import type { RRTPackage } from '@shared/types';
import { CONSOLE_LEVEL_COLORS } from '@shared/types';
import { formatTime } from '@shared/utils';
import { computed, ref } from 'vue';

const props = defineProps<{
    visible: boolean;
    collapsed: boolean;
    currentPackage: RRTPackage | null;
}>();

defineEmits<{
    toggleCollapse: [];
}>();

const activeTab = ref(0);
const searchQuery = ref('');
const expandedItems = ref(new Set<string>());
const panelHeight = ref(220);
let dragStartY = 0;
let dragStartH = 0;

const consoleLogs = computed(() => {
    if (!props.currentPackage)
        return [];
    let logs = props.currentPackage.consoleLogs;
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        logs = logs.filter(l => l.args.some(a => String(a).toLowerCase().includes(q)) || l.level.toLowerCase().includes(q));
    }
    return logs;
});

const networkLogs = computed(() => {
    if (!props.currentPackage)
        return [];
    let logs = props.currentPackage.networkLogs;
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        logs = logs.filter(l => l.url.toLowerCase().includes(q) || l.method.toLowerCase().includes(q));
    }
    return logs;
});

function toggleItem(key: string) {
    if (expandedItems.value.has(key))
        expandedItems.value.delete(key);
    else expandedItems.value.add(key);
}

function statusColor(status: number): string {
    if (status >= 200 && status < 300)
        return '#a6e3a1';
    if (status >= 300 && status < 400)
        return '#f9e2af';
    return '#f38ba8';
}

function onResizeStart(e: MouseEvent) {
    dragStartY = e.clientY;
    dragStartH = panelHeight.value;
    const onMove = (ev: MouseEvent) => {
        panelHeight.value = Math.max(80, Math.min(500, dragStartH + (dragStartY - ev.clientY)));
    };
    const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}
</script>

<template>
    <div
        v-if="visible"
        class="bottom-panel"
        :class="{ 'bottom-collapsed': collapsed }"
        :style="{ height: collapsed ? '36px' : `${panelHeight}px` }"
    >
        <div class="resize-handle" @mousedown="onResizeStart">
            <div class="resize-bar" />
        </div>

        <van-tabs
            v-model:active="activeTab"
            type="card"
            color="#cba6f7"
            title-active-color="#cdd6f4"
            title-inactive-color="#585b70"
            background="#0f0f14"
            :border="false"
        >
            <template #nav-right>
                <van-icon
                    :name="collapsed ? 'arrow-up' : 'arrow-down'"
                    size="16"
                    color="#585b70"
                    class="collapse-btn"
                    @click="$emit('toggleCollapse')"
                />
            </template>

            <van-tab title="控制台">
                <div v-if="!collapsed" class="tab-inner">
                    <van-field v-model="searchQuery" placeholder="搜索..." :border="false" class="search-field" />
                    <div class="log-list">
                        <div v-for="(log, i) in consoleLogs" :key="i" class="log-item" @click="toggleItem(`c-${i}`)">
                            <div class="log-header">
                                <span class="log-time">{{ formatTime(log.timestamp) }}</span>
                                <span class="log-level" :style="{ color: CONSOLE_LEVEL_COLORS[log.level] }">{{ log.level.toUpperCase() }}</span>
                                <span class="log-preview">{{ log.args.map(a => String(a)).join(' ').slice(0, 80) }}</span>
                                <van-icon :name="expandedItems.has(`c-${i}`) ? 'arrow-up' : 'arrow-down'" size="12" color="#585b70" />
                            </div>
                            <div v-if="expandedItems.has(`c-${i}`)" class="log-detail">
                                <div v-for="(arg, j) in log.args" :key="j">
                                    <strong>Arg {{ j + 1 }}:</strong> {{ typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg) }}
                                </div>
                                <div v-if="log.stackTrace" class="log-stack">
                                    <strong>Stack:</strong><pre>{{ log.stackTrace }}</pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </van-tab>

            <van-tab title="网络">
                <div v-if="!collapsed" class="tab-inner">
                    <van-field v-model="searchQuery" placeholder="搜索..." :border="false" class="search-field" />
                    <div class="log-list">
                        <div v-for="(log, i) in networkLogs" :key="i" class="log-item" @click="toggleItem(`n-${i}`)">
                            <div class="log-header">
                                <span class="log-time">{{ formatTime(log.startTime) }}</span>
                                <span class="log-method">{{ log.method }}</span>
                                <span class="log-status" :style="{ color: statusColor(log.status) }">{{ log.status }}</span>
                                <span class="log-preview">{{ log.url.slice(0, 60) }}</span>
                                <span class="log-duration">{{ log.duration }}ms</span>
                                <van-icon :name="expandedItems.has(`n-${i}`) ? 'arrow-up' : 'arrow-down'" size="12" color="#585b70" />
                            </div>
                            <div v-if="expandedItems.has(`n-${i}`)" class="log-detail">
                                <div><strong>URL:</strong> {{ log.url }}</div>
                                <div><strong>Status:</strong> {{ log.status }} {{ log.statusText }}</div>
                                <div><strong>Duration:</strong> {{ log.duration }}ms</div>
                                <div v-if="Object.keys(log.requestHeaders).length">
                                    <strong>Request Headers:</strong><pre>{{ JSON.stringify(log.requestHeaders, null, 2) }}</pre>
                                </div>
                                <div v-if="Object.keys(log.responseHeaders).length">
                                    <strong>Response Headers:</strong><pre>{{ JSON.stringify(log.responseHeaders, null, 2) }}</pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </van-tab>
        </van-tabs>
    </div>
</template>

<style scoped>
.bottom-panel {
  flex-shrink: 0;
  background: #18181f;
  border-top: 1px solid #2a2a38;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}
.bottom-collapsed { overflow: hidden; }
.resize-handle {
  position: absolute; top: -2px; left: 0; right: 0; height: 8px;
  cursor: ns-resize; z-index: 10;
  display: flex; justify-content: center; align-items: center;
}
.resize-bar { width: 40px; height: 3px; background: #2a2a38; border-radius: 2px; transition: background 0.15s; }
.resize-handle:hover .resize-bar { background: #cba6f7; }
.collapse-btn { margin-right: 10px; cursor: pointer; padding: 4px; }
.tab-inner { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.search-field { flex-shrink: 0; background: #0f0f14 !important; }
.log-list { flex: 1; overflow-y: auto; padding: 4px 0; }
.log-item { padding: 6px 10px; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer; font-size: 11px; transition: background 0.1s; }
.log-item:hover { background: rgba(255,255,255,0.03); }
.log-header { display: flex; align-items: center; gap: 6px; }
.log-time { color: #585b70; min-width: 40px; font-variant-numeric: tabular-nums; font-size: 10px; }
.log-level { font-weight: 700; font-size: 10px; min-width: 36px; }
.log-method { font-weight: 700; font-size: 11px; color: #cdd6f4; min-width: 32px; }
.log-status { font-weight: 600; font-size: 11px; min-width: 24px; }
.log-preview { color: #bac2de; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.log-duration { color: #585b70; font-size: 10px; min-width: 36px; text-align: right; }
.log-detail { margin-top: 6px; padding: 8px; background: #0f0f14; border-radius: 6px; font-size: 11px; color: #bac2de; max-height: 180px; overflow-y: auto; word-break: break-all; }
.log-detail pre { margin-top: 4px; font-size: 10px; color: #a6adc8; white-space: pre-wrap; word-break: break-all; }
.log-stack { margin-top: 6px; color: #f38ba8; }
.log-stack pre { font-size: 10px; }
</style>
