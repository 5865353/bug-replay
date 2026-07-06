<script setup lang="ts">
defineProps<{
    title: string;
}>();
</script>

<template>
    <van-nav-bar fixed placeholder z-index="100">
        <template #left>
            <div class="flex items-center gap-2">
                <img src="/icons/icon-16.png" alt="" class="w-5 h-5 rounded">
                <span class="font-extrabold text-base tracking-tight">
                    Bug<span class="text-[#cba6f7]">Replay</span>
                </span>
            </div>
        </template>
        <template #title>
            <span class="text-sm text-[#9399b2] truncate max-w-300px">
                {{ title || '回放' }}
            </span>
        </template>
    </van-nav-bar>
</template>
