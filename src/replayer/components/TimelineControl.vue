<script setup lang="ts">
import { REPLAY_SPEEDS } from '@shared/types';
import { formatTime } from '@shared/utils';
import { computed, ref } from 'vue';

const props = defineProps<{
    currentTime: number;
    totalTime: number;
    isPlaying: boolean;
    speed: number;
    showAnnotations: boolean;
    devtoolsVisible: boolean;
}>();

const emit = defineEmits<{
    playPause: [];
    seek: [time: number];
    speedChange: [speed: number];
    stepForward: [];
    stepBack: [];
    toggleAnnotations: [];
    toggleDevtools: [];
    replay: [];
    fileSelected: [event: Event];
}>();

// ---- 自定义进度条拖拽 ----
const progressBar = ref<HTMLDivElement>();
const isDragging = ref(false);
const hoverPercent = ref(0);
const showHover = ref(false);

const progressPercent = computed(() =>
    props.totalTime > 0 ? (props.currentTime / props.totalTime) * 100 : 0,
);

function seekFromEvent(e: MouseEvent) {
    if (!progressBar.value || props.totalTime <= 0)
        return;
    const rect = progressBar.value.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    emit('seek', pct * props.totalTime);
}

function onProgressMouseDown(e: MouseEvent) {
    isDragging.value = true;
    seekFromEvent(e);
    document.addEventListener('mousemove', onProgressMouseMove);
    document.addEventListener('mouseup', onProgressMouseUp);
}

function onProgressMouseMove(e: MouseEvent) {
    if (!isDragging.value)
        return;
    seekFromEvent(e);
}

function onProgressMouseUp(e: MouseEvent) {
    if (!isDragging.value)
        return;
    isDragging.value = false;
    seekFromEvent(e);
    document.removeEventListener('mousemove', onProgressMouseMove);
    document.removeEventListener('mouseup', onProgressMouseUp);
}

function onProgressHover(e: MouseEvent) {
    if (!progressBar.value || isDragging.value)
        return;
    const rect = progressBar.value.getBoundingClientRect();
    hoverPercent.value = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    showHover.value = true;
}

// ---- 文件选择 ----
const fileInput = ref<HTMLInputElement>();

function openFile() {
    fileInput.value?.click();
}
</script>

<template>
    <div class="player-bar">
        <!-- ======== 自定义进度条 ======== -->
        <div
            ref="progressBar"
            class="progress-track"
            @mousedown="onProgressMouseDown"
            @mousemove="onProgressHover"
            @mouseleave="showHover = false"
        >
            <div class="progress-filled" :style="{ width: `${progressPercent}%` }" />
            <div
                v-if="showHover"
                class="progress-hover"
                :style="{ left: `${hoverPercent}%` }"
            />
            <div
                class="progress-thumb"
                :class="{ dragging: isDragging }"
                :style="{ left: `${progressPercent}%` }"
            />
        </div>

        <!-- ======== 控制按钮行 ======== -->
        <div class="controls-row">
            <!-- 左: 播放控制 -->
            <div class="controls-left">
                <button class="ctrl-btn" title="后退 1s" @click="emit('stepBack')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" /></svg>
                </button>

                <button class="play-btn" :title="isPlaying ? '暂停' : '播放'" @click="emit('playPause')">
                    <svg v-if="isPlaying" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                    <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20" /></svg>
                </button>

                <button class="ctrl-btn" title="前进 1s" @click="emit('stepForward')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 17 18 12 13 7" /><polyline points="6 17 11 12 6 7" /></svg>
                </button>

                <span class="time-text">{{ formatTime(currentTime) }}</span>
                <span class="time-divider">/</span>
                <span class="time-text dim">{{ formatTime(totalTime) }}</span>
            </div>

            <!-- 中: 速度 -->
            <div class="controls-center">
                <button
                    v-for="s in REPLAY_SPEEDS"
                    :key="s"
                    class="speed-btn"
                    :class="{ active: speed === s }"
                    @click="emit('speedChange', s)"
                >
                    {{ s }}×
                </button>
            </div>

            <!-- 右: 功能按钮 -->
            <div class="controls-right">
                <button class="action-btn" title="打开文件" @click="openFile">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                    <span>打开</span>
                </button>
                <input
                    ref="fileInput"
                    type="file"
                    accept=".rrt,.json"
                    class="hidden"
                    @change="emit('fileSelected', $event)"
                >

                <button class="action-btn" title="标注开关" @click="emit('toggleAnnotations')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                </button>

                <button class="action-btn" title="重播" @click="emit('replay')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
                </button>

                <button class="action-btn" title="切换面板" @click="emit('toggleDevtools')">
                    <svg v-if="devtoolsVisible" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9" /></svg>
                    <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15" /></svg>
                    <span>{{ devtoolsVisible ? '收起' : '展开' }}</span>
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.player-bar {
    background: #14141c;
    border-top: 1px solid #252530;
    flex-shrink: 0;
    user-select: none;
}

/* ======== 进度条 ======== */
.progress-track {
    position: relative;
    height: 18px;
    margin: 0 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
}

.progress-track::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    height: 5px;
    background: #2a2a38;
    border-radius: 3px;
    transition: height 0.15s;
}

.progress-track:hover::before {
    height: 7px;
}

.progress-filled {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    height: 5px;
    background: linear-gradient(90deg, #cba6f7, #a78bfa);
    border-radius: 3px;
    transition: height 0.15s;
    pointer-events: none;
    z-index: 1;
}

.progress-track:hover .progress-filled {
    height: 7px;
}

.progress-hover {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 10px;
    height: 10px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    pointer-events: none;
    z-index: 2;
}

.progress-thumb {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 13px;
    height: 13px;
    background: #cba6f7;
    border-radius: 50%;
    box-shadow: 0 0 6px rgba(203, 166, 247, 0.5);
    pointer-events: none;
    z-index: 3;
    opacity: 0;
    transition: opacity 0.15s, width 0.15s, height 0.15s;
}

.progress-track:hover .progress-thumb,
.progress-thumb.dragging {
    opacity: 1;
    width: 15px;
    height: 15px;
}

/* ======== 控制按钮行 ======== */
.controls-row {
    display: flex;
    align-items: center;
    padding: 4px 14px 8px;
    gap: 12px;
}

.controls-left {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
}

.controls-center {
    flex: 1;
    display: flex;
    justify-content: center;
    gap: 3px;
}

.controls-right {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
}

/* 播放按钮 */
.play-btn {
    width: 38px;
    height: 38px;
    border: none;
    border-radius: 50%;
    background: #cba6f7;
    color: #0f0f14;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, transform 0.1s;
    margin: 0 4px;
}

.play-btn:hover {
    background: #d4b8ff;
    transform: scale(1.06);
}

.play-btn:active {
    transform: scale(0.96);
}

/* 小按钮 */
.ctrl-btn {
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #9399b2;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s;
}

.ctrl-btn:hover {
    background: #252530;
    color: #cdd6f4;
}

/* 时间文本 */
.time-text {
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: #cdd6f4;
    margin: 0 2px;
}

.time-text.dim {
    color: #585b70;
}

.time-divider {
    font-size: 13px;
    color: #454550;
    margin: 0 1px;
}

/* 速度按钮 */
.speed-btn {
    padding: 3px 10px;
    border: 1px solid #2a2a38;
    border-radius: 5px;
    background: transparent;
    color: #585b70;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
}

.speed-btn:hover {
    border-color: #454560;
    color: #9399b2;
}

.speed-btn.active {
    border-color: #cba6f7;
    background: rgba(203, 166, 247, 0.12);
    color: #cba6f7;
}

/* 功能按钮 */
.action-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #9399b2;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
}

.action-btn:hover {
    background: #252530;
    color: #cdd6f4;
}

.hidden {
    display: none;
}
</style>
