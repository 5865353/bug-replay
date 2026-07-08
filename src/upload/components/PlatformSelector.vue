<script setup lang="ts">
import type { UploadSettings } from '../constants';
import browser from 'webextension-polyfill';

defineProps<{ settings: UploadSettings; platform: string }>();
defineEmits<{ 'update:platform': [value: string] }>();

function openSettings() { browser.runtime.openOptionsPage(); }
</script>

<template>
    <section class="card">
        <h3 class="section-title">目标平台</h3>
        <div class="plat-row">
            <button v-if="settings.jiraEnabled" class="plat-btn" :class="{ active: platform === 'jira' }" @click="$emit('update:platform', 'jira')">Jira</button>
            <button v-if="settings.zentaoEnabled" class="plat-btn" :class="{ active: platform === 'zentao' }" @click="$emit('update:platform', 'zentao')">禅道</button>
        </div>
        <p v-if="!settings.jiraEnabled && !settings.zentaoEnabled" class="hint">
            ⚠ 未配置 Bug 平台，请先在<a href="#" @click.prevent="openSettings">设置</a>中启用
        </p>
    </section>
</template>

<style lang="scss" scoped>
.card {
    background: #272732;
    border: 1px solid #32323e;
    border-radius: 10px;
    padding: 16px;
}

.section-title {
    font-size: 14px;
    font-weight: 600;
    color: #b0b0c4;
    margin: 0 0 10px;
}

.plat-row {
    display: flex;
    gap: 8px;
}

.plat-btn {
    padding: 8px 22px;
    border: 1px solid #3a3a4e;
    border-radius: 8px;
    background: transparent;
    color: #6b6b80;
    font-size: 14px;
    cursor: pointer;
    transition: .15s;

    &.active {
        border-color: #5b8def;
        background: rgba(91, 141, 239, .1);
        color: #7ba4f5;
    }
}

.hint {
    font-size: 12px;
    color: #6b6b80;
    margin-top: 8px;

    a { color: #7ba4f5; }
}
</style>
