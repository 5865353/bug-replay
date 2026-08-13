<script setup lang="ts">
import { showToast } from 'vant';
import browser from 'webextension-polyfill';
import BugForm from './components/BugForm.vue';
import SessionInfoCard from './components/SessionInfoCard.vue';
import ZentaoTargetSelect from './components/ZentaoTargetSelect.vue';
import { useUpload } from './composables/useUpload';

const {
    settings,
    sessionInfo,
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
    submitResult,
    generateDescription,
    submit
} = useUpload();

function closePage() {
    window.close();
}

function openSettings() {
    browser.runtime.openOptionsPage();
}

function openLink() {
    if (submitResult.value?.issueUrl) {
        window.open(submitResult.value.issueUrl, '_blank');
    }
}

async function copyLink() {
    const url = submitResult.value?.issueUrl;
    if (!url) return;
    try {
        await navigator.clipboard.writeText(url);
        showToast({ message: '链接已复制', duration: 1500 });
    }
    catch {
        showToast({ message: '复制失败，请手动复制', duration: 1500 });
    }
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
                <span class="header-sub">将录制现场一键提交到禅道</span>
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

                <!-- 未配置禅道：提示去设置 -->
                <section v-if="!settings.zentaoEnabled" class="panel">
                    <div class="panel-group">
                        <p class="hint">
                            ⚠ 未配置禅道，请先在<a href="#" @click.prevent="openSettings">设置</a>中启用
                        </p>
                    </div>
                </section>

                <!-- 主表单面板 -->
                <section v-else class="panel">
                    <ZentaoTargetSelect
                        v-model:selected-product-id="selectedProductId"
                        v-model:selected-project-id="selectedProjectId" :projects="zentaoProjects"
                        :loading-projects="loadingProjects" :projects-error="projectsError" :products="zentaoProducts"
                        :loading="loadingProducts" :error="productsError"
                    />
                    <BugForm
                        v-model:title="title" v-model:description="description" v-model:tags="tags" :has-ai="hasAi"
                        :generating-ai="generatingAi" @generate-ai="generateDescription"
                    />
                </section>
            </template>
        </main>

        <footer class="footer">
            <button class="btn-cancel" @click="closePage">
                取消
            </button>
            <button class="btn-submit" :disabled="!canSubmit" @click="submit">
                {{
                    submitting ? '提交中...' : '提交到禅道'
                }}
            </button>
        </footer>

        <!-- 提交成功弹窗 -->
        <div v-if="submitResult" class="dialog-mask">
            <div class="dialog">
                <div class="dialog-title">
                    ✅ 提交成功
                </div>
                <div v-if="submitResult.warning" class="dialog-warning">
                    ⚠ {{ submitResult.warning }}
                </div>
                <p class="dialog-desc">
                    Bug 已成功提交到禅道，可打开或复制链接查看。
                </p>
                <div v-if="submitResult.issueUrl" class="dialog-link">
                    <input class="inp" readonly :value="submitResult.issueUrl" @focus="($event.target as HTMLInputElement).select()">
                </div>
                <div class="dialog-actions">
                    <button class="btn-dialog btn-dialog--ghost" @click="copyLink">
                        复制链接
                    </button>
                    <button class="btn-dialog btn-dialog--ghost" @click="openLink">
                        打开链接
                    </button>
                    <button class="btn-dialog btn-dialog--primary" @click="closePage">
                        确定
                    </button>
                </div>
            </div>
        </div>
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

/* ===== 提交成功弹窗 ===== */
.dialog-mask {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.55);
}

.dialog {
    width: min(420px, calc(100vw - 48px));
    padding: 24px;
    border: 1px solid #2e2e3c;
    border-radius: 14px;
    background: #1c1c25;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.dialog-title {
    font-size: 17px;
    font-weight: 600;
    color: #7bd88f;
    text-align: center;
}

.dialog-warning {
    padding: 10px 12px;
    border: 1px solid rgba(243, 139, 168, 0.35);
    border-radius: 8px;
    background: rgba(243, 139, 168, 0.08);
    color: #f38ba8;
    font-size: 12px;
    line-height: 1.6;
}

.dialog-desc {
    margin: 0;
    font-size: 13px;
    color: #8f8fa5;
    text-align: center;
}

.dialog-link {
    .inp {
        font-size: 12px;
        color: #7ba4f5;
    }
}

.dialog-actions {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin-top: 4px;
}

.btn-dialog {
    padding: 9px 16px;
    border-radius: 8px;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;

    &--ghost {
        border: 1px solid #2e2e3c;
        background: transparent;
        color: #8f8fa5;

        &:hover {
            color: #e4e4ee;
            background: #23232d;
        }
    }

    &--primary {
        border: none;
        background: #5b8def;
        color: #fff;
        font-weight: 500;

        &:hover {
            background: #6b9df5;
        }
    }
}
</style>

<style lang="scss">
/* ===== 上传页全局基础样式（App.vue 与各表单子组件共用） ===== */
.panel {
    background: #1c1c25;
    border: 1px solid #2a2a36;
    border-radius: 12px;
    overflow: hidden;
}

.panel-group {
    padding: 16px;

    &:not(:last-child) {
        border-bottom: 1px solid #262632;
    }
}

.field-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #8a8aa0;
    margin-bottom: 8px;
}

.grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.inp {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #2e2e3c;
    border-radius: 8px;
    background: #14141b;
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
