<script setup lang="ts">
import type { CookieEntry } from '@shared/types';
import { computed, ref } from 'vue';

interface StorageEntry { key: string; value: string }

const props = defineProps<{
    show: boolean;
    title: string;
    entries: StorageEntry[];
    isCookies: boolean;
    cookies: CookieEntry[];
}>();

const emit = defineEmits<{
    'update:show': [v: boolean];
}>();

interface CookieRow { name: string; value: string; domain: string; path: string; secure: boolean; httpOnly: boolean }
const cookieRows = computed<CookieRow[]>(() => {
    return props.cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain || '',
        path: c.path || '/',
        secure: c.secure || false,
        httpOnly: c.httpOnly || false
    }));
});

// ---- 自定义 Toast ----
const toastVisible = ref(false);
const toastMessage = ref('');
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showCustomToast(msg: string) {
    toastMessage.value = msg;
    toastVisible.value = true;
    if (toastTimer)
        clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toastVisible.value = false;
    }, 1500);
}

async function copyText(text: string) {
    try {
        await navigator.clipboard.writeText(text);
    }
    catch { /* fallback */ }
    showCustomToast('已复制');
}

function copyAll() {
    const text = props.isCookies
        ? cookieRows.value.map(c => `${c.name}: ${c.value}`).join('\n')
        : props.entries.map(e => `${e.key}: ${e.value}`).join('\n');
    copyText(text);
}

function copyEntry(entry: StorageEntry) {
    copyText(`${entry.key}: ${entry.value}`);
}
</script>

<template>
    <van-popup
        :show="show"
        position="bottom"
        :style="{ height: '65%', background: '#1e1e28' }"
        round
        closeable
        @update:show="emit('update:show', $event)"
    >
        <div class="popup-shell">
            <div class="popup-head">
                <span class="popup-title">{{ title }}</span>
                <button class="popup-copy-btn" @click="copyAll">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                    全部复制
                </button>
            </div>
            <div class="popup-body">
                <!-- Cookies 表格 -->
                <div v-if="isCookies && cookieRows.length" class="storage-table-wrap">
                    <table class="storage-table">
                        <thead>
                            <tr>
                                <th>名称</th>
                                <th>值</th>
                                <th>Domain</th>
                                <th>Path</th>
                                <th class="th-sm">
                                    Secure
                                </th>
                                <th class="th-sm">
                                    HTTP
                                </th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(c, i) in cookieRows" :key="i">
                                <td class="td-key">
                                    {{ c.name }}
                                </td>
                                <td class="td-val">
                                    {{ c.value }}
                                </td>
                                <td class="td-meta">
                                    {{ c.domain }}
                                </td>
                                <td class="td-meta">
                                    {{ c.path }}
                                </td>
                                <td class="td-icon">
                                    {{ c.secure ? '🔒' : '—' }}
                                </td>
                                <td class="td-icon">
                                    {{ c.httpOnly ? '✓' : '—' }}
                                </td>
                                <td class="td-copy">
                                    <button class="row-copy-btn" @click="copyText(`${c.name}=${c.value}`)">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <!-- Storage 表格 -->
                <div v-else class="storage-table-wrap">
                    <table class="storage-table">
                        <thead>
                            <tr>
                                <th>Key</th>
                                <th>Value</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(entry, i) in entries" :key="i">
                                <td class="td-key">
                                    {{ entry.key }}
                                </td>
                                <td class="td-val">
                                    {{ entry.value }}
                                </td>
                                <td class="td-copy">
                                    <button class="row-copy-btn" @click="copyEntry(entry)">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </van-popup>

    <!-- 自定义 Toast -->
    <Teleport to="body">
        <Transition name="toast-fade">
            <div v-if="toastVisible" class="custom-toast">
                {{ toastMessage }}
            </div>
        </Transition>
    </Teleport>
</template>

<style lang="scss" scoped>
.popup-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.popup-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 40px 10px 16px;
    border-bottom: 1px solid #32323e;
    flex-shrink: 0;

    .popup-title {
        font-size: 15px;
        font-weight: 700;
        color: #d0d0dc;
    }
}

.popup-copy-btn {
    padding: 4px 12px;
    border: 1px solid #3a3a4e;
    border-radius: 4px;
    background: transparent;
    color: #6b6b80;
    font-size: 11px;
    cursor: pointer;
    transition: all .15s;
    display: flex;
    align-items: center;
    gap: 5px;

    &:hover { border-color: #7ba4f5; color: #7ba4f5; }
}

.popup-body {
    flex: 1;
    overflow-y: auto;
}

.storage-table-wrap {
    overflow-x: auto;
}

.storage-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;

    thead {
        position: sticky;
        top: 0;
        z-index: 1;
    }

    th {
        padding: 8px 10px;
        text-align: left;
        font-weight: 600;
        color: #6b6b80;
        font-size: 11px;
        background: #1e1e28;
        border-bottom: 1px solid #32323e;
        white-space: nowrap;
    }

    .th-sm { width: 48px; text-align: center; }

    td {
        padding: 7px 10px;
        border-bottom: 1px solid rgba(255, 255, 255, .04);
        vertical-align: top;
    }

    .td-key {
        color: #a8aac0;
        font-weight: 600;
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .td-val {
        color: #bac2de;
        max-width: 260px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .td-meta {
        color: #6b6b80;
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 11px;
    }

    .td-icon {
        text-align: center;
        font-size: 11px;
    }

    .td-copy {
        width: 36px;
        text-align: center;
    }
}

.row-copy-btn {
    padding: 2px 6px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: #6b6b80;
    cursor: pointer;
    font-size: 12px;
    transition: all .15s;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover { color: #7ba4f5; background: rgba(91, 141, 239, .1); }
}
</style>

<style lang="scss">
.custom-toast {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    padding: 10px 24px;
    background: rgba(40, 40, 55, .95);
    color: #d0d0dc;
    font-size: 13px;
    border-radius: 8px;
    z-index: 10000;
    pointer-events: none;
    white-space: nowrap;
}

.toast-fade-enter-active { transition: opacity .2s ease; }
.toast-fade-leave-active { transition: opacity .25s ease; }
.toast-fade-enter-from,
.toast-fade-leave-to { opacity: 0; }
</style>
