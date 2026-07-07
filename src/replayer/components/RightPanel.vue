<script setup lang="ts">
import type { RRTPackage } from '@shared/types';
import { ref } from 'vue';

defineProps<{
    package: RRTPackage;
}>();

const activeTab = ref(0);

function formatDuration(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
}
</script>

<template>
    <div class="right-panel">
        <van-tabs v-model:active="activeTab" type="card" color="#cba6f7" title-active-color="#cdd6f4" title-inactive-color="#585b70" background="#18181f">
            <van-tab title="录制信息">
                <div class="panel-content">
                    <div class="info-section">
                        <div class="section-title">
                            📦 录制元数据
                        </div>
                        <div class="info-row">
                            <span>标题</span><span>{{ package.metadata.title }}</span>
                        </div>
                        <div class="info-row">
                            <span>时长</span><span>{{ formatDuration(package.metadata.duration) }}</span>
                        </div>
                        <div class="info-row">
                            <span>事件数</span><span>{{ package.rrwebEvents.length }}</span>
                        </div>
                        <div class="info-row">
                            <span>网络请求</span><span>{{ package.networkLogs.length }}</span>
                        </div>
                        <div class="info-row">
                            <span>控制台</span><span>{{ package.consoleLogs.length }}</span>
                        </div>
                        <div class="info-row">
                            <span>标注</span><span>{{ package.annotations.length }}</span>
                        </div>
                        <div v-if="package.metadata.tags?.length" class="info-row">
                            <span>标签</span><span>{{ package.metadata.tags.join(', ') }}</span>
                        </div>
                        <div v-if="package.metadata.description" class="info-row">
                            <span>描述</span><span class="text-right">{{ package.metadata.description }}</span>
                        </div>
                    </div>
                    <div v-if="package.environment" class="info-section">
                        <div class="section-title">
                            🖥 环境信息
                        </div>
                        <div class="info-row">
                            <span>URL</span><span class="truncate">{{ package.environment.url }}</span>
                        </div>
                        <div class="info-row">
                            <span>视口</span><span>{{ package.environment.viewport?.width }}×{{ package.environment.viewport?.height }}</span>
                        </div>
                        <div class="info-row">
                            <span>语言</span><span>{{ package.environment.language }}</span>
                        </div>
                        <div class="info-row">
                            <span>UA</span><span class="truncate text-10px">{{ package.environment.userAgent.slice(0, 60) }}...</span>
                        </div>
                    </div>
                </div>
            </van-tab>
            <van-tab title="关键帧">
                <div class="panel-content">
                    <van-empty v-if="package.annotations.length === 0" description="暂无标注关键帧" :image-size="50" />
                    <div v-else class="keyframe-list">
                        <div v-for="(ann, i) in package.annotations" :key="i" class="kf-item">
                            <van-tag type="primary" size="medium">
                                {{ i + 1 }}
                            </van-tag>
                            <span class="kf-icon">{{ ann.type === 'rect' ? '⬜' : ann.type === 'arrow' ? '➡' : ann.type === 'text' ? '📝' : '✏️' }}</span>
                            <span class="kf-type">{{ ann.type }}</span>
                            <span class="kf-time">{{ formatDuration(ann.timestamp) }}</span>
                        </div>
                    </div>
                </div>
            </van-tab>
        </van-tabs>
    </div>
</template>

<style scoped>
.right-panel {
  width: 400px;
  flex-shrink: 0;
  background: #18181f;
  border-left: 1px solid #2a2a38;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.panel-content { flex: 1; overflow-y: auto; padding: 12px; }
.info-section { margin-bottom: 14px; }
.section-title { font-size: 14px; font-weight: 600; color: #585b70; margin-bottom: 8px; letter-spacing: 0.5px; }
.info-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 3px 0; font-size: 12px; gap: 8px; }
.info-row span:first-child { color: #585b70; flex-shrink: 0; }
.info-row span:last-child { color: #9399b2; text-align: right; word-break: break-all; }
.keyframe-list { display: flex; flex-direction: column; gap: 4px; }
.kf-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; border: 1px solid transparent; cursor: pointer; font-size: 12px; transition: all 0.15s; }
.kf-item:hover { background: #1e1e28; border-color: #2a2a38; }
.kf-icon { flex-shrink: 0; font-size: 14px; }
.kf-type { color: #9399b2; flex: 1; }
.kf-time { color: #585b70; font-size: 10px; font-variant-numeric: tabular-nums; }
</style>
