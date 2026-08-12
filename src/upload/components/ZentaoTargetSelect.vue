<script setup lang="ts">
import type { ZentaoProduct, ZentaoProject } from '@shared/types';

defineProps<{
    products: ZentaoProduct[];
    selectedProductId: number | null;
    projects: ZentaoProject[];
    selectedProjectId: number | null;
    loading: boolean;
    error: string;
    loadingProjects: boolean;
    projectsError: string;
}>();
const emit = defineEmits<{
    'update:selectedProductId': [value: number | null];
    'update:selectedProjectId': [value: number | null];
}>();
</script>

<template>
    <section class="card">
        <h3 class="section-title">
            目标产品
        </h3>
        <select
            v-if="products.length > 0"
            class="inp sel"
            :value="selectedProductId ?? ''"
            @change="emit('update:selectedProductId', Number(($event.target as HTMLSelectElement).value) || null)"
        >
            <option value="" disabled>
                请选择产品
            </option>
            <option v-for="p in products" :key="p.id" :value="p.id">
                {{ p.id }} - {{ p.name }}
            </option>
        </select>
        <p v-else-if="loading" class="hint">
            ⏳ 正在加载产品列表...
        </p>
        <p v-else-if="error" class="hint hint--err">
            ⚠ {{ error }}
        </p>
        <p v-else class="hint">
            没有可用的产品
        </p>

        <h3 class="section-title section-title--project">
            目标项目
        </h3>
        <select
            v-if="selectedProductId !== null && projects.length > 0"
            class="inp sel"
            :value="selectedProjectId ?? ''"
            @change="emit('update:selectedProjectId', Number(($event.target as HTMLSelectElement).value) || null)"
        >
            <option value="" disabled>
                请选择项目
            </option>
            <option v-for="p in projects" :key="p.id" :value="p.id">
                {{ p.id }} - {{ p.name }}
            </option>
        </select>
        <p v-else-if="selectedProductId !== null && loadingProjects" class="hint">
            ⏳ 正在加载项目列表...
        </p>
        <p v-else-if="selectedProductId !== null && projectsError" class="hint hint--err">
            ⚠ {{ projectsError }}
        </p>
        <p v-else-if="selectedProductId !== null" class="hint">
            没有可用的项目，请在禅道中创建后重试
        </p>
        <p v-else class="hint">
            请先选择产品
        </p>

        <p class="hint">
            📌 Bug 将提交到所选产品并关联所选项目，可在禅道「项目 → Bug」中查看
        </p>
    </section>
</template>

<style lang="scss" scoped>
.section-title--project {
    margin-top: 14px;
}

.sel {
    appearance: auto;
    cursor: pointer;

    option {
        background: #1e1e28;
        color: #d0d0dc;
    }
}
</style>
