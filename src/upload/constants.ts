/**
 * src/upload/constants.ts — 上传页面常量
 */

import type { Settings } from '@/options/constants';

// ============================================================
// 设置接口（从 Settings 中 Pick 上传所需字段）
// ============================================================
export type UploadSettings = Pick<
    Settings,
    | 'jiraEnabled' | 'zentaoEnabled'
    | 'jiraBaseUrl' | 'jiraEmail' | 'jiraApiToken' | 'jiraProjectKey'
    | 'zentaoBaseUrl' | 'zentaoAccount' | 'zentaoPassword' | 'zentaoApiToken' | 'zentaoProductId' | 'zentaoProjectId'
    | 'aiProvider' | 'aiApiKey' | 'aiBaseUrl' | 'aiModel'
>;

export const DEFAULT_SETTINGS: UploadSettings = {
    jiraEnabled: false,
    zentaoEnabled: false,
    jiraBaseUrl: '',
    jiraEmail: '',
    jiraApiToken: '',
    jiraProjectKey: '',
    zentaoBaseUrl: '',
    zentaoAccount: '',
    zentaoPassword: '',
    zentaoApiToken: '',
    zentaoProductId: '',
    zentaoProjectId: '',
    aiProvider: '',
    aiApiKey: '',
    aiBaseUrl: '',
    aiModel: '',
};

// ============================================================
// Toast
// ============================================================
export const TOAST_AI_OK = 'AI 描述已生成';
export const TOAST_AI_FAIL = 'AI 生成失败，请检查配置';
export const TOAST_NETWORK_ERROR = '网络错误';

// ============================================================
// AI prompt
// ============================================================
export const AI_SYSTEM_PROMPT = `你是一名专业的 QA 工程师。以下是一段浏览器录制采集的问题现场数据，可能包含【环境信息】【页面跳转】【控制台日志】【网络请求】几个部分，其中日志与请求是抽样后的证据。

请基于这些证据，用中文生成一段专业、简洁的 Bug 描述，严格包含三部分：
1. 问题现象（复现步骤）：结合操作路径与异常证据，说明如何复现
2. 预期结果：正确行为应该是什么
3. 实际结果：实际发生了什么，尽量引用具体证据（如错误日志、HTTP 状态码、失败请求）

要求：聚焦异常证据（error/warn 日志、4xx/5xx 请求）；不要臆造证据中不存在的信息；若证据不足，如实说明无法判断的部分。`;
