<script setup lang="ts">
import type { Settings } from '../constants';
import { AI_PROVIDER_PRESETS, HINT_AI_DESC, LABEL_AI_KEY, LABEL_AI_MODEL, LABEL_AI_URL } from '../constants';

const props = defineProps<{ settings: Settings }>();
const emit = defineEmits<{ 'update:aiProvider': [v: string]; 'update:aiApiKey': [v: string]; 'update:aiBaseUrl': [v: string]; 'update:aiModel': [v: string] }>();
function onSelect(v: string) {
    const p = AI_PROVIDER_PRESETS.find(x => x.value === v);
    emit('update:aiProvider', v);
    if (p) {
        emit('update:aiBaseUrl', p.baseUrl);
        emit('update:aiModel', p.defaultModel);
    }
}
const cur = () => AI_PROVIDER_PRESETS.find(p => p.value === props.settings.aiProvider);
const isCustom = () => props.settings.aiProvider === 'custom';
</script>

<template>
    <div class="p-16">
        <section class="card">
            <h3 class="card-title">
                🤖 AI 服务
            </h3>
            <p class="desc">
                {{ HINT_AI_DESC }}
            </p>
            <label class="lbl">提供商</label>
            <select class="sel" :value="settings.aiProvider" @change="onSelect(($event.target as HTMLSelectElement).value)">
                <option value="" disabled>
                    请选择 AI 提供商
                </option>
                <option v-for="p in AI_PROVIDER_PRESETS" :key="p.value" :value="p.value">
                    {{ p.label }}
                </option>
            </select>
            <label class="lbl">{{ LABEL_AI_KEY }}</label>
            <input class="inp" type="password" :value="settings.aiApiKey" :placeholder="cur() ? `${cur()?.label} API Key` : '输入 API Key'" @input="emit('update:aiApiKey', ($event.target as HTMLInputElement).value)">
            <label class="lbl">{{ LABEL_AI_MODEL }}</label>
            <input class="inp" :value="settings.aiModel" :placeholder="cur()?.defaultModel || '输入模型名称'" @input="emit('update:aiModel', ($event.target as HTMLInputElement).value)">
            <template v-if="isCustom() || (settings.aiProvider && settings.aiBaseUrl)">
                <label class="lbl">{{ LABEL_AI_URL }}</label>
                <input class="inp" :value="settings.aiBaseUrl" placeholder="https://your-api.com/v1" @input="emit('update:aiBaseUrl', ($event.target as HTMLInputElement).value)">
            </template>
        </section>
    </div>
</template>

<style lang="scss" scoped>
.card { background:#272732; border-radius:10px; padding:18px; border:1px solid #32323e; }
.card-title { font-size:15px; font-weight:600; color:#d0d0dc; margin:0 0 14px; padding-bottom:10px; border-bottom:1px solid #32323e; }
.desc { font-size:13px; color:#6b6b80; line-height:1.6; margin-bottom:14px; }
.lbl { display:block; font-size:12px; font-weight:600; color:#6b6b80; margin:12px 0 5px; text-transform:uppercase; letter-spacing:.4px; &:first-of-type { margin-top:0; } }
.inp { width:100%; padding:10px 12px; border:1px solid #3a3a4e; border-radius:8px; background:#1e1e28; color:#d0d0dc; font-size:14px; outline:none; box-sizing:border-box; transition:border-color .15s; &::placeholder { color:#505060; } &:focus { border-color:#5b8def; } }
.sel { width:100%; padding:10px 12px; border:1px solid #3a3a4e; border-radius:8px; background:#1e1e28; color:#d0d0dc; font-size:14px; outline:none; cursor:pointer; box-sizing:border-box; appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23707088' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; transition:border-color .15s; &:focus { border-color:#5b8def; } option { background:#22222c; color:#d0d0dc; } }
</style>
