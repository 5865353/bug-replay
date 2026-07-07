<script setup lang="ts">
import type { RRTPackage } from '@shared/types';
import { ref } from 'vue';
import ConsolePanel from './ConsolePanel.vue';
import NetworkPanel from './NetworkPanel.vue';

defineProps<{
    visible: boolean;
    currentPackage: RRTPackage | null;
    currentTime: number;
}>();

const activeTab = ref(0);
const panelHeight = ref(220);
let dragStartY = 0;
let dragStartH = 0;

function onResizeStart(e: MouseEvent) {
    dragStartY = e.clientY;
    dragStartH = panelHeight.value;
    const onMove = (ev: MouseEvent) => {
        panelHeight.value = Math.max(80, Math.min(500, dragStartH + (dragStartY - ev.clientY)));
    };
    const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}
</script>

<template>
    <div
        v-if="visible"
        class="bottom-panel"
        :style="{ height: `${panelHeight}px` }"
    >
        <div class="resize-handle" @mousedown="onResizeStart">
            <div class="resize-bar" />
        </div>

        <van-tabs
            v-model:active="activeTab"
            type="card"
            color="#cba6f7"
            title-active-color="#cdd6f4"
            title-inactive-color="#585b70"
            background="#0f0f14"
            :border="false"
        >
            <van-tab title="控制台">
                <ConsolePanel
                    :logs="currentPackage?.consoleLogs || []"
                    :current-time="currentTime"
                />
            </van-tab>

            <van-tab title="网络">
                <NetworkPanel
                    :logs="currentPackage?.networkLogs || []"
                    :current-time="currentTime"
                />
            </van-tab>
        </van-tabs>
    </div>
</template>

<style lang="scss" scoped>
.bottom-panel {
  flex-shrink: 0;
  background: #18181f;
  border-top: 1px solid #2a2a38;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;

  // 折叠状态
  &.bottom-collapsed {
    overflow: hidden;
  }

  // 拖拽手柄
  .resize-handle {
    position: absolute;
    top: -2px;
    left: 0;
    right: 0;
    height: 8px;
    cursor: ns-resize;
    z-index: 10;
    display: flex;
    justify-content: center;
    align-items: center;

    .resize-bar {
      width: 40px;
      height: 3px;
      background: #2a2a38;
      border-radius: 2px;
      transition: background 0.15s;
    }

    &:hover .resize-bar {
      background: #cba6f7;
    }
  }

  // van-tabs 填满
  :deep(.van-tabs) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;

    .van-tabs__content {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .van-tab__panel {
      height: 100%;
    }
  }
}
</style>
