<script setup lang="ts">
import type { Settings } from '../constants';
import { LABEL_USERNAME, MAX_DURATION_OPTIONS, PLACEHOLDER_USERNAME, REPLAY_SPEED_OPTIONS } from '../constants';

defineProps<{ settings: Settings }>();
const emit = defineEmits<{ 'update:username': [v: string]; 'update:maskInputs': [v: boolean]; 'update:mouseSample': [v: number]; 'update:scrollSample': [v: number]; 'update:maxDuration': [v: number]; 'update:replaySpeed': [v: number]; 'update:showAnnotations': [v: boolean]; 'update:showMouseTrail': [v: boolean] }>();
</script>

<template>
    <div class="tab-body">
        <section class="card">
            <h3 class="card-title">
                👤 {{ LABEL_USERNAME }}
            </h3>
            <input
                class="inp"
                :value="settings.username"
                :placeholder="PLACEHOLDER_USERNAME"
                @input="emit('update:username', ($event.target as HTMLInputElement).value)"
            >
        </section>
        <section class="card">
            <h3 class="card-title">
                🎬 录制
            </h3>
            <!-- 屏蔽 -->
            <div class="row">
                <span class="row-label">屏蔽密码等敏感输入</span>
                <label class="toggle"><input type="checkbox" :checked="settings.maskInputs" @change="emit('update:maskInputs', ($event.target as HTMLInputElement).checked)"><span class="slider" /></label>
            </div>
            <!-- 时长 -->
            <div class="row">
                <span class="row-label">最大录制时长</span>
                <select class="sel" :value="settings.maxDuration" @change="emit('update:maxDuration', Number(($event.target as HTMLSelectElement).value))">
                    <option v-for="o in MAX_DURATION_OPTIONS" :key="o.value" :value="o.value">
                        {{ o.label }}
                    </option>
                </select>
            </div>
            <!-- 鼠标采样 -->
            <div class="row">
                <span class="row-label">鼠标采样间隔</span>
                <input class="inp-sm" type="number" :value="settings.mouseSample" min="10" max="500" @input="emit('update:mouseSample', Number(($event.target as HTMLInputElement).value))">
            </div>
            <p class="desc">
                ms，越小轨迹越流畅，文件越大
            </p>
            <!-- 滚动采样 -->
            <div class="row">
                <span class="row-label">滚动采样间隔</span>
                <input class="inp-sm" type="number" :value="settings.scrollSample" min="50" max="1000" @input="emit('update:scrollSample', Number(($event.target as HTMLInputElement).value))">
            </div>
            <p class="desc">
                ms，越小越精确，文件越大
            </p>
        </section>
        <section class="card">
            <h3 class="card-title">
                ▶️ 回放
            </h3>
            <div class="row">
                <span class="row-label">默认播放速度</span>
                <select class="sel" :value="settings.replaySpeed" @change="emit('update:replaySpeed', Number(($event.target as HTMLSelectElement).value))">
                    <option v-for="o in REPLAY_SPEED_OPTIONS" :key="o.value" :value="o.value">
                        {{ o.label }}
                    </option>
                </select>
            </div>
            <div class="row">
                <span class="row-label">默认显示标注</span>
                <label class="toggle"><input type="checkbox" :checked="settings.showAnnotations" @change="emit('update:showAnnotations', ($event.target as HTMLInputElement).checked)"><span class="slider" /></label>
            </div>
            <div class="row">
                <span class="row-label">显示鼠标轨迹</span>
                <label class="toggle"><input type="checkbox" :checked="settings.showMouseTrail" @change="emit('update:showMouseTrail', ($event.target as HTMLInputElement).checked)"><span class="slider" /></label>
            </div>
        </section>
    </div>
</template>

<style lang="scss" scoped>
.tab-body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.card {
    background: #272732;
    border-radius: 10px;
    padding: 18px;
    border: 1px solid #32323e;
}

.card-title {
    font-size: 14px;
    font-weight: 600;
    color: #d0d0dc;
    margin: 0 0 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid #32323e;
}

.row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 0;
}

.row-label {
    font-size: 14px;
    color: #b0b0c4;
}

.desc {
    font-size: 12px;
    color: #606070;
    margin: 2px 0 8px 0;
}

.inp {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #3a3a4e;
    border-radius: 8px;
    background: #1e1e28;
    color: #d0d0dc;
    font-size: 14px;
    outline: none;
    box-sizing: border-box;

    &::placeholder { color: #505060; }
    &:focus { border-color: #5b8def; }
}

.inp-sm {
    width: 72px;
    padding: 6px 8px;
    border: 1px solid #3a3a4e;
    border-radius: 6px;
    background: #1e1e28;
    color: #d0d0dc;
    font-size: 14px;
    text-align: center;
    outline: none;

    &:focus { border-color: #5b8def; }
}

.sel {
    padding: 6px 28px 6px 10px;
    border: 1px solid #3a3a4e;
    border-radius: 6px;
    background: #1e1e28;
    color: #d0d0dc;
    font-size: 13px;
    outline: none;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23707088' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;

    option {
        background: #22222c;
        color: #d0d0dc;
    }
}

.toggle {
    position: relative;
    display: inline-block;
    width: 40px;
    height: 22px;
    cursor: pointer;

    input {
        opacity: 0;
        width: 0;
        height: 0;
    }
}

.slider {
    position: absolute;
    inset: 0;
    background: #3a3a4e;
    border-radius: 11px;
    transition: .2s;

    &::before {
        content: '';
        position: absolute;
        width: 16px;
        height: 16px;
        left: 3px;
        top: 3px;
        background: #707088;
        border-radius: 50%;
        transition: .2s;
    }
}

.toggle input:checked + .slider {
    background: rgba(91, 141, 239, .3);

    &::before {
        background: #7ba4f5;
        transform: translateX(18px);
    }
}
</style>
