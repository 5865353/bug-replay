<script setup lang="ts">
import type { Annotation } from '@shared/types';

defineProps<{
    annotations: Annotation[];
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
        <van-empty v-if="annotations.length === 0" description="暂无标注关键帧" :image-size="50" />
        <div v-else class="keyframe-list">
            <div v-for="(ann, i) in annotations" :key="i" class="kf-item">
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
</template>

<style lang="scss" scoped>
.panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
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
    transition: all .15s;

    &:hover {
        background: #1e1e28;
        border-color: #3a3a4e;
    }

    .kf-icon { flex-shrink: 0; font-size: 14px; }
    .kf-type { color: #b0b0c4; flex: 1; }
    .kf-time { color: #6b6b80; font-size: 10px; font-variant-numeric: tabular-nums; }
}
</style>
