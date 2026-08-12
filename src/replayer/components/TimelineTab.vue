<script setup lang="ts">
import type { PageEvent } from '@shared/types';
import { computed, ref } from 'vue';

const props = defineProps<{
    pageEvents: PageEvent[];
}>();

const emit = defineEmits<{
    seek: [time: number];
}>();

const MIN_GROUP_INTERVAL = 2000; // 同一组内事件间隔阈值（ms）

// ---- 筛选 ----
type FilterType = 'all' | 'url_change' | 'storage_change';
const activeFilter = ref<FilterType>('all');

// ---- 折叠状态: Map<groupIndex, boolean> ----
const collapsedGroups = ref<Record<number, boolean>>({});

function toggleGroup(idx: number) {
    collapsedGroups.value = {
        ...collapsedGroups.value,
        [idx]: !collapsedGroups.value[idx],
    };
}

// ---- 分组 & 筛选 ----
interface TimelineGroup {
    time: number;
    events: PageEvent[];
}

const filteredEvents = computed<PageEvent[]>(() => {
    if (activeFilter.value === 'all')
        return props.pageEvents || [];
    return (props.pageEvents || []).filter(ev => ev.type === activeFilter.value);
});

const groupedPageEvents = computed<TimelineGroup[]>(() => {
    const events = filteredEvents.value;
    if (events.length === 0)
        return [];
    const groups: TimelineGroup[] = [];
    let current: TimelineGroup | null = null;

    for (const ev of events) {
        if (!current || ev.timestamp - current.time > MIN_GROUP_INTERVAL) {
            current = { time: ev.timestamp, events: [ev] };
            groups.push(current);
        }
        else {
            current.events.push(ev);
        }
    }

    return groups;
});

// ---- 事件计数 ----
const urlChangeCount = computed(() =>
    (props.pageEvents || []).filter(ev => ev.type === 'url_change').length,
);
const storageChangeCount = computed(() =>
    (props.pageEvents || []).filter(ev => ev.type === 'storage_change').length,
);

// ---- 格式化 ----
function formatDuration(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

function formatTimeFull(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const milli = Math.floor(ms % 1000);
    return `${m}:${sec.toString().padStart(2, '0')}.${milli.toString().padStart(3, '0')}`;
}

function handleEventClick(timestamp: number) {
    emit('seek', timestamp);
}
</script>

<template>
    <div class="timeline-panel">
        <!-- ======== 筛选栏 ======== -->
        <div class="filter-bar">
            <button
                class="filter-chip"
                :class="{ active: activeFilter === 'all' }"
                @click="activeFilter = 'all'"
            >
                全部 <span class="chip-count">{{ (pageEvents || []).length }}</span>
            </button>
            <button
                class="filter-chip url"
                :class="{ active: activeFilter === 'url_change' }"
                @click="activeFilter = 'url_change'"
            >
                🔗 URL <span class="chip-count">{{ urlChangeCount }}</span>
            </button>
            <button
                class="filter-chip storage"
                :class="{ active: activeFilter === 'storage_change' }"
                @click="activeFilter = 'storage_change'"
            >
                📦 Storage <span class="chip-count">{{ storageChangeCount }}</span>
            </button>
        </div>

        <!-- ======== 事件列表 ======== -->
        <div class="panel-content">
            <van-empty v-if="!groupedPageEvents.length" description="暂无匹配事件" :image-size="40" />

            <div v-else class="timeline-list">
                <div
                    v-for="(group, gi) in groupedPageEvents"
                    :key="gi"
                    class="tl-group"
                    :class="{ 'tl-group-collapsible': group.events.length > 1 }"
                >
                    <!-- 时间线圆点 -->
                    <div class="tl-dot" :class="group.events[0].type" />

                    <!-- 组头（可点击折叠） -->
                    <div
                        class="tl-group-header"
                        :class="{ clickable: group.events.length > 1 }"
                        @click="group.events.length > 1 && toggleGroup(gi)"
                    >
                        <span class="tl-time">{{ formatDuration(group.time) }}</span>
                        <span v-if="group.events.length > 1" class="tl-group-badge">
                            {{ group.events.length }} 个事件
                            <span class="tl-chevron">{{ collapsedGroups[gi] ? '▶' : '▼' }}</span>
                        </span>
                    </div>

                    <!-- 事件列表（折叠状态） -->
                    <div v-if="!collapsedGroups[gi]" class="tl-content">
                        <div
                            v-for="(ev, ei) in group.events"
                            :key="ei"
                            class="tl-item"
                            :class="{ 'tl-sub': group.events.length > 1 }"
                            @click="handleEventClick(ev.timestamp)"
                        >
                            <!-- URL 变更 -->
                            <template v-if="ev.type === 'url_change' && ev.data.type === 'url_change'">
                                <div class="tl-item-head">
                                    <span class="tl-icon">🔗</span>
                                    <span class="tl-text">URL 变更</span>
                                    <span class="tl-item-time">{{ formatTimeFull(ev.timestamp) }}</span>
                                </div>
                                <div class="tl-detail">
                                    <div class="tl-url-row">
                                        <span class="tl-url-label">从</span>
                                        <span class="tl-url">{{ ev.data.from }}</span>
                                    </div>
                                    <div class="tl-url-arrow">
                                        ⬇
                                    </div>
                                    <div class="tl-url-row">
                                        <span class="tl-url-label">到</span>
                                        <span class="tl-url to">{{ ev.data.to }}</span>
                                    </div>
                                </div>
                            </template>

                            <!-- Storage 变更 -->
                            <template v-if="ev.type === 'storage_change' && ev.data.type === 'storage_change'">
                                <div class="tl-item-head">
                                    <span class="tl-icon">{{ ev.data.storageType === 'local' ? '📦' : '📋' }}</span>
                                    <span class="tl-text">
                                        {{ ev.data.storageType === 'local' ? 'Local' : 'Session' }}Storage
                                    </span>
                                    <span
                                        class="tl-badge"
                                        :class="ev.data.action"
                                    >
                                        {{ ev.data.action === 'set' ? '设置' : ev.data.action === 'remove' ? '移除' : '清空' }}
                                    </span>
                                    <span class="tl-item-time">{{ formatTimeFull(ev.timestamp) }}</span>
                                </div>
                                <div v-if="ev.data.key" class="tl-detail">
                                    <div class="tl-kv-row">
                                        <span class="tl-key">{{ ev.data.key }}</span>
                                        <span v-if="ev.data.action === 'set' && ev.data.newValue" class="tl-eq">=</span>
                                    </div>
                                    <div v-if="ev.data.action === 'set' && ev.data.newValue" class="tl-val">
                                        {{ ev.data.newValue.length > 100 ? `${ev.data.newValue.slice(0, 100)}...` : ev.data.newValue }}
                                    </div>
                                    <div v-else-if="ev.data.action === 'remove'" class="tl-val removed">
                                        已删除
                                    </div>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.timeline-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* ======== 筛选栏 ======== */
.filter-bar {
    display: flex;
    gap: 6px;
    padding: 8px 12px;
    background: #1a1a24;
    border-bottom: 1px solid #32323e;
    flex-shrink: 0;
    overflow-x: auto;

    &::-webkit-scrollbar { display: none; }
}

.filter-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 12px;
    border: 1px solid #3a3a4e;
    background: transparent;
    color: #6b6b80;
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;

    &:hover {
        border-color: #5a5a72;
        color: #a0a0b8;
    }

    &.active {
        background: #32324a;
        border-color: #7ba4f5;
        color: #d0d0dc;
    }

    &.url.active {
        border-color: #7ba4f5;
        background: rgba(123, 164, 245, .12);
    }

    &.storage.active {
        border-color: #a6e3a1;
        background: rgba(166, 227, 161, .10);
    }

    .chip-count {
        font-size: 10px;
        padding: 0 4px;
        border-radius: 6px;
        background: rgba(255, 255, 255, .06);
        color: #8a8aa0;
    }

    &.active .chip-count {
        background: rgba(255, 255, 255, .12);
        color: #c0c0d4;
    }
}

/* ======== 内容区 ======== */
.panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 10px 12px;

    &::-webkit-scrollbar {
        width: 4px;
    }
    &::-webkit-scrollbar-thumb {
        background: #3a3a4e;
        border-radius: 2px;
    }
}

/* ======== 时间轴 ======== */
.timeline-list {
    position: relative;
    padding-left: 18px;

    &::before {
        content: '';
        position: absolute;
        left: 6px;
        top: 4px;
        bottom: 4px;
        width: 2px;
        background: #32323e;
    }
}

.tl-group {
    position: relative;
    padding: 2px 0 8px;

    .tl-dot {
        position: absolute;
        left: -15px;
        top: 6px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #6b6b80;
        border: 2px solid #1a1a24;
        flex-shrink: 0;
        z-index: 1;

        &.url_change { background: #7ba4f5; }
        &.storage_change { background: #a6e3a1; }
    }
}

/* 组头 */
.tl-group-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 0;

    &.clickable {
        cursor: pointer;
        &:hover .tl-chevron { color: #a0a0b8; }
    }

    .tl-time {
        font-size: 11px;
        color: #7ba4f5;
        font-variant-numeric: tabular-nums;
        font-weight: 600;
    }

    .tl-group-badge {
        font-size: 10px;
        color: #6b6b80;
        display: flex;
        align-items: center;
        gap: 4px;

        .tl-chevron {
            font-size: 8px;
            color: #5a5a72;
            transition: color 0.15s;
        }
    }
}

/* 事件条目 */
.tl-content {
    margin-top: 2px;
}

.tl-item {
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.12s;

    &:hover {
        background: rgba(123, 164, 245, .06);
    }

    &.tl-sub {
        padding: 4px 0 4px 6px;
        border-left: 1px solid rgba(255, 255, 255, .05);
        margin-left: 3px;

        & + .tl-sub {
            margin-top: 2px;
            padding-top: 5px;
        }
    }
}

.tl-item-head {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 2px 0;

    .tl-icon { font-size: 13px; }
    .tl-text { font-size: 12px; color: #d0d0dc; font-weight: 500; }

    .tl-item-time {
        margin-left: auto;
        font-size: 10px;
        color: #5a5a72;
        font-variant-numeric: tabular-nums;
    }

    .tl-badge {
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 8px;
        font-weight: 500;

        &.set {
            background: rgba(166, 227, 161, .15);
            color: #a6e3a1;
        }
        &.remove {
            background: rgba(238, 65, 65, .12);
            color: #ee6565;
        }
        &.clear {
            background: rgba(238, 180, 65, .12);
            color: #eeb441;
        }
    }
}

/* 详情卡片 */
.tl-detail {
    margin: 4px 0 2px;
    padding: 8px 10px;
    background: #14141c;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, .04);
    font-size: 11px;

    .tl-url-row {
        display: flex;
        align-items: flex-start;
        gap: 6px;
    }

    .tl-url-label {
        color: #5a5a72;
        flex-shrink: 0;
        font-size: 10px;
        width: 16px;
    }

    .tl-url {
        color: #8a8aa0;
        word-break: break-all;
        line-height: 1.4;

        &.to {
            color: #b0b0c4;
        }
    }

    .tl-url-arrow {
        color: #5a5a72;
        font-size: 10px;
        padding: 1px 0 1px 6px;
    }

    .tl-kv-row {
        display: flex;
        align-items: center;
        gap: 5px;
        margin-bottom: 2px;
    }

    .tl-key {
        color: #c0c0d4;
        font-weight: 600;
        font-family: 'Consolas', 'Courier New', monospace;
        font-size: 11px;
    }

    .tl-eq {
        color: #5a5a72;
        font-size: 12px;
    }

    .tl-val {
        color: #8a8aa0;
        word-break: break-all;
        font-family: 'Consolas', 'Courier New', monospace;
        font-size: 10px;
        line-height: 1.5;
        max-height: 60px;
        overflow-y: auto;
        padding: 4px 6px;
        background: #0e0e14;
        border-radius: 4px;
        margin-top: 4px;

        &.removed {
            color: #ee6565;
            font-style: italic;
        }
    }
}
</style>
