<script setup lang="ts">
import { Pane, Splitpanes } from 'splitpanes';
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
    devtoolsVisible,
    loadFile,
    togglePlayPause,
    seekTo,
    setSpeed,
    stepForward,
    stepBack,
    toggleAnnotations,
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
                                    :devtools-visible="devtoolsVisible"
                                    @play-pause="togglePlayPause"
                                    @seek="seekTo"
                                    @speed-change="setSpeed"
                                    @step-forward="stepForward"
                                    @step-back="stepBack"
                                    @toggle-annotations="toggleAnnotations"
                                    @toggle-devtools="toggleDevtools"
                                    @replay="replay"
                                    @file-selected="onFileSelected"
                                />
                            </div>
                        </Pane>
                        <!-- 右侧面板 -->
                        <Pane v-if="hasLoaded && currentPackage" :size="35" :min-size="25" :max-size="50">
                            <RightPanel :package="currentPackage" />
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

<style scoped>
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
</style>

<style>
.default-theme.splitpanes .splitpanes__splitter{
    background-color: #2a2a38;
    border-color: #2a2a38;
}
</style>
