<script setup lang="ts">
import { ref } from 'vue'
import ReplayerHeader from './components/ReplayerHeader.vue'
import PlayerStage from './components/PlayerStage.vue'
import ControlBar from './components/ControlBar.vue'
import TimelineControl from './components/TimelineControl.vue'
import RightPanel from './components/RightPanel.vue'
import BottomPanel from './components/BottomPanel.vue'
import { useReplayer } from './composables/useReplayer'

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
} = useReplayer()

const isBottomCollapsed = ref(false)
const bottomPanelRef = ref<InstanceType<typeof BottomPanel> | null>(null)

function onDropFile(file: File) {
  loadFile(file)
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) loadFile(file)
}
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden bg-bg text-text">
    <!-- Header -->
    <ReplayerHeader :title="metadataTitle" />

    <!-- Main Body -->
    <div class="flex flex-1 overflow-hidden min-h-0">
      <!-- Player Section -->
      <div class="flex-1 flex flex-col bg-#0a0a10 min-w-0 overflow-hidden">
        <!-- Stage -->
        <PlayerStage
          :has-loaded="hasLoaded"
          :current-package="currentPackage"
          @drop-file="onDropFile"
          @file-selected="onFileSelected"
        />

        <!-- Controls -->
        <ControlBar
          v-if="hasLoaded"
          :show-annotations="showAnnotations"
          :devtools-visible="devtoolsVisible"
          @toggle-annotations="toggleAnnotations"
          @toggle-devtools="toggleDevtools"
          @replay="replay"
          @file-selected="onFileSelected"
        />

        <!-- Timeline -->
        <TimelineControl
          v-if="hasLoaded"
          :current-time="currentTime"
          :total-time="totalTime"
          :is-playing="isPlaying"
          :speed="speed"
          @play-pause="togglePlayPause"
          @seek="seekTo"
          @speed-change="setSpeed"
          @step-forward="stepForward"
          @step-back="stepBack"
        />
      </div>

      <!-- Right Panel -->
      <RightPanel v-if="hasLoaded && currentPackage" :package="currentPackage" />
    </div>

    <!-- Bottom DevTools Panel -->
    <BottomPanel
      v-if="hasLoaded"
      ref="bottomPanelRef"
      :visible="devtoolsVisible"
      :collapsed="isBottomCollapsed"
      :current-package="currentPackage"
    />
  </div>
</template>
