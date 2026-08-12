<script setup lang="ts">
import browser from 'webextension-polyfill';

defineProps<{ title: string; description: string; tags: string; hasAi: boolean; generatingAi: boolean }>();
defineEmits<{ 'update:title': [value: string]; 'update:description': [value: string]; 'update:tags': [value: string]; 'generateAi': [] }>();

function openSettings() {
    browser.runtime.openOptionsPage();
}
</script>

<template>
    <!-- 标题 -->
    <section class="card">
        <h3 class="section-title">
            Bug 标题
        </h3>
        <input :value="title" class="inp" placeholder="简要描述 Bug 现象" @input="$emit('update:title', ($event.target as HTMLInputElement).value)">
    </section>

    <!-- 描述 + AI -->
    <section class="card">
        <div class="desc-header">
            <h3 class="section-title section-title--tight">
                详细描述
            </h3>
            <button v-if="hasAi" class="ai-btn" :disabled="generatingAi" @click="$emit('generateAi')">
                {{ generatingAi ? '⚡ 生成中...' : '🤖 AI 生成' }}
            </button>
        </div>
        <textarea :value="description" class="inp ta" rows="8" placeholder="复现步骤、预期结果、实际结果..." @input="$emit('update:description', ($event.target as HTMLTextAreaElement).value)" />
        <p v-if="!hasAi" class="hint">
            💡 在<a href="#" @click.prevent="openSettings">设置</a>中配置 AI 后可自动生成描述
        </p>
    </section>

    <!-- 标签 -->
    <section class="card">
        <h3 class="section-title">
            🏷 标签
        </h3>
        <input :value="tags" class="inp" placeholder="用逗号分隔，如：UI, 登录, P0" @input="$emit('update:tags', ($event.target as HTMLInputElement).value)">
    </section>
</template>

<style lang="scss" scoped>
.desc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
}

.ta {
    resize: vertical;
    min-height: 120px;
}

.ai-btn {
    padding: 5px 12px;
    border: 1px solid rgba(91, 141, 239, 0.35);
    border-radius: 6px;
    background: transparent;
    color: #7ba4f5;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s;

    &:hover {
        background: rgba(91, 141, 239, 0.08);
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
}
</style>
