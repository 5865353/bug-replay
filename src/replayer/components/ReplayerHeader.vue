<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <header class="flex items-center px-3.5 py-1.5 bg-surface border-b border-border flex-shrink-0">
    <img src="/icons/icon-16.png" alt="" class="w-5.5 h-5.5 mr-2">
    <span class="text-base font-extrabold tracking-tight">
      Bug<span class="text-accent">Replay</span>
    </span>
    <span class="text-xs text-text2 ml-2.5 max-w-125 truncate">
      — {{ title || '回放' }}
    </span>
  </header>
</template>
