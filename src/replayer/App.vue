<script setup lang="ts">
import { ref } from 'vue';
import BottomPanel from './components/BottomPanel.vue';
import PlayerStage from './components/PlayerStage.vue';
import RePlayerHeader from './components/RePlayerHeader.vue';
import RightPanel from './components/RightPanel.vue';
import TimelineControl from './components/TimelineControl.vue';
import { useRePlayer } from './composables/useRePlayer';

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

const bottomPanelRef = ref<InstanceType<typeof BottomPanel> | null>(null);

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

        <div class="replayer-body">
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

            <RightPanel v-if="hasLoaded && currentPackage" :package="currentPackage" />
        </div>

        <BottomPanel
            v-if="hasLoaded"
            ref="bottomPanelRef"
            :visible="devtoolsVisible"
            :current-package="currentPackage"
            :current-time="currentTime"
        />
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

.replayer-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.player-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}
</style>
