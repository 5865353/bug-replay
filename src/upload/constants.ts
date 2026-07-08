/**
 * src/upload/constants.ts — 上传页面常量
 */

// ============================================================
// 设置接口
// ============================================================
export interface UploadSettings {
    jiraEnabled: boolean;
    zentaoEnabled: boolean;
    jiraBaseUrl: string;
    jiraEmail: string;
    jiraApiToken: string;
    jiraProjectKey: string;
    zentaoBaseUrl: string;
    zentaoApiToken: string;
    zentaoProductId: string;
    aiProvider: string;
    aiApiKey: string;
    aiBaseUrl: string;
    aiModel: string;
}

export const DEFAULT_SETTINGS: UploadSettings = {
    jiraEnabled: false, zentaoEnabled: false,
    jiraBaseUrl: '', jiraEmail: '', jiraApiToken: '', jiraProjectKey: '',
    zentaoBaseUrl: '', zentaoApiToken: '', zentaoProductId: '',
    aiProvider: '', aiApiKey: '', aiBaseUrl: '', aiModel: '',
};

// ============================================================
// Toast
// ============================================================
export const TOAST_AI_OK = 'AI 描述已生成';
export const TOAST_AI_FAIL = 'AI 生成失败，请检查配置';
export const TOAST_SUBMIT_FAIL = '提交失败';
export const TOAST_NETWORK_ERROR = '网络错误';

// ============================================================
// AI prompt
// ============================================================
export const AI_SYSTEM_PROMPT = '你是一个专业的 QA 工程师，请根据以下录制信息生成一段简洁的 Bug 描述（中文），包含：复现步骤、预期结果、实际结果';
