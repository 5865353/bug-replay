/**
 * src/options/constants.ts — 设置页面专用常量
 */

// ============================================================
// 存储 Key
// ============================================================

export const STORAGE_KEY_SETTINGS = 'bugreplay_settings' as const;

// ============================================================
// 默认设置
// ============================================================

export interface Settings {
    // 用户
    username: string;
    // 录制
    maskInputs: boolean;
    mouseSample: number;
    scrollSample: number;
    maxDuration: number;
    // 回放
    replaySpeed: number;
    showAnnotations: boolean;
    // Bug 平台
    jiraEnabled: boolean;
    jiraBaseUrl: string;
    jiraEmail: string;
    jiraApiToken: string;
    jiraProjectKey: string;
    zentaoEnabled: boolean;
    zentaoBaseUrl: string;
    zentaoApiToken: string;
    zentaoProductId: string;
    // AI 平台
    aiProvider: string;
    aiApiKey: string;
    aiBaseUrl: string;
    aiModel: string;
}

export const DEFAULT_SETTINGS: Settings = {
    username: '',
    maskInputs: true,
    mouseSample: 50,
    scrollSample: 150,
    maxDuration: 30,
    replaySpeed: 1,
    showAnnotations: true,
    jiraEnabled: false,
    jiraBaseUrl: '',
    jiraEmail: '',
    jiraApiToken: '',
    jiraProjectKey: '',
    zentaoEnabled: false,
    zentaoBaseUrl: '',
    zentaoApiToken: '',
    zentaoProductId: '',
    aiProvider: '',
    aiApiKey: '',
    aiBaseUrl: '',
    aiModel: '',
};

// ============================================================
// 录制/回放选项
// ============================================================

export const MAX_DURATION_OPTIONS = [
    { value: 5, label: '5 分钟' },
    { value: 10, label: '10 分钟' },
    { value: 15, label: '15 分钟' },
    { value: 30, label: '30 分钟' },
    { value: 60, label: '60 分钟' },
] as const;

export const REPLAY_SPEED_OPTIONS = [
    { value: 0.5, label: '0.5×' },
    { value: 1, label: '1×' },
    { value: 2, label: '2×' },
    { value: 4, label: '4×' },
] as const;

// ============================================================
// AI 提供商预设（选中后自动填充 Base URL 和默认模型）
// ============================================================

export interface AIProviderPreset {
    value: string;
    label: string;
    baseUrl: string;
    defaultModel: string;
}

export const AI_PROVIDER_PRESETS: AIProviderPreset[] = [
    { value: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
    { value: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
    { value: 'moonshot', label: 'Moonshot (Kimi)', baseUrl: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-8k' },
    { value: 'zhipu', label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4-flash' },
    { value: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile' },
    { value: 'together', label: 'Together AI', baseUrl: 'https://api.together.xyz/v1', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
    { value: 'qwen', label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-plus' },
    { value: 'ollama', label: 'Ollama (本地)', baseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3' },
    { value: 'custom', label: '自定义', baseUrl: '', defaultModel: '' },
];

// ============================================================
// Tab 索引
// ============================================================

export const TAB_BASIC = 0;
export const TAB_BUG_PLATFORM = 1;
export const TAB_AI_PLATFORM = 2;

// ============================================================
// Toast 消息
// ============================================================

export const TOAST_SAVED = '保存成功';
export const TOAST_VERIFY_JIRA_OK = 'Jira 连接验证成功';
export const TOAST_VERIFY_ZENTAO_OK = '禅道连接验证成功';
export const TOAST_VERIFY_FAIL = (status: number) => `验证失败: HTTP ${status}`;
export const TOAST_NETWORK_ERROR = '网络错误';

// ============================================================
// 占位符文本
// ============================================================

export const PLACEHOLDER_USERNAME = '输入你的名字（将出现在 Bug 报告中）';
export const PLACEHOLDER_JIRA_URL = 'https://your-domain.atlassian.net';
export const PLACEHOLDER_JIRA_EMAIL = 'your-email@example.com';
export const PLACEHOLDER_JIRA_TOKEN = '从 Atlassian 账户设置获取';
export const PLACEHOLDER_JIRA_PROJECT = '如 PROJ';
export const PLACEHOLDER_ZENTAO_URL = 'https://zentao.example.com';
export const PLACEHOLDER_ZENTAO_TOKEN = '从禅道个人设置获取';
export const PLACEHOLDER_ZENTAO_PRODUCT = '数字产品 ID';

// ============================================================
// Tab 标题
// ============================================================

export const TAB_TITLE_BASIC = '基础配置';
export const TAB_TITLE_BUG = 'Bug 平台';
export const TAB_TITLE_AI = 'AI 平台';

// ============================================================
// 标签
// ============================================================

export const LABEL_USERNAME = '用户名';
export const LABEL_JIRA_URL = '实例 URL';
export const LABEL_JIRA_EMAIL = '邮箱';
export const LABEL_JIRA_TOKEN = 'API Token';
export const LABEL_JIRA_PROJECT = '项目 Key';
export const LABEL_ZENTAO_URL = '实例 URL';
export const LABEL_ZENTAO_TOKEN = 'API Token';
export const LABEL_ZENTAO_PRODUCT = '产品 ID';
export const LABEL_AI_KEY = 'API Key';
export const LABEL_AI_URL = '接口地址';
export const LABEL_AI_MODEL = '模型';
export const LABEL_VERIFY = '验证连接';
export const LABEL_SAVE = '保存设置';

// ============================================================
// 验证 API 路径
// ============================================================

export const JIRA_VERIFY_PATH = '/rest/api/3/myself';
export const ZENTAO_VERIFY_PATH = '/api.php/v1/user';

// ============================================================
// Jira Token 获取地址
// ============================================================

export const JIRA_TOKEN_URL = 'https://id.atlassian.com/manage-profile/security/api-tokens';

// ============================================================
// 提示文本
// ============================================================

export const HINT_JIRA_TOKEN = `API Token 获取地址：${JIRA_TOKEN_URL}`;
export const HINT_ZENTAO_TOKEN = 'API Token 获取路径：禅道后台 → 个人设置 → API 密钥';
export const HINT_AI_DESC = '配置 AI 服务后，可在提交 Bug 时自动生成描述内容';

// ============================================================
// 版本号
// ============================================================

export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = '一键录制 Bug 现场，生成 .rrt 离线回放文件，100% 还原案发现场。';
