<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    isRecording: boolean;
    isPaused: boolean;
}>();

const text = computed(() => {
    if (props.isRecording && props.isPaused)
        return '已暂停';
    if (props.isRecording)
        return '● 录制中';
    return '就绪';
});

const tagColor = computed(() => {
    if (props.isRecording && props.isPaused)
        return '#f59e0b';
    if (props.isRecording)
        return '#ee4141';
    return '#969799';
});
</script>

<template>
    <div class="status-badge" :style="{ 'color': tagColor, '--dot-color': tagColor }">
        <span v-if="isRecording && !isPaused" class="status-dot" />
        <span class="status-text">{{ text }}</span>
    </div>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
  background: #f5f5f5;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--dot-color);
  animation: pulse-dot 1.2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(1.3); }
}

.status-text {
  letter-spacing: 0.3px;
}
</style>
