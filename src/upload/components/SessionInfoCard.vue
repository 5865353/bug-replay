<script setup lang="ts">
import type { RecordingSession } from '@shared/types';
import { computed } from 'vue';

const props = defineProps<{ sessionInfo: RecordingSession }>();

const duration = computed(() => {
    const ms = props.sessionInfo.endTime
        ? props.sessionInfo.endTime - props.sessionInfo.startTime
        : Date.now() - props.sessionInfo.startTime;
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
});

const recordDate = computed(() => {
    const d = new Date(props.sessionInfo.startTime);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
});

const pageUrl = computed(() => {
    try {
        const u = props.sessionInfo.environment?.url;
        return u ? new URL(u).hostname : '';
    } catch { return ''; }
});
</script>

<template>
    <section class="card">
        <div class="card-header">
            <span class="card-icon">📋</span>
            <span class="card-title">{{ sessionInfo.title }}</span>
        </div>
        <div class="card-meta">
            <span v-if="pageUrl" class="meta-item">🌐 {{ pageUrl }}</span>
            <span class="meta-item">⏱ {{ duration }}</span>
            <span class="meta-item">📅 {{ recordDate }}</span>
        </div>
        <div class="card-stats">
            <div class="stat-item"><span class="stat-label">网络</span><br><span class="stat-value">{{ sessionInfo.networkLogs?.length || 0 }}</span></div>
            <div class="stat-item"><span class="stat-label">控制台</span><br><span class="stat-value">{{ sessionInfo.consoleLogs?.length || 0 }}</span></div>
            <div class="stat-item"><span class="stat-label">标注</span><br><span class="stat-value">{{ sessionInfo.annotations?.length || 0 }}</span></div>
        </div>
    </section>
</template>

<style lang="scss" scoped>
.card {
    background: #272732;
    border: 1px solid #32323e;
    border-radius: 10px;
    padding: 16px;
}

.card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
}

.card-icon {
    font-size: 14px;
    font-weight: 600;
    color: #7ba4f5;
}

.card-title {
    font-size: 14px;
    font-weight: 600;
    color: #b0b0c4;
}

.card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 12px;
    font-size: 12px;
}

.meta-item { color: #606070; }

.card-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    font-size: 12px;
}

.stat-label { color: #6b6b80; }
.stat-value { color: #d0d0dc; }
</style>
