<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
    showAnnotations: boolean;
    devtoolsVisible: boolean;
}>();

const emit = defineEmits<{
    toggleAnnotations: [];
    toggleDevtools: [];
    replay: [];
    fileSelected: [event: Event];
}>();

const fileInput = ref<HTMLInputElement>();

function openFile() {
    fileInput.value?.click();
}
</script>

<template>
    <div class="control-bar">
        <div class="control-left">
            <van-button size="small" icon="folder-o" @click="openFile">
                打开
            </van-button>
            <input
                ref="fileInput"
                type="file"
                accept=".rrt,.json"
                class="hidden"
                @change="emit('fileSelected', $event)"
            >
            <van-button size="small" :icon="showAnnotations ? 'edit' : 'edit'" @click="emit('toggleAnnotations')">
                标注
            </van-button>
            <van-button size="small" icon="replay" @click="emit('replay')">
                重播
            </van-button>
        </div>
        <van-button size="small" @click="emit('toggleDevtools')">
            {{ devtoolsVisible ? '收起面板' : '展开面板' }}
        </van-button>
    </div>
</template>

<style scoped>
.control-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: #18181f;
  border-top: 1px solid #2a2a38;
  flex-shrink: 0;
  gap: 8px;
}

.control-left {
  display: flex;
  gap: 6px;
}
</style>
