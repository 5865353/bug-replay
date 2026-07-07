<script setup lang="ts">
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
                    Bug<span class="text-[#cba6f7]">Replay</span>
                </span>
            </div>
        </template>
        <template #title>
            <span class="text-[#9399b2] truncate max-w-300px">
                {{ title || '回放' }}
            </span>
        </template>
    </van-nav-bar>
</template>
