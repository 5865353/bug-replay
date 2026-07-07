<script setup lang="ts">
import { REPLAY_SPEEDS } from '@shared/types';
import { formatTime } from '@shared/utils';
import { computed } from 'vue';

const props = defineProps<{
    currentTime: number;
    totalTime: number;
    isPlaying: boolean;
    speed: number;
}>();

const emit = defineEmits<{
    playPause: [];
    seek: [time: number];
    speedChange: [speed: number];
    stepForward: [];
    stepBack: [];
}>();

const sliderValue = computed({
    get: () => props.currentTime,
    set: (val: number) => emit('seek', val),
});
</script>

<template>
    <div class="timeline-bar">
        <div class="timeline-row">
            <van-button size="small" icon="arrow-left" @click="emit('stepBack')" />
            <van-button size="small" :icon="isPlaying ? 'pause' : 'play'" type="primary" round @click="emit('playPause')" />
            <van-button size="small" icon="arrow" @click="emit('stepForward')" />

            <span class="time-display">{{ formatTime(currentTime) }}</span>
            <span class="time-sep">/</span>
            <span class="time-display">{{ formatTime(totalTime) }}</span>

            <div class="speed-select">
                <van-button
                    v-for="s in REPLAY_SPEEDS"
                    :key="s"
                    :type="speed === s ? 'primary' : 'default'"
                    @click="emit('speedChange', s)"
                >
                    {{ s }}x
                </van-button>
            </div>
        </div>

        <div>
            <van-slider
                v-model="sliderValue"
                :min="0"
                :max="totalTime"
                :step="100"
                bar-height="4px"
                active-color="#cba6f7"
                inactive-color="#2a2a38"
            />
        </div>
    </div>
</template>

<style scoped>
.timeline-bar {
  padding: 6px 10px 8px;
  background: #18181f;
  border-top: 1px solid #2a2a38;
  flex-shrink: 0;
}

.timeline-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
}

.time-display {
  font-size: 14px;
  color: #9399b2;
  font-variant-numeric: tabular-nums;
  min-width: 40px;
  text-align: center;
}

.time-sep {
  font-size: 14px;
  color: #585b70;
}

.speed-select {
  margin-left: auto;
  display: flex;
  gap: 3px;
}

/* van-slider 按钮缩小 */
.timeline-bar :deep(.van-slider__button) {
  width: 12px;
  height: 12px;
}
</style>
