<script setup lang="ts">
import type { NetworkLog } from '@shared/types';
import { computed, ref } from 'vue';

const props = defineProps<{
    logs: NetworkLog[];
    currentTime: number;
}>();

const searchQuery = ref('');
const selectedIndex = ref<number | null>(null);
const detailTab = ref<'headers' | 'request' | 'response'>('headers');
const formatted = ref(false);

const visibleLogs = computed(() => {
    let list = props.logs.filter(l => l.startTime <= props.currentTime);
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        list = list.filter(l =>
            l.url.toLowerCase().includes(q) || l.method.toLowerCase().includes(q),
        );
    }
    return list;
});

const selectedLog = computed(() =>
    selectedIndex.value !== null ? visibleLogs.value[selectedIndex.value] : null,
);

function selectRow(i: number) {
    selectedIndex.value = selectedIndex.value === i ? null : i;
}

function statusColor(s: number): string {
    if (s >= 200 && s < 300)
        return '#a6e3a1';
    if (s >= 300 && s < 400)
        return '#f9e2af';
    return '#f38ba8';
}

function formatJson(raw: string | null): string {
    if (!raw)
        return '';
    try {
        return JSON.stringify(JSON.parse(raw), null, 2);
    }
    catch {
        return raw;
    }
}

function bodyDisplay(raw: string | null): string {
    return formatted.value ? formatJson(raw) : (raw || '');
}
</script>

<template>
    <div class="net-panel">
        <van-field v-model="searchQuery" placeholder="过滤..." :border="false" class="search-field" />
        <div class="net-body" :class="{ 'has-detail': selectedLog }">
            <!-- 请求列表 -->
            <div class="net-table-wrap">
                <div class="net-thead">
                    <span class="th-name">名称</span>
                    <span class="th-status">状态</span>
                    <span class="th-type">类型</span>
                    <span class="th-time">时间</span>
                </div>
                <div class="net-tbody">
                    <div v-if="visibleLogs.length === 0" class="empty-hint">
                        {{ currentTime > 0 ? '暂无网络请求' : '等待播放...' }}
                    </div>
                    <div
                        v-for="(log, i) in visibleLogs"
                        :key="i"
                        class="net-row"
                        :class="{ selected: selectedIndex === i }"
                        @click="selectRow(i)"
                    >
                        <span class="col-name">
                            <span class="net-method">{{ log.method }}</span>
                            <span class="net-url">{{ log.url }}</span>
                        </span>
                        <span class="col-status" :style="{ color: statusColor(log.status) }">{{ log.status || '—' }}</span>
                        <span class="col-type">{{ log.requestType }}</span>
                        <span class="col-time">{{ log.duration }}ms</span>
                    </div>
                </div>
            </div>

            <!-- 详情面板 -->
            <div v-if="selectedLog" class="net-detail">
                <div class="detail-tabs">
                    <button :class="{ active: detailTab === 'headers' }" @click="detailTab = 'headers'">
                        标头
                    </button>
                    <button :class="{ active: detailTab === 'request' }" @click="detailTab = 'request'">
                        请求
                    </button>
                    <button :class="{ active: detailTab === 'response' }" @click="detailTab = 'response'">
                        响应
                    </button>
                    <button class="fmt-btn" :class="{ on: formatted }" title="格式化 JSON" @click="formatted = !formatted">
                        { }
                    </button>
                    <button class="detail-close" @click="selectedIndex = null">
                        ✕
                    </button>
                </div>
                <div class="detail-content">
                    <!-- 概览 -->
                    <div class="detail-overview">
                        <span class="ov-url">{{ selectedLog.method }} {{ selectedLog.url }}</span>
                        <span :style="{ color: statusColor(selectedLog.status) }">{{ selectedLog.status }} {{ selectedLog.statusText }}</span>
                        <span class="ov-dur">{{ selectedLog.duration }}ms</span>
                    </div>

                    <!-- 标头 -->
                    <template v-if="detailTab === 'headers'">
                        <div v-if="Object.keys(selectedLog.requestHeaders).length" class="detail-block">
                            <div class="block-title">
                                请求标头
                            </div>
                            <div v-for="(v, k) in selectedLog.requestHeaders" :key="k" class="header-row">
                                <span class="hdr-key">{{ k }}</span><span class="hdr-val">{{ v }}</span>
                            </div>
                        </div>
                        <div v-if="Object.keys(selectedLog.responseHeaders).length" class="detail-block">
                            <div class="block-title">
                                响应标头
                            </div>
                            <div v-for="(v, k) in selectedLog.responseHeaders" :key="k" class="header-row">
                                <span class="hdr-key">{{ k }}</span><span class="hdr-val">{{ v }}</span>
                            </div>
                        </div>
                        <div v-if="!Object.keys(selectedLog.requestHeaders).length && !Object.keys(selectedLog.responseHeaders).length" class="empty-hint">
                            无标头信息
                        </div>
                    </template>

                    <!-- 请求体 -->
                    <div v-if="detailTab === 'request'" class="detail-block">
                        <div class="block-title">
                            请求体
                        </div>
                        <pre v-if="selectedLog.requestBody" class="body-pre">{{ bodyDisplay(selectedLog.requestBody) }}</pre>
                        <div v-else class="empty-hint">
                            无请求体
                        </div>
                    </div>

                    <!-- 响应体 -->
                    <div v-if="detailTab === 'response'" class="detail-block">
                        <div class="block-title">
                            响应体
                        </div>
                        <pre v-if="selectedLog.responseBody" class="body-pre">{{ bodyDisplay(selectedLog.responseBody) }}</pre>
                        <div v-else class="empty-hint">
                            无响应体
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.net-panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.search-field { flex-shrink: 0; background: #0f0f14 !important; }
.net-body { flex: 1; display: flex; overflow: hidden; min-height: 0; }

.net-body.has-detail .net-table-wrap { width: 55%; border-right: 1px solid #32323e; }
.net-table-wrap { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

/* 表头 */
.net-thead {
    display: flex; align-items: center; padding: 5px 10px;
    background: #22222c; border-bottom: 1px solid #32323e;
    font-size: 10px; color: #6b6b80; font-weight: 600; flex-shrink: 0; gap: 8px;
}
.th-name { flex: 1; min-width: 0; }
.th-status { width: 40px; text-align: center; }
.th-type { width: 36px; text-align: center; }
.th-time { width: 48px; text-align: right; }

/* 表体 */
.net-tbody { flex: 1; overflow-y: auto; }
.empty-hint { text-align: center; padding: 16px; color: #6b6b80; font-size: 11px; }
.net-row {
    display: flex; align-items: center; padding: 5px 10px; cursor: pointer;
    font-size: 11px; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.03);
    transition: background 0.1s;
}
.net-row:nth-child(odd) { background: rgba(255,255,255,0.01); }
.net-row:hover { background: rgba(255,255,255,0.05) !important; }
.net-row.selected { background: rgba(203,166,247,0.1) !important; }

.col-name { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; overflow: hidden; }
.net-method { font-weight: 700; color: #a6e3a1; font-size: 11px; flex-shrink: 0; min-width: 36px; }
.net-url { color: #bac2de; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
.col-status { width: 40px; text-align: center; font-weight: 600; font-size: 11px; }
.col-type { width: 36px; text-align: center; color: #6b6b80; font-size: 10px; }
.col-time { width: 48px; text-align: right; color: #b0b0c4; font-size: 10px; }

/* 详情 */
.net-detail { width: 45%; display: flex; flex-direction: column; overflow: hidden; background: #1e1e28; }
.detail-tabs {
    display: flex; align-items: center; gap: 1px; padding: 4px 6px;
    background: #22222c; border-bottom: 1px solid #32323e; flex-shrink: 0;
}
.detail-tabs button {
    padding: 3px 10px; border: none; border-radius: 4px;
    background: transparent; color: #6b6b80; font-size: 11px; cursor: pointer; transition: all 0.15s;
}
.detail-tabs button:hover { color: #d0d0dc; }
.detail-tabs button.active { background: #32323e; color: #7ba4f5; }
.fmt-btn { font-family: monospace; font-weight: 700; }
.fmt-btn.on { background: #32323e; color: #a6e3a1 !important; }
.detail-close { margin-left: auto; }
.detail-close:hover { color: #f38ba8 !important; }

.detail-content { flex: 1; overflow-y: auto; padding: 8px; font-size: 11px; }
.detail-overview { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 8px; background: #22222c; border-radius: 4px; color: #d0d0dc; margin-bottom: 8px; font-size: 11px; }
.ov-url { color: #bac2de; word-break: break-all; }
.ov-dur { color: #b0b0c4; }

.detail-block { margin-bottom: 8px; }
.block-title { font-weight: 700; color: #b0b0c4; margin-bottom: 4px; font-size: 11px; padding-bottom: 2px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.header-row { display: flex; padding: 1px 0; font-size: 11px; gap: 12px; }
.hdr-key { color: #a8aac0; flex-shrink: 0; min-width: 96px; }
.hdr-val { color: #d0d0dc; word-break: break-all; }
.body-pre { font-size: 11px; color: #bac2de; white-space: pre-wrap; word-break: break-all; max-height: 200px; overflow-y: auto; background: #22222c; padding: 6px 8px; border-radius: 4px; margin: 0; }
</style>
