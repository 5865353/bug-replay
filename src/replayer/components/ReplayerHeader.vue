<script setup lang="ts">
import browser from 'webextension-polyfill';

defineProps<{
    title: string;
}>();
</script>

<template>
    <van-nav-bar placeholder z-index="100">
        <template #left>
            <div class="header-brand">
                <img src="/icons/icon-16.png" alt="" class="brand-logo">
                <span class="brand-text">Bug<span class="brand-highlight">Replay</span></span>
            </div>
        </template>
        <template #title>
            <span class="header-info-title">{{ title || '回放' }}</span>
        </template>
        <template #right>
            <van-icon
                name="setting-o" size="20" color="#b0b0c4" class="header-settings-btn"
                @click="browser.runtime.openOptionsPage()"
            />
        </template>
    </van-nav-bar>
</template>

<style lang="scss" scoped>
.header-brand {
    display: flex;
    align-items: center;
    gap: 8px;
}

.brand-logo {
    width: 20px;
    height: 20px;
    border-radius: 4px;
}

.brand-text {
    font-weight: 800;
    letter-spacing: -0.5px;
    font-size: 16px;
    color: #d0d0dc;
}

.brand-highlight {
    color: #7ba4f5;
}

.header-info-title {
    color: #b0b0c4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 600px;
    display: inline-block;
}

.header-settings-btn {
    cursor: pointer;
}
</style>
