/**
 * src/background/service-worker.ts — Service Worker 主入口
 *
 * 负责：
 * 1. 注册 webRequest 捕获、跨标签页录制监听
 * 2. 接收 Popup / Content Script 的消息并分发到各 handler
 *
 * 模块结构：
 * - recording-state.ts      录制状态 + 跨标签页录制监听
 * - tab-messaging.ts        向 tab 发送消息（带重试注入）
 * - webrequest-capture.ts   webRequest 头信息捕获
 * - storage-manager.ts      IndexedDB 会话存取
 * - rrt-builder.ts          .rrt 打包 / 导出
 * - handlers/               各类消息处理（录制控制 / 会话管理 / 禅道平台）
 */

import type { BackgroundToContentMessage, ContentToBackgroundMessage } from '@shared/types';
import { EXTENSION_NAME } from '@shared/constants';
import { BackgroundToContentAction, ContentToBackgroundAction } from '@shared/types';
import browser from 'webextension-polyfill';
import {
    handleGetRecordingStatus,
    handlePauseRecording,
    handleResumeRecording,
    handleStartRecording,
    handleStopRecording
} from './handlers/recording';
import { handleImportRrt } from './handlers/rrt-import';
import {
    handleDeleteAllSessions,
    handleDeleteSession,
    handleExportRRT,
    handleGetSession,
    handleGetSessions,
    handleUpdateSessionMeta
} from './handlers/sessions';
import {
    handleGetZentaoProducts,
    handleGetZentaoProjects,
    handleSubmitToPlatform
} from './handlers/zentao';
import { handleDownloadAttachment } from './handlers/zentao-download';
import { registerCrossTabRecording } from './recording-state';
import { registerWebRequestCapture } from './webrequest-capture';

console.log(`[${EXTENSION_NAME}] Service Worker initialized`);

// 注册各项监听（顶层调用一次）
registerWebRequestCapture();
registerCrossTabRecording();

// ============================================================
// 消息路由
// ============================================================

browser.runtime.onMessage.addListener(
    (
        message: unknown,
        sender: browser.Runtime.MessageSender
    ): Promise<BackgroundToContentMessage | void> | void => {
        return handleMessage(message as ContentToBackgroundMessage, sender);
    }
);

async function handleMessage(
    message: ContentToBackgroundMessage,
    sender: browser.Runtime.MessageSender
): Promise<BackgroundToContentMessage> {
    const { action, payload, requestId } = message;
    console.log(`[${EXTENSION_NAME}] SW received: ${action}`, sender.tab?.id ? `from tab ${sender.tab.id}` : 'from popup');

    switch (action) {
        // ---- 录制控制 ----
        case ContentToBackgroundAction.START_RECORDING:
            return handleStartRecording(payload, requestId);
        case ContentToBackgroundAction.STOP_RECORDING:
            return handleStopRecording(payload, requestId);
        case ContentToBackgroundAction.PAUSE_RECORDING:
            return handlePauseRecording(payload, requestId);
        case ContentToBackgroundAction.RESUME_RECORDING:
            return handleResumeRecording(payload, requestId);
        case ContentToBackgroundAction.GET_RECORDING_STATUS:
            return handleGetRecordingStatus(payload, requestId);

        // ---- 会话管理 ----
        case ContentToBackgroundAction.GET_SESSIONS:
            return handleGetSessions(payload, requestId);
        case ContentToBackgroundAction.GET_SESSION:
            return handleGetSession(payload, requestId);
        case ContentToBackgroundAction.DELETE_SESSION:
            return handleDeleteSession(payload, requestId);
        case ContentToBackgroundAction.DELETE_ALL_SESSIONS:
            return handleDeleteAllSessions(payload, requestId);
        case ContentToBackgroundAction.UPDATE_SESSION_META:
            return handleUpdateSessionMeta(payload, requestId);
        case ContentToBackgroundAction.EXPORT_RRT:
            return handleExportRRT(payload, requestId);

        // ---- 禅道平台 ----
        case ContentToBackgroundAction.GET_ZENTAO_PRODUCTS:
            return handleGetZentaoProducts(payload, requestId);
        case ContentToBackgroundAction.GET_ZENTAO_PROJECTS:
            return handleGetZentaoProjects(payload, requestId);
        case ContentToBackgroundAction.SUBMIT_TO_PLATFORM:
            return handleSubmitToPlatform(payload, requestId);

        // ---- .rrt 附件导入（禅道回放） ----
        case ContentToBackgroundAction.IMPORT_RRT:
            return handleImportRrt(payload, requestId);
        case ContentToBackgroundAction.DOWNLOAD_ATTACHMENT:
            return handleDownloadAttachment(payload, requestId);

        default:
            return { action: BackgroundToContentAction.ERROR, payload: `Unknown action: ${action}`, requestId };
    }
}

// ============================================================
// Extension 生命周期
// ============================================================

// Service Worker 安装
browser.runtime.onInstalled.addListener(details => {
    if (details.reason === 'install') {
        console.log(`[${EXTENSION_NAME}] Extension installed`);
    }
    else if (details.reason === 'update') {
        console.log(`[${EXTENSION_NAME}] Extension updated`);
    }
});
