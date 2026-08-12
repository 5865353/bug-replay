<script setup lang="ts">
import type { Settings } from '../constants';
import {
    HINT_JIRA_TOKEN, HINT_ZENTAO_PRODUCT, HINT_ZENTAO_PROJECT, HINT_ZENTAO_TOKEN, JIRA_TOKEN_URL,
    LABEL_JIRA_EMAIL, LABEL_JIRA_PROJECT, LABEL_JIRA_TOKEN, LABEL_JIRA_URL, LABEL_VERIFY,
    LABEL_ZENTAO_ACCOUNT, LABEL_ZENTAO_PASSWORD, LABEL_ZENTAO_PRODUCT, LABEL_ZENTAO_PROJECT, LABEL_ZENTAO_TOKEN, LABEL_ZENTAO_URL,
    PLACEHOLDER_JIRA_EMAIL, PLACEHOLDER_JIRA_PROJECT, PLACEHOLDER_JIRA_TOKEN, PLACEHOLDER_JIRA_URL,
    PLACEHOLDER_ZENTAO_ACCOUNT, PLACEHOLDER_ZENTAO_PASSWORD, PLACEHOLDER_ZENTAO_PRODUCT, PLACEHOLDER_ZENTAO_PROJECT, PLACEHOLDER_ZENTAO_TOKEN, PLACEHOLDER_ZENTAO_URL,
} from '../constants';

defineProps<{ settings: Settings; isVerifying: boolean }>();
const emit = defineEmits<{ 'update:jiraEnabled': [v: boolean]; 'update:jiraBaseUrl': [v: string]; 'update:jiraEmail': [v: string]; 'update:jiraApiToken': [v: string]; 'update:jiraProjectKey': [v: string]; 'update:zentaoEnabled': [v: boolean]; 'update:zentaoBaseUrl': [v: string]; 'update:zentaoAccount': [v: string]; 'update:zentaoPassword': [v: string]; 'update:zentaoApiToken': [v: string]; 'update:zentaoProductId': [v: string]; 'update:zentaoProjectId': [v: string]; 'verify': [p: 'jira' | 'zentao'] }>();
</script>

<template>
    <div class="tab-body">
        <!-- Jira -->
        <section class="card">
            <div class="card-header">
                <h3 class="card-title">
                    Jira
                </h3>
                <label class="toggle"><input
                    type="checkbox" :checked="settings.jiraEnabled"
                    @change="emit('update:jiraEnabled', ($event.target as HTMLInputElement).checked)"
                ><span
                    class="slider"
                /></label>
            </div>
            <template v-if="settings.jiraEnabled">
                <label class="lbl">{{ LABEL_JIRA_URL }}</label>
                <input
                    class="inp" :value="settings.jiraBaseUrl" :placeholder="PLACEHOLDER_JIRA_URL"
                    @input="emit('update:jiraBaseUrl', ($event.target as HTMLInputElement).value)"
                >
                <label class="lbl">{{ LABEL_JIRA_EMAIL }}</label>
                <input
                    class="inp" :value="settings.jiraEmail" :placeholder="PLACEHOLDER_JIRA_EMAIL"
                    @input="emit('update:jiraEmail', ($event.target as HTMLInputElement).value)"
                >
                <label class="lbl">{{ LABEL_JIRA_TOKEN }}</label>
                <input
                    class="inp" type="password" :value="settings.jiraApiToken" :placeholder="PLACEHOLDER_JIRA_TOKEN"
                    @input="emit('update:jiraApiToken', ($event.target as HTMLInputElement).value)"
                >
                <label class="lbl">{{ LABEL_JIRA_PROJECT }}</label>
                <input
                    class="inp" :value="settings.jiraProjectKey" :placeholder="PLACEHOLDER_JIRA_PROJECT"
                    @input="emit('update:jiraProjectKey', ($event.target as HTMLInputElement).value)"
                >
                <p class="hint">
                    {{ HINT_JIRA_TOKEN }} <a :href="JIRA_TOKEN_URL" target="_blank">{{ JIRA_TOKEN_URL }}</a>
                </p>
                <button class="btn-verify" :disabled="isVerifying" @click="emit('verify', 'jira')">
                    <span v-if="isVerifying" class="spinner" /> {{ isVerifying ? '验证中...' : LABEL_VERIFY }}
                </button>
            </template>
        </section>
        <!-- 禅道 -->
        <section class="card">
            <div class="card-header">
                <h3 class="card-title">
                    禅道
                </h3>
                <label class="toggle"><input
                    type="checkbox" :checked="settings.zentaoEnabled"
                    @change="emit('update:zentaoEnabled', ($event.target as HTMLInputElement).checked)"
                ><span
                    class="slider"
                /></label>
            </div>
            <template v-if="settings.zentaoEnabled">
                <label class="lbl">{{ LABEL_ZENTAO_URL }}</label>
                <input
                    class="inp" :value="settings.zentaoBaseUrl" :placeholder="PLACEHOLDER_ZENTAO_URL"
                    @input="emit('update:zentaoBaseUrl', ($event.target as HTMLInputElement).value)"
                >
                <label class="lbl">{{ LABEL_ZENTAO_ACCOUNT }}</label>
                <input
                    class="inp" :value="settings.zentaoAccount" :placeholder="PLACEHOLDER_ZENTAO_ACCOUNT"
                    @input="emit('update:zentaoAccount', ($event.target as HTMLInputElement).value)"
                >
                <label class="lbl">{{ LABEL_ZENTAO_PASSWORD }}</label>
                <input
                    class="inp" type="password" :value="settings.zentaoPassword"
                    :placeholder="PLACEHOLDER_ZENTAO_PASSWORD"
                    @input="emit('update:zentaoPassword', ($event.target as HTMLInputElement).value)"
                >
                <label class="lbl">{{ LABEL_ZENTAO_TOKEN }}</label>
                <input
                    class="inp" type="password" :value="settings.zentaoApiToken"
                    :placeholder="PLACEHOLDER_ZENTAO_TOKEN"
                    @input="emit('update:zentaoApiToken', ($event.target as HTMLInputElement).value)"
                >
                <label class="lbl">{{ LABEL_ZENTAO_PRODUCT }}</label>
                <input
                    class="inp" type="number" :value="settings.zentaoProductId"
                    :placeholder="PLACEHOLDER_ZENTAO_PRODUCT"
                    @input="emit('update:zentaoProductId', ($event.target as HTMLInputElement).value)"
                >
                <p class="hint">
                    {{ HINT_ZENTAO_TOKEN }}
                </p>
                <label class="lbl">{{ LABEL_ZENTAO_PROJECT }}</label>
                <input
                    class="inp" type="number" :value="settings.zentaoProjectId"
                    :placeholder="PLACEHOLDER_ZENTAO_PROJECT"
                    @input="emit('update:zentaoProjectId', ($event.target as HTMLInputElement).value)"
                >
                <p class="hint">
                    {{ HINT_ZENTAO_PROJECT }}
                </p>
                <p class="hint">
                    {{ HINT_ZENTAO_PRODUCT }}
                </p>
                <button class="btn-verify" :disabled="isVerifying" @click="emit('verify', 'zentao')">
                    <span v-if="isVerifying" class="spinner" /> {{ isVerifying ? '验证中...' : LABEL_VERIFY }}
                </button>
            </template>
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

.card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
}

.card-title {
    font-size: 15px;
    font-weight: 600;
    color: #d0d0dc;
    margin: 0;
}

.lbl {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #6b6b80;
    margin: 12px 0 5px;
    text-transform: uppercase;
    letter-spacing: .4px;

    &:first-of-type {
        margin-top: 0;
    }
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
    transition: border-color .15s;

    &::placeholder {
        color: #505060;
    }

    &:focus {
        border-color: #5b8def;
    }
}

.hint {
    font-size: 12px;
    color: #606070;
    margin-top: 12px;
    line-height: 1.6;
    word-break: break-all;

    a {
        color: #7ba4f5;
        text-decoration: none;
    }
}

.btn-verify {
    width: 100%;
    margin-top: 14px;
    padding: 10px;
    border: 1px solid #3a3a4e;
    border-radius: 8px;
    background: #272732;
    color: #7ba4f5;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all .15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;

    &:hover {
        border-color: #5b8def;
        background: #2a2a3a;
    }

    &:disabled {
        opacity: .5;
        cursor: not-allowed;
    }
}

.spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(91, 141, 239, .25);
    border-top-color: #7ba4f5;
    border-radius: 50%;
    animation: spin .6s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
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

.toggle input:checked+.slider {
    background: rgba(91, 141, 239, .3);

    &::before {
        background: #7ba4f5;
        transform: translateX(18px);
    }
}
</style>
