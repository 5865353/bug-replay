<script setup lang="ts">
import browser from 'webextension-polyfill';

defineProps<{
    title: string;
}>();
</script>

<template>
    <van-nav-bar placeholder z-index="100">
        <template #left>
            <div class="flex items-center gap-2">
                <img src="/icons/icon-16.png" alt="" class="w-50 h-50 rounded">
                <span class="font-extrabold  tracking-tight text-24">
                    Bug<span class="text-[#7ba4f5]">Replay</span>
                </span>
            </div>
        </template>
        <template #title>
            <span class="text-[#b0b0c4] truncate max-w-300px">
                {{ title || '鍥炴斁' }}
            </span>
        </template>
        <template #right>
            <van-icon name="setting-o" size="20" color="#b0b0c4" class="cursor-pointer" @click="browser.runtime.openOptionsPage()" />
        </template>
    </van-nav-bar>
</template>
