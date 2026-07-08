<script setup lang="ts">
import type { RRTPackage } from '@shared/types';
import { computed } from 'vue';

const props = defineProps<{
    package: RRTPackage;
}>();

const emit = defineEmits<{
    showCookies: [];
    showStorage: [title: string, data: Record<string, string> | undefined];
}>();

function storageCount(obj: Record<string, string> | undefined): number {
    return obj ? Object.keys(obj).length : 0;
}

function formatDuration(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

function formatDate(ts: number): string {
    const d = new Date(ts);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const env = computed(() => props.package.environment);
</script>

<template>
    <div class="panel-content">
        <!-- 录制元数据 -->
        <div class="info-section">
            <div class="section-title">
                📦 录制元数据
            </div>
            <div class="info-row">
                <span>标题</span><span class="val">{{ package.metadata.title }}</span>
            </div>
            <div class="info-row">
                <span>时长</span><span class="val">{{ formatDuration(package.metadata.duration) }}</span>
            </div>
            <div class="info-row">
                <span>格式版本</span><span class="val">{{ package.version }}</span>
            </div>
            <div class="info-row">
                <span>导出时间</span><span class="val">{{ formatDate(package.exportedAt) }}</span>
            </div>
            <div class="info-row">
                <span>插件版本</span><span class="val">{{ package.metadata.extensionVersion }}</span>
            </div>
            <div class="divider" />
            <div class="info-row">
                <span>DOM 事件</span><span class="val">{{ package.rrwebEvents.length }}</span>
            </div>
            <div class="info-row">
                <span>网络请求</span><span class="val">{{ package.networkLogs.length }}</span>
            </div>
            <div class="info-row">
                <span>控制台日志</span><span class="val">{{ package.consoleLogs.length }}</span>
            </div>
            <div class="info-row">
                <span>标注关键帧</span><span class="val">{{ package.annotations.length }}</span>
            </div>
            <div v-if="package.metadata.tags?.length" class="info-row">
                <span>标签</span><span class="val">{{ package.metadata.tags.join(', ') }}</span>
            </div>
            <div v-if="package.metadata.description" class="info-row">
                <span>描述</span><span class="val text-right">{{ package.metadata.description }}</span>
            </div>
        </div>

        <!-- 环境信息 -->
        <div v-if="env" class="info-section">
            <div class="section-title">
                🖥 环境信息
            </div>
            <div class="info-row">
                <span>页面标题</span><span class="val">{{ env.title }}</span>
            </div>
            <div class="info-row">
                <span>URL</span><span class="val break">{{ env.url }}</span>
            </div>
            <div class="info-row">
                <span>平台</span><span class="val">{{ env.platform }}</span>
            </div>
            <div class="info-row">
                <span>语言</span><span class="val">{{ env.language }}</span>
            </div>
            <div class="info-row">
                <span>录制时刻</span><span class="val">{{ formatDate(env.timestamp) }}</span>
            </div>
            <div class="divider" />
            <div class="info-row">
                <span>屏幕分辨率</span>
                <span class="val">{{ env.screenResolution?.width }}×{{ env.screenResolution?.height }}</span>
            </div>
            <div class="info-row">
                <span>视口 / DPR</span>
                <span class="val">{{ env.viewport?.width }}×{{ env.viewport?.height }} @{{ env.devicePixelRatio }}x</span>
            </div>
            <div class="divider" />
            <div class="clickable-row" @click="emit('showCookies')">
                <span>Cookies</span><span class="val">{{ env.cookies?.length || 0 }} 项 ▸</span>
            </div>
            <div class="clickable-row" @click="emit('showStorage', 'LocalStorage', env.localStorage)">
                <span>LocalStorage</span><span class="val">{{ storageCount(env.localStorage) }} 项 ▸</span>
            </div>
            <div class="clickable-row" @click="emit('showStorage', 'SessionStorage', env.sessionStorage)">
                <span>SessionStorage</span><span class="val">{{ storageCount(env.sessionStorage) }} 项 ▸</span>
            </div>
            <div class="divider" />
            <div class="info-row ua-row">
                <span>UA</span>
                <span class="val ua">{{ env.userAgent }}</span>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.panel-content {
    height: 100%;
    overflow-y: auto;
    padding: 12px;
}

.info-section {
    margin-bottom: 14px;

    .section-title {
        font-size: 13px;
        font-weight: 600;
        color: #6b6b80;
        margin-bottom: 8px;
        letter-spacing: .5px;
    }

    .divider {
        height: 1px;
        background: rgba(255, 255, 255, .05);
        margin: 6px 0;
    }
}

.info-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 3px 0;
    font-size: 12px;
    gap: 8px;

    span:first-child { color: #6b6b80; flex-shrink: 0; }

    .val {
        color: #b0b0c4;
        text-align: right;
        word-break: break-all;

        &.break { word-break: break-all; }
        &.text-right { text-align: right; }
    }

    &.ua-row {
        flex-direction: column;
        gap: 2px;

        .ua {
            font-size: 10px;
            text-align: left;
            color: #6b6b80;
            line-height: 1.4;
        }
    }
}

.clickable-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 6px;
    font-size: 12px;
    cursor: pointer;
    border-radius: 4px;
    transition: background .1s;

    &:hover { background: rgba(255, 255, 255, .03); }

    span:first-child { color: #6b6b80; }
    .val { color: #b0b0c4; }
}
</style>
