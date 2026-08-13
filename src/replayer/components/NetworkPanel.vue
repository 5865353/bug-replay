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

// ---- 排序 ----
type SortField = 'method' | 'status' | 'type' | 'time' | null;
const sortField = ref<SortField>(null);
const sortAsc = ref(true);

function toggleSort(field: SortField) {
    if (sortField.value === field) {
        sortAsc.value = !sortAsc.value;
    }
    else {
        sortField.value = field;
        sortAsc.value = true;
    }
}

function sortIcon(field: SortField): string {
    if (sortField.value !== field)
        return '↕';
    return sortAsc.value ? '↑' : '↓';
}

// ---- 列表数据 ----
const visibleLogs = computed(() => {
    let list = props.logs.filter(l => l.startTime <= props.currentTime);
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        list = list.filter(l =>
            l.url.toLowerCase().includes(q) || l.method.toLowerCase().includes(q)
        );
    }

    // 排序
    if (sortField.value) {
        list = [...list].sort((a, b) => {
            let va: string | number;
            let vb: string | number;
            switch (sortField.value) {
                case 'method':
                    va = a.method;
                    vb = b.method;
                    break;
                case 'status':
                    va = a.status;
                    vb = b.status;
                    break;
                case 'type':
                    va = a.requestType;
                    vb = b.requestType;
                    break;
                case 'time':
                    va = a.duration;
                    vb = b.duration;
                    break;
                default:
                    return 0;
            }
            if (va < vb)
                return sortAsc.value ? -1 : 1;
            if (va > vb)
                return sortAsc.value ? 1 : -1;
            return 0;
        });
    }

    return list;
});

const selectedLog = computed(() =>
    selectedIndex.value !== null ? visibleLogs.value[selectedIndex.value] : null
);

function selectRow(i: number) {
    selectedIndex.value = selectedIndex.value === i ? null : i;
}

// ---- 状态码颜色 ----
function statusColor(s: number): string {
    if (s >= 200 && s < 300)
        return '#a6e3a1';
    if (s >= 300 && s < 400)
        return '#f9e2af';
    return '#f38ba8';
}

// ---- Content-Type 检测 ----
function getContentType(log: NetworkLog): string {
    const ct = log.responseHeaders?.['content-type'] || log.responseHeaders?.['Content-Type'] || '';
    return ct.toLowerCase();
}

function isImageResponse(log: NetworkLog): boolean {
    const ct = getContentType(log);
    return ct.startsWith('image/');
}

function isJsonResponse(log: NetworkLog): boolean {
    const ct = getContentType(log);
    return ct.includes('json') || ct.includes('javascript');
}

/** 检测请求体是否为 JSON（通过 Content-Type 请求头或尝试解析） */
function isJsonRequest(log: NetworkLog): boolean {
    if (!log.requestBody)
        return false;
    // 先检查请求头中的 Content-Type
    const ct = (log.requestHeaders?.['content-type'] || log.requestHeaders?.['Content-Type'] || '').toLowerCase();
    if (ct.includes('json'))
        return true;
    // 尝试解析
    try {
        JSON.parse(log.requestBody);
        return true;
    }
    catch {
        return false;
    }
}

// ---- 格式化 ----
const jsonFormatted = ref(true); // 默认开启 JSON 格式化

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

function bodyDisplay(raw: string | null, log: NetworkLog): string {
    if (!raw)
        return '';
    if (jsonFormatted.value && isJsonResponse(log)) {
        return formatJson(raw);
    }
    return raw;
}

function getImageSrc(log: NetworkLog): string {
    const body = log.responseBody;
    if (!body)
        return '';
    // 如果已经是 data: URI
    if (body.startsWith('data:image/'))
        return body;
    // 尝试构造 data URI
    const ct = getContentType(log) || 'image/png';
    return `data:${ct};base64,${body}`;
}
</script>

<template>
    <div class="net-panel">
        <!-- 搜索栏 -->
        <van-field v-model="searchQuery" placeholder="过滤 URL / Method..." :border="false" class="search-field" />

        <!-- 状态码颜色图例 -->
        <div class="status-legend">
            <span class="legend-dot" style="background:#a6e3a1" /> <span class="legend-text">2xx 成功</span>
            <span class="legend-dot" style="background:#f9e2af" /> <span class="legend-text">3xx 重定向</span>
            <span class="legend-dot" style="background:#f38ba8" /> <span class="legend-text">4xx/5xx 错误</span>
        </div>

        <div class="net-body" :class="{ 'has-detail': selectedLog }">
            <!-- 请求列表 -->
            <div class="net-table-wrap">
                <div class="net-thead">
                    <span class="th-name">名称</span>
                    <span class="th-status sortable" @click="toggleSort('status')">状态 {{ sortIcon('status') }}</span>
                    <span class="th-type sortable" @click="toggleSort('type')">类型 {{ sortIcon('type') }}</span>
                    <span class="th-time sortable" @click="toggleSort('time')">耗时 {{ sortIcon('time') }}</span>
                </div>
                <div class="net-tbody">
                    <div v-if="visibleLogs.length === 0" class="empty-hint">
                        {{ currentTime > 0 ? '暂无网络请求' : '等待播放...' }}
                    </div>
                    <div
                        v-for="(log, i) in visibleLogs" :key="i" class="net-row"
                        :class="{ selected: selectedIndex === i }" @click="selectRow(i)"
                    >
                        <span class="col-name">
                            <span class="net-method" :class="log.method.toLowerCase()">{{ log.method }}</span>
                            <span class="net-url">{{ log.url }}</span>
                        </span>
                        <span class="col-status" :style="{ color: statusColor(log.status) }">{{ log.status || '—'
                        }}</span>
                        <span class="col-type" :class="log.requestType">{{ log.requestType }}</span>
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
                    <button
                        v-if="(detailTab === 'response' && isJsonResponse(selectedLog)) || (detailTab === 'request' && isJsonRequest(selectedLog))"
                        class="fmt-btn"
                        :class="{ on: jsonFormatted }" title="切换 JSON 格式化" @click="jsonFormatted = !jsonFormatted"
                    >
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
                        <span :style="{ color: statusColor(selectedLog.status) }">
                            {{ selectedLog.status }} {{ selectedLog.statusText }}
                        </span>
                        <span class="ov-dur">{{ selectedLog.duration }}ms</span>
                        <span v-if="getContentType(selectedLog)" class="ov-ct">{{ getContentType(selectedLog) }}</span>
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
                        <div
                            v-if="!Object.keys(selectedLog.requestHeaders).length && !Object.keys(selectedLog.responseHeaders).length"
                            class="empty-hint"
                        >
                            无标头信息
                        </div>
                    </template>

                    <!-- 请求体 -->
                    <div v-if="detailTab === 'request'" class="detail-block">
                        <div class="block-title">
                            请求体
                        </div>
                        <pre
                            v-if="selectedLog.requestBody"
                            class="body-pre"
                            :class="{ 'json-body': isJsonRequest(selectedLog) }"
                        >{{ jsonFormatted && isJsonRequest(selectedLog) ? formatJson(selectedLog.requestBody) : selectedLog.requestBody }}</pre>
                        <div v-else class="empty-hint">
                            无请求体
                        </div>
                    </div>

                    <!-- 响应体 -->
                    <div v-if="detailTab === 'response'" class="detail-block">
                        <div class="block-title">
                            响应体
                            <span v-if="getContentType(selectedLog)" class="ct-badge">{{ getContentType(selectedLog)
                            }}</span>
                        </div>
                        <!-- 图片响应 -->
                        <div v-if="isImageResponse(selectedLog)" class="image-preview">
                            <img
                                :src="getImageSrc(selectedLog)" alt="Response Image"
                                @error="(e) => { (e.target as HTMLImageElement).style.display = 'none'; }"
                            >
                        </div>
                        <!-- JSON 响应 - 语法高亮 -->
                        <pre
                            v-else-if="isJsonResponse(selectedLog) && selectedLog.responseBody"
                            class="body-pre json-body"
                        >{{
                        bodyDisplay(selectedLog.responseBody, selectedLog) }}</pre>
                        <!-- 普通文本响应 -->
                        <pre v-else-if="selectedLog.responseBody" class="body-pre">{{ selectedLog.responseBody }}</pre>
                        <div v-else class="empty-hint">
                            无响应体
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.net-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
}

.search-field {
    flex-shrink: 0;
    background: #0f0f14 !important;
}

/* ======== 状态码图例 ======== */
.status-legend {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 12px;
    background: #15151e;
    border-bottom: 1px solid #32323e;
    flex-shrink: 0;
    font-size: 10px;
    color: #6b6b80;
    overflow-x: auto;
    white-space: nowrap;

    &::-webkit-scrollbar {
        display: none;
    }
}

.legend-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
}

.legend-text {
    margin-right: 10px;
}

/* ======== 主体 ======== */
.net-body {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-height: 0;

    &.has-detail .net-table-wrap {
        width: 55%;
        border-right: 1px solid #32323e;
    }
}

.net-table-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
}

/* 表头 */
.net-thead {
    display: flex;
    align-items: center;
    padding: 5px 10px;
    background: #22222c;
    border-bottom: 1px solid #32323e;
    font-size: 10px;
    color: #6b6b80;
    font-weight: 600;
    flex-shrink: 0;
    gap: 8px;
}

.th-name {
    flex: 1;
    min-width: 0;
}

.th-status {
    width: 50px;
    text-align: center;
}

.th-type {
    width: 42px;
    text-align: center;
}

.th-time {
    width: 52px;
    text-align: right;
}

.sortable {
    cursor: pointer;
    user-select: none;
    transition: color 0.12s;

    &:hover {
        color: #a0a0b8;
    }
}

/* 表体 */
.net-tbody {
    flex: 1;
    overflow-y: auto;
}

.empty-hint {
    text-align: center;
    padding: 16px;
    color: #6b6b80;
    font-size: 11px;
}

.net-row {
    display: flex;
    align-items: center;
    padding: 5px 10px;
    cursor: pointer;
    font-size: 11px;
    gap: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, .03);
    transition: background .1s;

    &:nth-child(odd) {
        background: rgba(255, 255, 255, .01);
    }

    &:hover {
        background: rgba(255, 255, 255, .05) !important;
    }

    &.selected {
        background: rgba(203, 166, 247, .1) !important;
    }
}

.col-name {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
}

.net-method {
    font-weight: 700;
    color: #a6e3a1;
    font-size: 11px;
    flex-shrink: 0;
    min-width: 36px;

    &.get {
        color: #a6e3a1;
    }

    &.post {
        color: #f9e2af;
    }

    &.put {
        color: #89b4fa;
    }

    &.delete {
        color: #f38ba8;
    }

    &.patch {
        color: #cba6f7;
    }

    &.head,
    &.options {
        color: #6b6b80;
    }
}

.net-url {
    color: #bac2de;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
}

.col-status {
    width: 50px;
    text-align: center;
    font-weight: 600;
    font-size: 11px;
}

.col-type {
    width: 42px;
    text-align: center;
    color: #6b6b80;
    font-size: 10px;

    &.xhr {
        color: #89b4fa;
    }

    &.fetch {
        color: #cba6f7;
    }
}

.col-time {
    width: 52px;
    text-align: right;
    color: #b0b0c4;
    font-size: 10px;
}

/* ======== 详情面板 ======== */
.net-detail {
    width: 45%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #1e1e28;
}

.detail-tabs {
    display: flex;
    align-items: center;
    gap: 1px;
    padding: 4px 6px;
    background: #22222c;
    border-bottom: 1px solid #32323e;
    flex-shrink: 0;

    button {
        padding: 3px 10px;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: #6b6b80;
        font-size: 11px;
        cursor: pointer;
        transition: all .15s;

        &:hover {
            color: #d0d0dc;
        }

        &.active {
            background: #32323e;
            color: #7ba4f5;
        }
    }
}

.fmt-btn {
    font-family: monospace;
    font-weight: 700;

    &.on {
        background: #32323e;
        color: #a6e3a1 !important;
    }
}

.detail-close {
    margin-left: auto;

    &:hover {
        color: #f38ba8 !important;
    }
}

.detail-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    font-size: 11px;
}

.detail-overview {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 6px 8px;
    background: #22222c;
    border-radius: 4px;
    color: #d0d0dc;
    margin-bottom: 8px;
    font-size: 11px;
}

.ov-url {
    color: #bac2de;
    word-break: break-all;
}

.ov-dur {
    color: #b0b0c4;
}

.ov-ct {
    color: #6b6b80;
    font-size: 10px;
    background: rgba(255, 255, 255, .04);
    padding: 1px 6px;
    border-radius: 3px;
}

.detail-block {
    margin-bottom: 8px;
}

.block-title {
    font-weight: 700;
    color: #b0b0c4;
    margin-bottom: 4px;
    font-size: 11px;
    padding-bottom: 2px;
    border-bottom: 1px solid rgba(255, 255, 255, .06);
    display: flex;
    align-items: center;
    gap: 6px;
}

.ct-badge {
    font-weight: 400;
    font-size: 9px;
    color: #7ba4f5;
    background: rgba(123, 164, 245, .1);
    padding: 1px 6px;
    border-radius: 3px;
}

.header-row {
    display: flex;
    padding: 1px 0;
    font-size: 11px;
    gap: 12px;
}

.hdr-key {
    color: #a8aac0;
    flex-shrink: 0;
    min-width: 96px;
}

.hdr-val {
    color: #d0d0dc;
    word-break: break-all;
}

.body-pre {
    font-size: 11px;
    color: #bac2de;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 240px;
    overflow-y: auto;
    background: #22222c;
    padding: 8px 10px;
    border-radius: 4px;
    margin: 0;
    font-family: 'Consolas', 'Courier New', monospace;
}

.json-body {
    color: #c0c0d4;
}

/* ======== 图片预览 ======== */
.image-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    background: #0e0e14;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, .04);
    max-height: 300px;
    overflow: hidden;

    img {
        max-width: 100%;
        max-height: 280px;
        object-fit: contain;
        border-radius: 3px;
    }
}
</style>
