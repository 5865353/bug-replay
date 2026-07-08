<script setup lang="ts">
import type { PageEvent } from '@shared/types';

defineProps<{
    pageEvents: PageEvent[];
}>();

function formatDuration(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
}
</script>

<template>
    <div class="panel-content">
        <van-empty v-if="!pageEvents?.length" description="鏆傛棤椤甸潰浜嬩欢" :image-size="40" />
        <div v-else class="timeline-list">
            <div v-for="(ev, i) in pageEvents" :key="i" class="tl-item">
                <div class="tl-dot" :class="ev.type" />
                <div class="tl-content">
                    <span class="tl-time">{{ formatDuration(ev.timestamp) }}</span>
                    <!-- URL 鍙樻洿 -->
                    <template v-if="ev.type === 'url_change'">
                        <span class="tl-icon">馃敆</span>
                        <span class="tl-text">URL 鍙樻洿</span>
                        <div class="tl-detail">
                            <div class="tl-url">
                                {{ ev.data.from }}
                            </div>
                            <div class="tl-arrow">
                                鈫?
                            </div>
                            <div class="tl-url to">
                                {{ ev.data.to }}
                            </div>
                        </div>
                    </template>
                    <!-- Storage 鍙樻洿 -->
                    <template v-else-if="ev.type === 'storage_change'">
                        <span class="tl-icon">{{ ev.data.storageType === 'local' ? '馃摝' : '馃搵' }}</span>
                        <span class="tl-text">
                            {{ ev.data.storageType === 'local' ? 'Local' : 'Session' }}Storage
                            路 {{ ev.data.action === 'set' ? '璁剧疆' : ev.data.action === 'remove' ? '绉婚櫎' : '娓呯┖' }}
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
</template>

<style lang="scss" scoped>
.panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
}

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
</style>
