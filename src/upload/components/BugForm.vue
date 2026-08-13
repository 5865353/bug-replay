<script setup lang="ts">
import { ref, watch } from 'vue';
import browser from 'webextension-polyfill';

const props = defineProps<{ title: string; description: string; tags: string; hasAi: boolean; generatingAi: boolean }>();
const emit = defineEmits<{ 'update:title': [value: string]; 'update:description': [value: string]; 'update:tags': [value: string]; 'generateAi': [prompt: string] }>();

// AI 生成：内联展开面板（不再使用弹窗）
const aiOpen = ref(false);
const aiPrompt = ref('');

// AI 生成完成（无论成败）后自动收起内联面板，结果会填充到下方描述框
watch(() => props.generatingAi, val => {
    if (!val) {
        aiOpen.value = false;
    }
});

function toggleAi() {
    if (props.generatingAi)
        return;

    if (aiOpen.value) {
        aiOpen.value = false;
        return;
    }

    aiPrompt.value = props.description;
    aiOpen.value = true;
}

function confirmAi() {
    emit('generateAi', aiPrompt.value.trim());
}

function openSettings() {
    browser.runtime.openOptionsPage();
}
</script>

<template>
    <div class="panel-group">
        <div class="field">
            <label class="field-label">Bug 标题</label>
            <input :value="title" class="inp" placeholder="简要描述 Bug 现象" @input="$emit('update:title', ($event.target as HTMLInputElement).value)">
        </div>

        <div class="field">
            <div class="field-head">
                <label class="field-label">详细描述</label>
                <button v-if="hasAi" class="ai-btn" :disabled="generatingAi" @click="toggleAi">
                    {{ generatingAi ? '⚡ 生成中...' : aiOpen ? '收起' : '🤖 AI 生成' }}
                </button>
            </div>
            <textarea :value="description" class="inp ta" rows="6" placeholder="复现步骤、预期结果、实际结果..." @input="$emit('update:description', ($event.target as HTMLTextAreaElement).value)" />
            <p v-if="!hasAi" class="hint">
                💡 在<a href="#" @click.prevent="openSettings">设置</a>中配置 AI 后可自动生成描述
            </p>

            <!-- 内联 AI 生成面板 -->
            <transition name="ai-fade">
                <div v-if="aiOpen" class="ai-panel">
                    <div class="ai-head">
                        <span class="ai-title">✨ AI 生成描述</span>
                        <span class="ai-sub">已预填当前内容，可补充背景后一键生成</span>
                    </div>
                    <textarea v-model="aiPrompt" class="inp ta ai-input" rows="4" placeholder="补充背景信息、复现前提、期望表现等（可选）" />
                    <div class="ai-actions">
                        <button class="ai-btn ai-btn--cancel" @click="aiOpen = false">
                            取消
                        </button>
                        <button class="ai-btn ai-btn--ok" :disabled="generatingAi" @click="confirmAi">
                            {{ generatingAi ? '生成中...' : '开始生成' }}
                        </button>
                    </div>
                </div>
            </transition>
        </div>

        <div class="field">
            <label class="field-label">标签</label>
            <input :value="tags" class="inp" placeholder="用逗号分隔，如：UI, 登录, P0" @input="$emit('update:tags', ($event.target as HTMLInputElement).value)">
        </div>
    </div>
</template>

<style lang="scss" scoped>
.field {
    &:not(:last-child) {
        margin-bottom: 14px;
    }
}

.field-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
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

    &:hover:not(:disabled) {
        background: rgba(91, 141, 239, 0.08);
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
}

.ai-panel {
    margin-top: 12px;
    padding: 12px;
    border: 1px solid rgba(91, 141, 239, 0.25);
    border-radius: 8px;
    background: rgba(91, 141, 239, 0.06);
}

.ai-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
}

.ai-title {
    font-size: 13px;
    font-weight: 600;
    color: #a8c0f5;
}

.ai-sub {
    font-size: 11px;
    color: #5f6f92;
}

.ai-input {
    min-height: 72px;
}

.ai-actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
}

.ai-btn--cancel {
    border-color: #2e2e3c;
    color: #9a9ab0;
}

.ai-btn--ok {
    border: none;
    background: #5b8def;
    color: #fff;
    font-weight: 500;

    &:hover:not(:disabled) {
        background: #6b9df5;
    }
}

.ai-fade-enter-active,
.ai-fade-leave-active {
    transition: opacity 0.18s ease, transform 0.18s ease;
}

.ai-fade-enter-from,
.ai-fade-leave-to {
    opacity: 0;
    transform: translateY(-4px);
}
</style>
