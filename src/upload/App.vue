<script setup lang="ts">
import BugForm from './components/BugForm.vue';
import PlatformSelector from './components/PlatformSelector.vue';
import SessionInfoCard from './components/SessionInfoCard.vue';
import ZentaoTargetSelect from './components/ZentaoTargetSelect.vue';
import { useUpload } from './composables/useUpload';

const {
    settings,
    sessionInfo,
    platform,
    title,
    description,
    tags,
    submitting,
    generatingAi,
    loading,
    loadError,
    hasAi,
    canSubmit,
    zentaoProducts,
    selectedProductId,
    loadingProducts,
    productsError,
    zentaoProjects,
    selectedProjectId,
    loadingProjects,
    projectsError,
    generateDescription,
    submit,
} = useUpload();

function closePage() {
    window.close();
}
</script>

<template>
    <div class="shell">
        <header class="header">
            <button class="back-btn" @click="closePage">
                ← 返回
            </button>
            <div class="header-title-block">
                <h1 class="header-title">
                    提交 Bug 报告
                </h1>
                <span class="header-sub">将录制现场一键提交到 Bug 平台</span>
            </div>
        </header>

        <main class="body">
            <!-- 加载中 -->
            <div v-if="loading" class="status-box">
                <van-loading type="spinner" size="24" color="#7ba4f5" />
                <span class="status-text">加载中...</span>
            </div>

            <!-- 错误 -->
            <div v-else-if="loadError" class="status-box">
                <span class="status-text" style="color:#f38ba8">⚠ {{ loadError }}</span>
            </div>

            <!-- 正常内容 -->
            <template v-else>
                <SessionInfoCard v-if="sessionInfo" :session-info="sessionInfo" />
                <PlatformSelector v-model:platform="platform" :settings="settings" />
                <ZentaoTargetSelect
                    v-if="platform === 'zentao'"
                    v-model:selected-product-id="selectedProductId"
                    v-model:selected-project-id="selectedProjectId"
                    :projects="zentaoProjects" :loading-projects="loadingProjects" :projects-error="projectsError"
                    :products="zentaoProducts" :loading="loadingProducts" :error="productsError"
                />
                <BugForm
                    v-model:title="title" v-model:description="description" v-model:tags="tags" :has-ai="hasAi"
                    :generating-ai="generatingAi" @generate-ai="generateDescription"
                />
            </template>
        </main>

        <footer class="footer">
            <button class="btn-cancel" @click="closePage">
                取消
            </button>
            <button class="btn-submit" :disabled="!canSubmit" @click="submit">
                {{
                    submitting ? '提交中...' : `提交到 ${platform === 'jira' ? 'Jira' : platform === 'zentao' ? '禅道' : '平台'}`
                }}
            </button>
        </footer>
    </div>
</template>

<style lang="scss" scoped>
.shell {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #17171f;
}

.header {
    flex-shrink: 0;
    padding: 16px 20px;
    background: #1c1c25;
    border-bottom: 1px solid #262632;
    display: flex;
    align-items: center;
    gap: 14px;
}

.back-btn {
    border: none;
    background: transparent;
    color: #8f8fa5;
    font-size: 14px;
    cursor: pointer;
    padding: 4px 8px;
    margin-left: -8px;
    border-radius: 6px;
    transition: color 0.15s, background 0.15s;

    &:hover {
        color: #e4e4ee;
        background: #262632;
    }
}

.header-title-block {
    display: flex;
    flex-direction: column;
    gap: 1px;
}

.header-title {
    font-size: 16px;
    font-weight: 600;
    color: #e4e4ee;
    margin: 0;
}

.header-sub {
    font-size: 12px;
    color: #5f5f72;
}

.body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.status-box {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
}

.status-text {
    font-size: 14px;
    color: #5f5f72;
}

.footer {
    flex-shrink: 0;
    padding: 12px 16px;
    background: #1c1c25;
    border-top: 1px solid #262632;
    display: flex;
    gap: 10px;
}

.btn-cancel {
    flex: 1;
    padding: 12px;
    border: 1px solid #2e2e3c;
    border-radius: 8px;
    background: transparent;
    color: #8f8fa5;
    font-size: 14px;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;

    &:hover {
        color: #e4e4ee;
        background: #23232d;
    }
}

.btn-submit {
    flex: 2;
    padding: 12px;
    border: none;
    border-radius: 8px;
    background: #5b8def;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;

    &:hover:not(:disabled) {
        background: #6b9df5;
    }

    &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
}
</style>

<style lang="scss">
/* ===== 上传页全局基础样式（App.vue 与各表单子组件共用） ===== */
.card {
    position: relative;
    background: #1f1f28;
    border: 1px solid #2a2a36;
    border-radius: 10px;
    padding: 16px;
}

.section-title {
    font-size: 13px;
    font-weight: 600;
    color: #8f8fa5;
    margin: 0 0 10px;
}

.section-title--tight {
    margin-bottom: 0;
}

.inp {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #2e2e3c;
    border-radius: 8px;
    background: #17171f;
    color: #e4e4ee;
    font-size: 14px;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s;

    &::placeholder {
        color: #484858;
    }

    &:focus {
        border-color: #5b8def;
    }
}

.hint {
    font-size: 12px;
    color: #5f5f72;
    margin-top: 8px;

    a {
        color: #7ba4f5;
    }

    &--err {
        color: #f38ba8;
    }
}
</style>
