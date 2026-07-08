<script setup lang="ts">
import type { RRTPackage } from '@shared/types';
import { ref } from 'vue';
import KeyframesTab from './KeyframesTab.vue';
import RecordingInfoTab from './RecordingInfoTab.vue';
import StoragePopup from './StoragePopup.vue';
import TimelineTab from './TimelineTab.vue';

defineProps<{
    package: RRTPackage;
}>();

const activeTab = ref(0);

// ---- 存储弹窗 ----
interface StorageEntry { key: string; value: string }
const storagePopup = ref({ show: false, title: '', entries: [] as StorageEntry[], isCookies: false });

function showStorage(title: string, data: Record<string, string> | undefined) {
    const entries: StorageEntry[] = [];
    if (data) {
        for (const [key, value] of Object.entries(data)) {
            entries.push({ key, value });
        }
    }
    storagePopup.value = { show: true, title, entries, isCookies: false };
}

function showCookies() {
    storagePopup.value = { show: true, title: 'Cookies', entries: [], isCookies: true };
}
</script>

<template>
    <div class="right-panel">
        <van-tabs
            v-model:active="activeTab" type="card" color="#7ba4f5" title-active-color="#d0d0dc"
            title-inactive-color="#6b6b80" background="#272732"
        >
            <van-tab title="录制信息">
                <RecordingInfoTab :package="package" @show-cookies="showCookies" @show-storage="showStorage" />
            </van-tab>

            <van-tab title="时间轴">
                <TimelineTab :page-events="package.pageEvents || []" />
            </van-tab>

            <van-tab title="关键帧">
                <KeyframesTab :annotations="package.annotations" />
            </van-tab>
        </van-tabs>
    </div>

    <!-- 存储查看弹窗 -->
    <StoragePopup
        :show="storagePopup.show" :title="storagePopup.title" :entries="storagePopup.entries"
        :is-cookies="storagePopup.isCookies" :cookies="package.environment?.cookies || []"
        @update:show="storagePopup.show = $event"
    />
</template>

<style lang="scss" scoped>
.right-panel {
    height: 100%;
    flex-shrink: 0;
    background: #272732;
    border-left: 1px solid #3a3a4e;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    :deep(.van-tabs) {
        display: flex;
        flex-direction: column;
        height: 100%;

        .van-tabs__content {
            flex: 1;
            height: 0;

            .van-tab__panel {
                height: 100%;
            }
        }
    }
}
</style>
