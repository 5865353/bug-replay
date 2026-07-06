<script setup lang="ts">
import type { RecordingSessionSummary } from '@shared/types';
import { showConfirmDialog } from 'vant';
import { computed } from 'vue';

const props = defineProps<{
    session: RecordingSessionSummary;
    isActive: boolean;
}>();

const emit = defineEmits<{
    select: [sessionId: string];
    delete: [sessionId: string];
}>();

const relativeTime = computed(() => {
    const diff = Date.now() - props.session.startTime;
    const mins = Math.floor(diff / 60000);
    if (mins < 1)
        return '刚刚';
    if (mins < 60)
        return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24)
        return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
});

function handleClick() {
    emit('select', props.session.id);
}

function handleDelete() {
    showConfirmDialog({
        title: '删除录制',
        message: `确定要删除「${props.session.title}」吗？`,
        confirmButtonText: '删除',
        confirmButtonColor: '#ee4141',
    }).then(() => {
        emit('delete', props.session.id);
    }).catch(() => {});
}
</script>

<template>
    <div
        class="session-row" :class="[{ 'session-row-active': isActive }]"
        @click="handleClick"
    >
        <div class="session-icon" :class="[{ 'session-icon-active': isActive }]">
            <van-icon :name="isActive ? 'checked' : 'description'" size="16" />
        </div>
        <div class="session-info">
            <div :class="isActive ? 'session-title-active' : 'session-title'">
                {{ session.title }}
            </div>
            <div class="session-time">
                {{ relativeTime }}
            </div>
        </div>
        <div class="session-delete" @click.stop="handleDelete">
            <van-icon name="delete-o" size="16" color="#c8c9cc" />
        </div>
    </div>
</template>

<style scoped>
.session-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s ease;
  margin: 2px 0;
}

.session-row:active {
  background: #f7f8fa;
}

.session-row-active {
  background: #f5f3ff;
}

.session-icon {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: #f2f3f5;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #969799;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.session-icon-active {
  background: linear-gradient(135deg, #6467f0, #8b5cf6);
  color: #fff;
}

.session-info {
  flex: 1;
  min-width: 0;
}

.session-title {
  font-size: 14px;
  font-weight: 500;
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-title-active {
  font-size: 14px;
  font-weight: 600;
  color: #6467f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-time {
  font-size: 11px;
  color: #969799;
  margin-top: 2px;
}

.session-delete {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.session-delete:hover {
  background: #fef0f0;
}

.session-delete:hover :deep(.van-icon) {
  color: #ee4141 !important;
}
</style>
