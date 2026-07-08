<script setup lang="ts">
import type { RRTPackage } from '@shared/types';
import { showToast } from 'vant';
import { computed, ref } from 'vue';

const props = defineProps<{
    package: RRTPackage;
}>();

const activeTab = ref(0);
const storagePopup = ref({ show: false, title: '', data: {} as Record<string, string> });

function showStorage(title: string, data: Record<string, string> | undefined) {
    storagePopup.value = { show: true, title, data: data || {} };
}

function storageCount(obj: Record<string, string> | undefined): number {
    return obj ? Object.keys(obj).length : 0;
}

async function copyText(text: string) {
    try {
        await navigator.clipboard.writeText(text);
    }
    catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
    }
    showToast({
        message: '已复制',
        duration: 1200,
        className: 'copy-toast',
    });
}

function copyAll() {
    copyText(JSON.stringify(storagePopup.value.data, null, 2));
}

function copyEntry(key: string, value: string) {
    copyText(`${key}: ${value}`);
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

function showCookies() {
    const cookies = env.value?.cookies || [];
    const data: Record<string, string> = {};
    cookies.forEach((c) => {
        const meta = [c.domain, c.path, c.secure ? '🔒' : '', c.httpOnly ? 'httpOnly' : '']
            .filter(Boolean)
            .join(' | ');
        data[c.name] = meta ? `${c.value}\n${meta}` : c.value;
    });
    storagePopup.value = { show: true, title: 'Cookies', data };
}
</script>

<template>
    <div class="right-panel">
        <van-tabs
            v-model:active="activeTab"
            type="card" color="#7ba4f5"
            title-active-color="#d0d0dc" title-inactive-color="#6b6b80"
            background="#272732"
        >
            <van-tab title="录制信息">
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
                        <div class="clickable-row" @click="showCookies()">
                            <span>Cookies</span><span class="val">{{ env.cookies?.length || 0 }} 项 ▸</span>
                        </div>
                        <div class="clickable-row" @click="showStorage('LocalStorage', env.localStorage)">
                            <span>LocalStorage</span><span class="val">{{ storageCount(env.localStorage) }} 项 ▸</span>
                        </div>
                        <div class="clickable-row" @click="showStorage('SessionStorage', env.sessionStorage)">
                            <span>SessionStorage</span><span class="val">{{ storageCount(env.sessionStorage) }} 项 ▸</span>
                        </div>
                        <div class="divider" />
                        <div class="info-row ua-row">
                            <span>UA</span>
                            <span class="val ua">{{ env.userAgent }}</span>
                        </div>
                    </div>
                </div>
            </van-tab>

            <van-tab title="时间轴">
                <div class="panel-content">
                    <van-empty v-if="!package.pageEvents?.length" description="暂无页面事件" :image-size="40" />
                    <div v-else class="timeline-list">
                        <div v-for="(ev, i) in package.pageEvents" :key="i" class="tl-item">
                            <div class="tl-dot" :class="ev.type" />
                            <div class="tl-content">
                                <span class="tl-time">{{ formatDuration(ev.timestamp) }}</span>
                                <!-- URL 变更 -->
                                <template v-if="ev.type === 'url_change' && ev.data.type === 'url_change'">
                                    <span class="tl-icon">🔗</span>
                                    <span class="tl-text">URL 变更</span>
                                    <div class="tl-detail">
                                        <div class="tl-url">
                                            {{ ev.data.from }}
                                        </div>
                                        <div class="tl-arrow">
                                            ↓
                                        </div>
                                        <div class="tl-url to">
                                            {{ ev.data.to }}
                                        </div>
                                    </div>
                                </template>
                                <!-- Storage 变更 -->
                                <template v-if="ev.type === 'storage_change' && ev.data.type === 'storage_change'">
                                    <span class="tl-icon">{{ ev.data.storageType === 'local' ? '📦' : '📋' }}</span>
                                    <span class="tl-text">
                                        {{ ev.data.storageType === 'local' ? 'Local' : 'Session' }}Storage
                                        · {{ ev.data.action === 'set' ? '设置' : ev.data.action === 'remove' ? '移除' : '清空' }}
                                    </span>
                                    <div v-if="ev.data.key" class="tl-detail">
                                        <span class="tl-key">{{ ev.data.key }}</span>
                                        <span v-if="ev.data.newValue" class="tl-val">= {{ ev.data.newValue.slice(0, 60) }}{{ ev.data.newValue.length > 60 ? '...' : '' }}</span>
                                    </div>
                                </template>
                            </div>
                        </div>
                    </div>
                </div>
            </van-tab>

            <van-tab title="关键帧">
                <div class="panel-content">
                    <van-empty v-if="package.annotations.length === 0" description="暂无标注关键帧" :image-size="50" />
                    <div v-else class="keyframe-list">
                        <div v-for="(ann, i) in package.annotations" :key="i" class="kf-item">
                            <van-tag type="primary" size="medium">
                                {{ i + 1 }}
                            </van-tag>
                            <span class="kf-icon">
                                {{ ann.type === 'rect' ? '⬜' : ann.type === 'arrow' ? '➡' : ann.type === 'text' ? '📝' : '✏️' }}
                            </span>
                            <span class="kf-type">{{ ann.type }}</span>
                            <span class="kf-time">{{ formatDuration(ann.timestamp) }}</span>
                        </div>
                    </div>
                </div>
            </van-tab>
        </van-tabs>
    </div>

    <!-- 存储查看弹窗 -->
    <van-popup
        v-model:show="storagePopup.show"
        position="bottom"
        :style="{ height: '60%', background: '#272732' }"
        round
        closeable
    >
        <div class="flex-col h-full">
            <div class="popup-head">
                <span class="popup-title">{{ storagePopup.title }}</span>
                <button class="copy-all-btn" @click="copyAll">
                    全部复制
                </button>
            </div>
            <div class="popup-body">
                <div
                    v-for="(value, key) in storagePopup.data"
                    :key="key"
                    class="storage-row"
                >
                    <span class="s-key">{{ key }}</span>
                    <span class="s-val">{{ String(value) }}</span>
                    <button class="copy-btn" @click="copyEntry(key, String(value))">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                    </button>
                </div>
            </div>
        </div>
    </van-popup>
</template>

<style lang="scss" scoped>
.right-panel {
    height: 100%;
    flex-shrink: 0;
    background: #272732;
    border-left: 1px solid #3a3a4e;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

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

.keyframe-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.kf-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid transparent;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.15s;

    &:hover {
        background: #1e1e28;
        border-color: #3a3a4e;
    }

    .kf-icon { flex-shrink: 0; font-size: 14px; }
    .kf-type { color: #b0b0c4; flex: 1; }
    .kf-time { color: #6b6b80; font-size: 10px; font-variant-numeric: tabular-nums; }
}

/* 时间轴 */
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

.tl-item {
    position: relative;
    padding: 4px 0 10px;
    display: flex;
    gap: 8px;

    .tl-dot {
        position: absolute;
        left: -15px;
        top: 7px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #6b6b80;
        border: 2px solid #272732;

        &.url_change { background: #7ba4f5; }
        &.storage_change { background: #a6e3a1; }
    }

    .tl-content {
        flex: 1;
        min-width: 0;
    }

    .tl-time {
        font-size: 10px;
        color: #6b6b80;
        font-variant-numeric: tabular-nums;
        margin-right: 4px;
    }

    .tl-icon {
        margin: 0 3px;
    }

    .tl-text {
        font-size: 12px;
        color: #d0d0dc;
    }

    .tl-detail {
        margin-top: 3px;
        padding: 4px 6px;
        background: #1e1e28;
        border-radius: 4px;
        font-size: 10px;

        .tl-url {
            color: #6b6b80;
            word-break: break-all;
            &.to { color: #b0b0c4; }
        }

        .tl-arrow {
            color: #6b6b80;
            text-align: center;
            font-size: 10px;
        }

        .tl-key {
            color: #a8aac0;
            font-weight: 600;
        }

        .tl-val {
            color: #6b6b80;
            word-break: break-all;
        }
    }
}

/* Popup */
:deep(.van-popup) {
    display: flex;
    flex-direction: column;
}

.popup-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 40px 10px 16px;
    border-bottom: 1px solid #32323e;
    flex-shrink: 0;

    .popup-title {
        font-size: 15px;
        font-weight: 700;
        color: #d0d0dc;
    }

    .copy-all-btn {
        padding: 4px 12px;
        border: 1px solid #3a3a4e;
        border-radius: 4px;
        background: transparent;
        color: #6b6b80;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.15s;

        &:hover { border-color: #7ba4f5; color: #7ba4f5; }
    }
}

.popup-body {
    flex: 1;
    overflow-y: auto;
    padding: 4px 12px;

    .storage-row {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 6px 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        font-size: 12px;

        .s-key {
            color: #a8aac0;
            flex-shrink: 0;
            font-weight: 600;
            min-width: 100px;
            max-width: 160px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .s-val {
            color: #6b6b80;
            flex: 1;
            word-break: break-all;
            line-height: 1.5;
            white-space: pre-wrap;
            font-size: 11px;
        }

        .copy-btn {
            flex-shrink: 0;
            padding: 2px 4px;
            border: none;
            border-radius: 3px;
            background: transparent;
            color: #6b6b80;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.15s, color 0.15s;
            display: flex;
            align-items: center;

            &:hover { color: #7ba4f5; }
        }

        &:hover .copy-btn { opacity: 1; }
    }
}
</style>

<style lang="scss">
.copy-toast {
    background: #3a3a4e !important;
    color: #d0d0dc !important;
    border-radius: 8px !important;
    font-size: 13px !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
}
</style>
