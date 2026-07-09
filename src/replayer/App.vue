<script setup lang="ts">
import { Pane, Splitpanes } from 'splitpanes';
import { showToast } from 'vant';
import { useExport } from '../shared/composables/useExport';
import BottomPanel from './components/BottomPanel.vue';
import PlayerStage from './components/PlayerStage.vue';
import RePlayerHeader from './components/RePlayerHeader.vue';
import RightPanel from './components/RightPanel.vue';
import TimelineControl from './components/TimelineControl.vue';
import { useRePlayer } from './composables/useRePlayer';
import 'splitpanes/dist/splitpanes.css';

const {
    currentPackage,
    hasLoaded,
    metadataTitle,
    currentTime,
    totalTime,
    isPlaying,
    speed,
    showAnnotations,
    showMouseTrail,
    devtoolsVisible,
    loadFile,
    togglePlayPause,
    seekTo,
    setSpeed,
    stepForward,
    stepBack,
    toggleAnnotations,
    toggleMouseTrail,
    toggleDevtools,
    replay,
} = useRePlayer();

function onDropFile(file: File) {
    loadFile(file);
}

function onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file)
        loadFile(file);
}

// ---- 导出 ----
const { exportRRT, copyToClipboard } = useExport({
    currentPackage,
});

async function handleExportRRT() {
    try {
        await exportRRT();
        showToast({ message: '导出成功', position: 'top', duration: 1500 });
    }
    catch (err) {
        showToast({ message: `导出失败: ${err instanceof Error ? err.message : '未知错误'}`, position: 'top' });
    }
}

async function handleCopyToClipboard() {
    try {
        await copyToClipboard();
        showToast({ message: '已复制到剪贴板', position: 'top', duration: 1500 });
    }
    catch (err) {
        showToast({ message: `复制失败: ${err instanceof Error ? err.message : '未知错误'}`, position: 'top' });
    }
}

function handleTimelineSeek(time: number) {
    seekTo(time);
}
</script>

<template>
    <div class="replayer-shell">
        <RePlayerHeader :title="metadataTitle" />

        <div class="flex-1 h-0">
            <Splitpanes class="default-theme" horizontal>
                <!-- 主体区域：播放区 + 右侧面板 -->
                <Pane :size="60" :min-size="25">
                    <Splitpanes class="default-theme">
                        <!-- 左侧：播放区 -->
                        <Pane :size="65" :min-size="40">
                            <div class="player-section">
                                <PlayerStage
                                    :has-loaded="hasLoaded"
                                    :current-package="currentPackage"
                                    @drop-file="onDropFile"
                                    @file-selected="onFileSelected"
                                />
                                <TimelineControl
                                    v-if="hasLoaded"
                                    :current-time="currentTime"
                                    :total-time="totalTime"
                                    :is-playing="isPlaying"
                                    :speed="speed"
                                    :show-annotations="showAnnotations"
                                    :show-mouse-trail="showMouseTrail"
                                    :devtools-visible="devtoolsVisible"
                                    @play-pause="togglePlayPause"
                                    @seek="seekTo"
                                    @speed-change="setSpeed"
                                    @step-forward="stepForward"
                                    @step-back="stepBack"
                                    @toggle-annotations="toggleAnnotations"
                                    @toggle-mouse-trail="toggleMouseTrail"
                                    @toggle-devtools="toggleDevtools"
                                    @replay="replay"
                                    @file-selected="onFileSelected"
                                    @export-r-r-t="handleExportRRT"
                                    @copy-to-clipboard="handleCopyToClipboard"
                                />
                            </div>
                        </Pane>
                        <!-- 右侧面板 -->
                        <Pane v-if="hasLoaded && currentPackage" :size="35" :min-size="25" :max-size="50">
                            <RightPanel :package="currentPackage" @seek="handleTimelineSeek" />
                        </Pane>
                    </Splitpanes>
                </Pane>
                <!-- 底部面板 -->
                <Pane v-if="hasLoaded && devtoolsVisible" :size="30" :min-size="15" :max-size="60">
                    <BottomPanel
                        :visible="devtoolsVisible"
                        :current-package="currentPackage"
                        :current-time="currentTime"
                    />
                </Pane>
            </Splitpanes>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.replayer-shell {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #0a0a10;
}

.player-section {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
}

.flex-1 { flex: 1; }
.h-0 { height: 0; }
</style>

<style lang="scss">
.default-theme.splitpanes .splitpanes__splitter {
    background-color: #2a2a38;
    border-color: #2a2a38;
}
</style>
