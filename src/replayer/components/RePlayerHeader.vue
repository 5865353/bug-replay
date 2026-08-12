<script setup lang="ts">
import browser from 'webextension-polyfill';

defineProps<{
    title: string;
    /** 当前回放的会话 ID，为空表示本地文件回放（不可上传） */
    sessionId: string;
}>();

const emit = defineEmits<{
    upload: [];
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
            <div class="header-actions">
                <button
                    class="header-upload-btn"
                    :class="{ 'header-upload-btn--disabled': !sessionId }"
                    :title="sessionId ? '上传到 Bug 平台' : '本地文件回放无法上传'"
                    @click="emit('upload')"
                >
                    <van-icon name="upgrade" size="16" color="#7ba4f5" />
                    <span>上传</span>
                </button>
                <van-icon
                    name="setting-o" size="20" color="#b0b0c4" class="header-settings-btn"
                    @click="browser.runtime.openOptionsPage()"
                />
            </div>
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

.header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
}

.header-upload-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 12px;
    border: 1px solid #3a3a4e;
    border-radius: 6px;
    background: transparent;
    color: #7ba4f5;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
}

.header-upload-btn:hover {
    border-color: #5b8def;
    background: rgba(91, 141, 239, 0.12);
}

.header-upload-btn--disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.header-upload-btn--disabled:hover {
    border-color: #3a3a4e;
    background: transparent;
}

.header-settings-btn {
    cursor: pointer;
}
</style>
