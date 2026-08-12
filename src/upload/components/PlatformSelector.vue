<script setup lang="ts">
import type { UploadSettings } from '../constants';
import browser from 'webextension-polyfill';

defineProps<{ settings: UploadSettings; platform: string }>();
defineEmits<{ 'update:platform': [value: string] }>();

function openSettings() {
    browser.runtime.openOptionsPage();
}
</script>

<template>
    <section class="card">
        <h3 class="section-title">
            目标平台
        </h3>
        <div class="plat-row">
            <button v-if="settings.jiraEnabled" class="plat-btn" :class="{ active: platform === 'jira' }" @click="$emit('update:platform', 'jira')">
                Jira
            </button>
            <button v-if="settings.zentaoEnabled" class="plat-btn" :class="{ active: platform === 'zentao' }" @click="$emit('update:platform', 'zentao')">
                禅道
            </button>
        </div>
        <p v-if="!settings.jiraEnabled && !settings.zentaoEnabled" class="hint">
            ⚠ 未配置 Bug 平台，请先在<a href="#" @click.prevent="openSettings">设置</a>中启用
        </p>
    </section>
</template>

<style lang="scss" scoped>
.plat-row {
    display: flex;
    gap: 8px;
}

.plat-btn {
    flex: 1;
    padding: 10px;
    border: 1px solid #2e2e3c;
    border-radius: 8px;
    background: #17171f;
    color: #8f8fa5;
    font-size: 14px;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background 0.15s;

    &:hover {
        color: #e4e4ee;
        border-color: #3a3a4c;
    }

    &.active {
        border-color: #5b8def;
        background: rgba(91, 141, 239, 0.08);
        color: #7ba4f5;
    }
}
</style>
