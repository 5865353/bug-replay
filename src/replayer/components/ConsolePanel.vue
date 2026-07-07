<script setup lang="ts">
import type { ConsoleLog } from '@shared/types';
import { CONSOLE_LEVEL_COLORS } from '@shared/types';
import { formatTime } from '@shared/utils';
import { computed, ref } from 'vue';

const props = defineProps<{
    logs: ConsoleLog[];
    currentTime: number;
}>();

const searchQuery = ref('');
const expandedItems = ref(new Set<string>());

const visibleLogs = computed(() => {
    let list = props.logs.filter(l => l.timestamp <= props.currentTime);
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        list = list.filter(l =>
            l.args.some(a => String(a).toLowerCase().includes(q))
            || l.level.toLowerCase().includes(q),
        );
    }
    return list;
});

function toggleItem(key: string) {
    if (expandedItems.value.has(key))
        expandedItems.value.delete(key);
    else expandedItems.value.add(key);
}
</script>

<template>
    <div class="con-panel">
        <van-field v-model="searchQuery" placeholder="过滤..." :border="false" class="search-field" />
        <div class="con-list">
            <div v-if="visibleLogs.length === 0" class="empty-hint">
                {{ currentTime > 0 ? '暂无日志' : '等待播放...' }}
            </div>
            <div
                v-for="(log, i) in visibleLogs"
                :key="i"
                class="con-item"
                @click="toggleItem(`c-${i}`)"
            >
                <div class="con-header">
                    <span class="con-time">{{ formatTime(log.timestamp) }}</span>
                    <span class="con-level" :style="{ color: CONSOLE_LEVEL_COLORS[log.level] }">
                        {{ log.level.toUpperCase() }}
                    </span>
                    <span class="con-preview">
                        {{ log.args.map(a => String(a)).join(' ').slice(0, 100) }}
                    </span>
                    <van-icon
                        :name="expandedItems.has(`c-${i}`) ? 'arrow-up' : 'arrow-down'"
                        size="12" color="#585b70"
                    />
                </div>
                <div v-if="expandedItems.has(`c-${i}`)" class="con-detail">
                    <div v-for="(arg, j) in log.args" :key="j" class="con-arg">
                        <strong>Arg {{ j + 1 }}:</strong>
                        {{ typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg) }}
                    </div>
                    <div v-if="log.stackTrace" class="con-stack">
                        <strong>Stack:</strong><pre>{{ log.stackTrace }}</pre>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.con-panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.search-field { flex-shrink: 0; background: #0f0f14 !important; }
.con-list { flex: 1; overflow-y: auto; }
.empty-hint { text-align: center; padding: 16px; color: #585b70; font-size: 11px; }
.con-item {
    padding: 5px 10px; border-bottom: 1px solid rgba(255,255,255,0.03);
    cursor: pointer; font-size: 11px; transition: background 0.1s;
}
.con-item:hover { background: rgba(255,255,255,0.03); }
.con-header { display: flex; align-items: center; gap: 6px; }
.con-time { color: #585b70; min-width: 36px; font-variant-numeric: tabular-nums; font-size: 10px; }
.con-level { font-weight: 700; font-size: 10px; min-width: 34px; }
.con-preview { color: #bac2de; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.con-detail { margin-top: 4px; padding: 6px 8px; background: #101016; border-radius: 4px; font-size: 11px; color: #bac2de; max-height: 180px; overflow-y: auto; }
.con-arg { margin-bottom: 4px; word-break: break-all; }
.con-arg strong { color: #9399b2; }
.con-stack { margin-top: 4px; color: #f38ba8; }
.con-stack pre { font-size: 10px; white-space: pre-wrap; }
</style>
