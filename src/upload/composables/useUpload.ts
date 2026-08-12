/**
 * src/upload/composables/useUpload.ts — 上传逻辑 hooks
 */
import type { BackgroundToContentMessage, RecordingSession, ZentaoProduct, ZentaoProductsResult, ZentaoProject, ZentaoProjectsResult } from '@shared/types';
import type { UploadSettings } from '../constants';
import { BackgroundToContentAction, ContentToBackgroundAction } from '@shared/types';
import { showToast } from 'vant';
import { computed, onMounted, ref, watch } from 'vue';
import browser from 'webextension-polyfill';
import { buildAIContext } from '../ai-context';
import { AI_SYSTEM_PROMPT, DEFAULT_SETTINGS, TOAST_AI_FAIL, TOAST_AI_OK, TOAST_NETWORK_ERROR } from '../constants';

export function useUpload() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('sessionId') || '';
    const initialTitle = decodeURIComponent(params.get('title') || '');

    const settings = ref<UploadSettings>({ ...DEFAULT_SETTINGS });
    const sessionInfo = ref<RecordingSession | null>(null);
    const title = ref(initialTitle);
    const description = ref('');
    const tags = ref('');
    const submitting = ref(false);
    const generatingAi = ref(false);
    const loading = ref(true);
    const loadError = ref('');
    const zentaoProducts = ref<ZentaoProduct[]>([]);
    const selectedProductId = ref<number | null>(null);
    const loadingProducts = ref(false);
    const productsError = ref('');
    const zentaoProjects = ref<ZentaoProject[]>([]);
    const selectedProjectId = ref<number | null>(null);
    const loadingProjects = ref(false);
    const projectsError = ref('');

    const hasAi = computed(() => !!settings.value.aiProvider && !!settings.value.aiApiKey);
    const canSubmit = computed(() =>
        settings.value.zentaoEnabled
        && title.value.trim().length > 0
        && !submitting.value
        && selectedProductId.value !== null
        && selectedProjectId.value !== null);

    /** 构建禅道配置（提交时使用用户选择的产品 ID） */
    function buildZentaoConfig(): Record<string, unknown> {
        return {
            baseUrl: settings.value.zentaoBaseUrl,
            account: settings.value.zentaoAccount,
            password: settings.value.zentaoPassword,
            apiToken: settings.value.zentaoApiToken,
            productId: selectedProductId.value ?? (Number(settings.value.zentaoProductId) || 0),
            projectId: selectedProjectId.value ?? (Number(settings.value.zentaoProjectId) || 0),
        };
    }

    /** 从禅道拉取产品列表 */
    async function loadZentaoProducts(): Promise<void> {
        if (!settings.value.zentaoBaseUrl) {
            productsError.value = '请先在设置中配置禅道实例 URL';
            return;
        }
        if (loadingProducts.value) return;

        loadingProducts.value = true;
        productsError.value = '';
        try {
            const resp = await browser.runtime.sendMessage({
                action: ContentToBackgroundAction.GET_ZENTAO_PRODUCTS,
                payload: buildZentaoConfig(),
            }) as BackgroundToContentMessage;

            if (resp.action === BackgroundToContentAction.ZENTAO_PRODUCTS) {
                const result = resp.payload as ZentaoProductsResult;
                if (result.success && result.products?.length) {
                    zentaoProducts.value = result.products;
                    // 优先选中设置里配置的产品 ID，不在列表中则默认选第一个
                    const configured = Number(settings.value.zentaoProductId);
                    selectedProductId.value = result.products.some(p => p.id === configured)
                        ? configured
                        : result.products[0]!.id;
                }
                else {
                    productsError.value = result.error || '获取产品列表失败';
                }
            }
            else {
                productsError.value = String(resp.payload || '获取产品列表失败');
            }
        }
        catch (err: unknown) {
            productsError.value = err instanceof Error ? err.message : '获取产品列表失败';
        }
        finally {
            loadingProducts.value = false;
        }
    }

    // 切换到禅道时自动加载产品列表
    /** 从禅道拉取项目列表 */
    async function loadZentaoProjects(): Promise<void> {
        if (!settings.value.zentaoBaseUrl) {
            projectsError.value = '请先在设置中配置禅道实例 URL';
            return;
        }
        if (loadingProjects.value) return;

        loadingProjects.value = true;
        projectsError.value = '';
        try {
            const resp = await browser.runtime.sendMessage({
                action: ContentToBackgroundAction.GET_ZENTAO_PROJECTS,
                payload: buildZentaoConfig(),
            }) as BackgroundToContentMessage;

            if (resp.action === BackgroundToContentAction.ZENTAO_PROJECTS) {
                const result = resp.payload as ZentaoProjectsResult;
                if (result.success && result.projects?.length) {
                    zentaoProjects.value = result.projects;
                    const configured = Number(settings.value.zentaoProjectId);
                    selectedProjectId.value = result.projects.some(p => p.id === configured)
                        ? configured
                        : result.projects[0]!.id;
                }
                else {
                    projectsError.value = result.error || '获取项目列表失败';
                }
            }
            else {
                projectsError.value = String(resp.payload || '获取项目列表失败');
            }
        }
        catch (err: unknown) {
            projectsError.value = err instanceof Error ? err.message : '获取项目列表失败';
        }
        finally {
            loadingProjects.value = false;
        }
    }

    // 切换产品时重新加载项目列表
    watch(selectedProductId, (id) => {
        if (id !== null) {
            loadZentaoProjects();
        }
        else {
            zentaoProjects.value = [];
            selectedProjectId.value = null;
        }
    });

    onMounted(async () => {
        try {
            const s = await browser.storage.local.get('bugreplay_settings');
            if (s.bugreplay_settings) Object.assign(settings.value, s.bugreplay_settings);
            // 默认禅道：预加载产品列表
            if (settings.value.zentaoEnabled && settings.value.zentaoBaseUrl) {
                loadZentaoProducts();
            }

            if (sessionId) {
                const resp = await browser.runtime.sendMessage({
                    action: ContentToBackgroundAction.GET_SESSION,
                    payload: { sessionId },
                }) as BackgroundToContentMessage;

                if (resp.action === BackgroundToContentAction.SESSION_DATA && resp.payload) {
                    sessionInfo.value = resp.payload as RecordingSession;
                    // 填充已有标签
                    if (sessionInfo.value.tags?.length) {
                        tags.value = sessionInfo.value.tags.join(', ');
                    }
                }
                else {
                    loadError.value = '会话不存在或已被删除';
                }
            }
            else {
                loadError.value = '缺少会话参数';
            }
        }
        catch {
            loadError.value = '加载失败，请检查网络后重试';
        }
        finally {
            loading.value = false;
        }
    });

    function parseTags(): string[] {
        return tags.value
            .split(',')
            .map(t => t.trim())
            .filter(Boolean);
    }

    async function generateDescription(prompt?: string): Promise<void> {
        if (!hasAi.value || !sessionInfo.value) return;
        generatingAi.value = true;
        try {
            // 将录制内容（控制台/网络/页面跳转/环境）构建为 AI 上下文
            // 内部按“优先级 + 预算 + 抽样 + 截断”优化，避免脚本过大超出模型上下文
            let ctx = buildAIContext(sessionInfo.value);
            // 用户补充说明（复现前提、期望表现等）附加到上下文
            if (prompt) {
                ctx += `\n\n## 用户补充说明\n${prompt}`;
            }

            const resp = await fetch(`${settings.value.aiBaseUrl}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.value.aiApiKey}` },
                body: JSON.stringify({
                    model: settings.value.aiModel,
                    messages: [{ role: 'system', content: AI_SYSTEM_PROMPT }, { role: 'user', content: ctx }],
                }),
            });
            if (!resp.ok) {
                const err = await resp.text().catch(() => '');
                throw new Error(`HTTP ${resp.status}${err ? `: ${err.slice(0, 100)}` : ''}`);
            }
            const data = await resp.json();
            description.value = (data.choices?.[0]?.message?.content || '').trim();
            showToast({ message: TOAST_AI_OK, duration: 1500 });
        }
        catch (err: unknown) {
            const msg = err instanceof Error ? err.message : TOAST_AI_FAIL;
            showToast({ message: msg, duration: 3000 });
        }
        finally {
            generatingAi.value = false;
        }
    }

    async function submit(): Promise<void> {
        if (!canSubmit.value) return;
        submitting.value = true;
        try {
            const cfg: Record<string, unknown> = buildZentaoConfig();

            // 先将标题/描述/标签写回 session
            await browser.runtime.sendMessage({
                action: ContentToBackgroundAction.UPDATE_SESSION_META,
                payload: {
                    sessionId,
                    updates: {
                        title: title.value.trim(),
                        description: description.value.trim(),
                        tags: parseTags(),
                    },
                },
            });

            const resp = await browser.runtime.sendMessage({
                action: ContentToBackgroundAction.SUBMIT_TO_PLATFORM,
                payload: { sessionId, platform: 'zentao', config: cfg },
            }) as BackgroundToContentMessage;

            if (resp.action === BackgroundToContentAction.SESSION_UPDATED) {
                const r = resp.payload as { issueUrl?: string; warning?: string };
                if (r.warning) {
                    // 附件等非致命告警：延长展示时间，避免页面过早关闭
                    showToast({ message: r.warning, position: 'top', duration: 6000 });
                    setTimeout(() => window.close(), 6000);
                }
                else {
                    showToast({ message: r.issueUrl ? `已提交: ${r.issueUrl}` : '提交成功', duration: 4000 });
                    setTimeout(() => window.close(), 2000);
                }
            }
            else {
                showToast({ message: `提交失败: ${resp.payload || '未知错误'}`, duration: 3000 });
            }
        }
        catch (err: unknown) {
            showToast({ message: `提交失败: ${err instanceof Error ? err.message : TOAST_NETWORK_ERROR}`, duration: 3000 });
        }
        finally {
            submitting.value = false;
        }
    }

    return {
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
        loadZentaoProjects,
        loadZentaoProducts,
        generateDescription,
        submit,
    };
}
