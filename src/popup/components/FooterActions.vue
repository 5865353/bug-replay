<script setup lang="ts">
import type { RecordingSessionSummary } from '@shared/types';
import { ContentToBackgroundAction } from '@shared/types';
import { showToast } from 'vant';
import { computed } from 'vue';
import browser from 'webextension-polyfill';

const props = defineProps<{
    activeSessionId: string | null;
    sessions: RecordingSessionSummary[];
}>();

const hasActive = computed(() => props.activeSessionId !== null);

/** 当前扩展版本号（manifest 统一由 package.json 注入） */
const version = browser.runtime.getManifest().version || '';

function checkSelected(): string | null {
    if (!props.activeSessionId) {
        showToast({ message: '请先选择一条录制记录', position: 'top' });
        return null;
    }
    return props.activeSessionId;
}

async function openReplayer() {
    const id = checkSelected();
    if (!id)
        return;
    const base = browser.runtime.getURL('src/replayer/index.html');
    browser.tabs.create({ url: `${base}?sessionId=${id}` });
}

function openUpload() {
    const id = checkSelected();
    if (!id)
        return;
    const base = browser.runtime.getURL('src/upload/index.html');
    const title = encodeURIComponent(props.sessions.find(s => s.id === id)?.title || '');
    browser.tabs.create({ url: `${base}?sessionId=${id}&title=${title}` });
}

async function exportRRT() {
    const sessionId = checkSelected();
    if (!sessionId)
        return;
    await browser.runtime.sendMessage({ action: ContentToBackgroundAction.EXPORT_RRT, payload: { sessionId } });
}

async function copyToClipboard() {
    const sessionId = checkSelected();
    if (!sessionId)
        return;
    await browser.runtime.sendMessage({ action: ContentToBackgroundAction.EXPORT_RRT, payload: { sessionId, clipboard: true } });
}
</script>

<template>
    <div class="footer-bar">
        <div class="footer-row">
            <div class="footer-btn" :class="{ 'footer-btn-disabled': !hasActive }" @click="openReplayer">
                <div class="footer-btn-icon" style="background:linear-gradient(135deg,#ede9fe,#ddd6fe)">
                    <van-icon name="play-circle-o" size="18" color="#7c3aed" />
                </div>
                <span class="footer-btn-label">回放</span>
            </div>
            <div class="footer-btn" :class="{ 'footer-btn-disabled': !hasActive }" @click="openUpload">
                <div class="footer-btn-icon" style="background:linear-gradient(135deg,#e8f0fe,#d2e3fc)">
                    <van-icon name="upgrade" size="18" color="#3b82f6" />
                </div>
                <span class="footer-btn-label">上传</span>
            </div>
            <div class="footer-btn" :class="{ 'footer-btn-disabled': !hasActive }" @click="exportRRT">
                <div class="footer-btn-icon" style="background:linear-gradient(135deg,#fef3e2,#fde8c8)">
                    <van-icon name="down" size="18" color="#e4943a" />
                </div>
                <span class="footer-btn-label">导出</span>
            </div>
            <div class="footer-btn" :class="{ 'footer-btn-disabled': !hasActive }" @click="copyToClipboard">
                <div class="footer-btn-icon" style="background:linear-gradient(135deg,#e8f5e9,#c8e6c9)">
                    <van-icon name="coupon-o" size="18" color="#4caf50" />
                </div>
                <span class="footer-btn-label">复制</span>
            </div>
        </div>
        <div class="footer-version">
            BugReplay v{{ version }}
        </div>
    </div>
</template>

<style scoped>
.footer-bar {
  background: #fff;
  border-top: 1px solid #f0f0f0;
  padding: 10px 12px;
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
}

.footer-row {
  display: flex;
  gap: 0;
}

.footer-version {
  text-align: center;
  font-size: 11px;
  color: #c0c0c0;
  padding-top: 8px;
}

.footer-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  padding: 6px 4px;
  border-radius: 10px;
  transition: background 0.15s ease;
}

.footer-btn:active {
  background: #f5f5f5;
}

.footer-btn-disabled {
  opacity: 0.4;
  pointer-events: none;
}

.footer-btn-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.footer-btn-label {
  font-size: 11px;
  color: #646566;
  font-weight: 500;
}
</style>
