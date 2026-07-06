<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    isRecording: boolean;
    isPaused: boolean;
}>();

const emit = defineEmits<{
    toggle: [];
}>();

const btnText = computed(() => {
    if (!props.isRecording)
        return '开始录制';
    if (props.isPaused)
        return '继续录制';
    return '录制中...';
});

const btnIcon = computed(() => {
    if (!props.isRecording)
        return 'video-o';
    if (props.isPaused)
        return 'play-circle-o';
    return 'pause-circle-o';
});
</script>

<template>
    <div class="recording-area">
        <!-- 录制按钮 -->
        <div class="record-btn-wrapper">
            <div v-if="isRecording && !isPaused" class="record-ripple" />
            <van-button
                round
                block
                size="large"
                class="record-btn" :class="[{ 'is-recording': isRecording && !isPaused, 'is-paused': isPaused }]"
                :disabled="isRecording && !isPaused"
                @click="emit('toggle')"
            >
                <template #icon>
                    <van-icon :name="btnIcon" size="20" />
                </template>
                {{ btnText }}
            </van-button>
        </div>

        <p class="recording-hint">
            点击开始后，页面将弹出工具条<br>支持暂停录制、绘制标注
        </p>
    </div>
</template>

<style scoped>
.recording-area {
  text-align: center;
}

.record-btn-wrapper {
  position: relative;
  display: inline-block;
  width: 100%;
}

/* 录制中脉冲光环 */
.record-ripple {
  position: absolute;
  inset: -6px;
  border-radius: 999px;
  background: transparent;
  border: 2px solid rgba(238, 65, 65, 0.25);
  animation: ripple 1.8s ease-out infinite;
  pointer-events: none;
}

@keyframes ripple {
  0% { inset: -4px; opacity: 0.8; }
  100% { inset: -14px; opacity: 0; }
}

.record-btn {
  position: relative;
  z-index: 1;
  border: none !important;
  font-weight: 600 !important;
  font-size: 16px !important;
  letter-spacing: 0.5px;
  transition: all 0.3s ease;
  height: 48px !important;
  box-shadow: 0 4px 14px rgba(238, 65, 65, 0.35);
  background: linear-gradient(135deg, #ee4141, #ff6b6b) !important;
  color: #fff !important;
}

.record-btn:active {
  transform: scale(0.98);
  box-shadow: 0 2px 8px rgba(238, 65, 65, 0.3);
}

.record-btn.is-recording {
  background: linear-gradient(135deg, #e5e7eb, #d1d5db) !important;
  color: #9ca3af !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  cursor: not-allowed;
}

.record-btn.is-paused {
  background: linear-gradient(135deg, #10b981, #34d399) !important;
  color: #fff !important;
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
}

.recording-hint {
  text-align: center;
  font-size: 12px;
  color: #969799;
  margin-top: 12px;
  line-height: 1.6;
}
</style>
