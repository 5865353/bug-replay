<script setup lang="ts">
import type { RRTPackage } from '@shared/types';
import { ref } from 'vue';

defineProps<{
    hasLoaded: boolean;
    currentPackage: RRTPackage | null;
}>();

const emit = defineEmits<{
    dropFile: [file: File];
    fileSelected: [event: Event];
}>();

const playerContainer = ref<HTMLDivElement>();
const fileInput = ref<HTMLInputElement>();
const isDragOver = ref(false);

defineExpose({ playerContainer });

function onDragOver(e: DragEvent) {
    e.preventDefault();
    isDragOver.value = true;
}
function onDragLeave() {
    isDragOver.value = false;
}
function onDrop(e: DragEvent) {
    e.preventDefault();
    isDragOver.value = false;
    const file = e.dataTransfer?.files?.[0];
    if (file)
        emit('dropFile', file);
}
function onClickDropZone() {
    fileInput.value?.click();
}
</script>

<template>
    <div class="stage-wrapper">
        <!-- Drop zone -->
        <div
            v-if="!hasLoaded"
            class="drop-zone"
            :class="{ 'drop-zone-active': isDragOver }"
            @click="onClickDropZone"
            @dragover="onDragOver"
            @dragleave="onDragLeave"
            @drop="onDrop"
        >
            <div class="drop-zone-icon">
                <van-icon name="cloud-upload-o" size="48" color="#6b6b80" />
            </div>
            <div class="drop-zone-title">
                点击或拖放 .rrt 文件
            </div>
            <div class="drop-zone-hint">
                支持 .rrt / .json 格式的录制回放文件
            </div>
            <van-button round type="primary" size="small" class="mt-3">
                选择文件
            </van-button>
            <input
                ref="fileInput"
                type="file"
                accept=".rrt,.json"
                class="hidden"
                @change="emit('fileSelected', $event)"
            >
        </div>

        <!-- rrweb player -->
        <div
            id="rrweb-player"
            ref="playerContainer"
            class="player-container"
            :class="{ visible: hasLoaded }"
        />
    </div>
</template>

<style lang="scss" scoped>
.stage-wrapper {
    flex: 1;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(ellipse at center, #1a1a2e 0%, #1c1c24 70%);
}

.drop-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 40px;
    border: 2px dashed #3a3a4e;
    border-radius: 14px;
    cursor: pointer;
    transition: all .2s ease;
    background: rgba(15, 15, 20, .8);

    &:hover,
    &-active {
        border-color: #7ba4f5;
        background: rgba(203, 166, 247, .04);
    }
}

.drop-zone-icon { opacity: .6; }

.drop-zone-title {
    font-size: 15px;
    font-weight: 600;
    color: #d0d0dc;
}

.drop-zone-hint {
    font-size: 12px;
    color: #6b6b80;
}

.player-container {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    border-radius: 8px;
    box-shadow: 0 0 60px rgba(0, 0, 0, .6), 0 0 0 1px rgba(255, 255, 255, .06);
    display: none;

    &.visible { display: block; }
}

.hidden { display: none; }
</style>
