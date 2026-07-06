<script setup lang="ts">
import type { RecordingSessionSummary } from '@shared/types';
import SessionItem from './SessionItem.vue';

defineProps<{
    sessions: RecordingSessionSummary[];
    activeSessionId: string | null;
}>();

const emit = defineEmits<{
    select: [sessionId: string];
    delete: [sessionId: string];
}>();
</script>

<template>
    <div class="sessions-section">
        <div class="sessions-header">
            <div class="sessions-header-left">
                <van-icon name="orders-o" size="15" color="#323233" />
                <span>历史录制</span>
            </div>
            <span v-if="sessions.length" class="sessions-count">{{ sessions.length }}</span>
        </div>

        <div class="session-list">
            <van-empty v-if="sessions.length === 0" description="暂无录制记录" :image-size="60" />

            <van-cell-group v-else inset :border="false">
                <SessionItem
                    v-for="session in sessions"
                    :key="session.id"
                    :session="session"
                    :is-active="session.id === activeSessionId"
                    @select="emit('select', $event)"
                    @delete="emit('delete', $event)"
                />
            </van-cell-group>
        </div>
    </div>
</template>

<style scoped>
.sessions-section {
  margin-top: 2px;
}

.sessions-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 6px 8px;
}

.sessions-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: #323233;
}

.sessions-count {
  font-size: 11px;
  font-weight: 600;
  color: #969799;
  background: #f2f3f5;
  padding: 2px 8px;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
}

.session-list{
    height: 200px;
    overflow-y: auto;
}
</style>
