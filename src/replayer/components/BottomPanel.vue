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
</script>

<template>
    <div v-if="visible" class="bottom-panel">

        <van-tabs
            v-model:active="activeTab"
            type="card"
            color="#7ba4f5"
            title-active-color="#d0d0dc"
            title-inactive-color="#6b6b80"
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
  height: 100%;
  background: #272732;
  border-top: 1px solid #3a3a4e;
  display: flex;
  flex-direction: column;
  overflow: hidden;

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
