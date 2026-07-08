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
        <!-- 褰曞埗鍏冩暟鎹?-->
        <div class="info-section">
            <div class="section-title">
                馃摝 褰曞埗鍏冩暟鎹?
            </div>
            <div class="info-row">
                <span>鏍囬</span><span class="val">{{ package.metadata.title }}</span>
            </div>
            <div class="info-row">
                <span>鏃堕暱</span><span class="val">{{ formatDuration(package.metadata.duration) }}</span>
            </div>
            <div class="info-row">
                <span>鏍煎紡鐗堟湰</span><span class="val">{{ package.version }}</span>
            </div>
            <div class="info-row">
                <span>瀵煎嚭鏃堕棿</span><span class="val">{{ formatDate(package.exportedAt) }}</span>
            </div>
            <div class="info-row">
                <span>鎻掍欢鐗堟湰</span><span class="val">{{ package.metadata.extensionVersion }}</span>
            </div>
            <div class="divider" />
            <div class="info-row">
                <span>DOM 浜嬩欢</span><span class="val">{{ package.rrwebEvents.length }}</span>
            </div>
            <div class="info-row">
                <span>缃戠粶璇锋眰</span><span class="val">{{ package.networkLogs.length }}</span>
            </div>
            <div class="info-row">
                <span>鎺у埗鍙版棩蹇?/span><span class="val">{{ package.consoleLogs.length }}</span>
            </div>
            <div class="info-row">
                <span>鏍囨敞鍏抽敭甯?/span><span class="val">{{ package.annotations.length }}</span>
            </div>
            <div class="info-row">
                <span>椤甸潰浜嬩欢</span><span class="val">{{ package.pageEvents?.length ?? 0 }}</span>
            </div>
            <div v-if="package.metadata.tags?.length" class="info-row">
                <span>鏍囩</span><span class="val">{{ package.metadata.tags.join(', ') }}</span>
            </div>
            <div v-if="package.metadata.description" class="info-row">
                <span>鎻忚堪</span><span class="val text-right">{{ package.metadata.description }}</span>
            </div>
        </div>

        <!-- 鐜淇℃伅 -->
        <div v-if="env" class="info-section">
            <div class="section-title">
                馃枼 鐜淇℃伅
            </div>
            <div class="info-row">
                <span>椤甸潰鏍囬</span><span class="val">{{ env.title }}</span>
            </div>
            <div class="info-row">
                <span>URL</span><span class="val break">{{ env.url }}</span>
            </div>
            <div class="info-row">
                <span>骞冲彴</span><span class="val">{{ env.platform }}</span>
            </div>
            <div class="info-row">
                <span>璇█</span><span class="val">{{ env.language }}</span>
            </div>
            <div class="info-row">
                <span>褰曞埗鏃跺埢</span><span class="val">{{ formatDate(env.timestamp) }}</span>
            </div>
            <div class="divider" />
            <div class="info-row">
                <span>灞忓箷鍒嗚鲸鐜?/span>
                <span class="val">{{ env.screenResolution?.width }}脳{{ env.screenResolution?.height }}</span>
            </div>
            <div class="info-row">
                <span>瑙嗗彛 / DPR</span>
                <span class="val">{{ env.viewport?.width }}脳{{ env.viewport?.height }} @{{ env.devicePixelRatio }}x</span>
            </div>
            <div class="divider" />
            <div class="clickable-row" @click="emit('showCookies')">
                <span>Cookies</span><span class="val">{{ env.cookies?.length || 0 }} 椤?鈻?/span>
            </div>
            <div class="clickable-row" @click="emit('showStorage', 'LocalStorage', env.localStorage)">
                <span>LocalStorage</span><span class="val">{{ storageCount(env.localStorage) }} 椤?鈻?/span>
            </div>
            <div class="clickable-row" @click="emit('showStorage', 'SessionStorage', env.sessionStorage)">
                <span>SessionStorage</span><span class="val">{{ storageCount(env.sessionStorage) }} 椤?鈻?/span>
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
    flex: 1;
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
        letter-spacing: 0.5px;
    }

    .divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.05);
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
    transition: background 0.1s;

    &:hover { background: rgba(255, 255, 255, 0.03); }

    span:first-child { color: #6b6b80; }
    .val { color: #b0b0c4; }
}
</style>
