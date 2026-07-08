/**
 * src/shared/composables/useExport.ts — 共享导出逻辑
 *
 * 供 Popup 和 Replayer 复用，统一处理 .rrt 文件的下载、剪贴板复制。
 *
 * 两种导出路径：
 * 1. SW 导出（sessionId 模式）：通过 browser.runtime.sendMessage 让 SW 从
 *    IndexedDB 读取 session 数据并触发下载/复制。适用于 popup、replayer 从
 *    sessionId 加载的场景。
 * 2. 直接导出（file 模式）：直接对内存中的 RRTPackage 创建 Blob 下载。
 *    适用于 replayer 从本地 .rrt 文件加载的场景。
 */

import type { RRTPackage } from '@shared/types';
import type { Ref } from 'vue';
import { ContentToBackgroundAction } from '@shared/types';
import browser from 'webextension-polyfill';

// ============================================================
// 通过 Service Worker 导出（sessionId 模式）
// ============================================================

/** 让 SW 下载指定 session 的 .rrt 文件 */
export async function exportSessionRRT(sessionId: string): Promise<void> {
    await browser.runtime.sendMessage({
        action: ContentToBackgroundAction.EXPORT_RRT,
        payload: { sessionId },
    });
}

/** 让 SW 将指定 session 的 RRT JSON 复制到剪贴板 */
export async function copySessionRRTToClipboard(sessionId: string): Promise<void> {
    await browser.runtime.sendMessage({
        action: ContentToBackgroundAction.EXPORT_RRT,
        payload: { sessionId, clipboard: true },
    });
}

// ============================================================
// 直接导出（file 模式，无需 SW）
// ============================================================

/** 直接将内存中的 RRTPackage 下载为 .rrt 文件 */
export function downloadPackageRRT(pkg: RRTPackage, filename?: string): void {
    const jsonStr = JSON.stringify(pkg, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `${pkg.metadata.title || 'recording'}.rrt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============================================================
// Vue Composable
// ============================================================

export interface UseExportOptions {
    /** 当前 RRT 包（file 模式时使用，支持 Ref） */
    currentPackage?: Ref<RRTPackage | null> | RRTPackage | null;
    /** 当前 sessionId（SW 模式时使用） */
    sessionId?: Ref<string | null> | string | null;
}

export function useExport(options: UseExportOptions = {}) {
    function resolvePackage(): RRTPackage | null {
        const pkg = options.currentPackage;
        if (pkg && typeof pkg === 'object' && 'value' in pkg) return pkg.value;
        return (pkg as RRTPackage | null) ?? null;
    }

    function resolveSessionId(): string | null {
        const sid = options.sessionId;
        if (sid && typeof sid === 'object' && 'value' in sid) return sid.value;
        return (sid as string | null) ?? null;
    }

    /** 导出 .rrt 文件（优先 SW 模式，fallback 直接下载） */
    async function exportRRT(): Promise<void> {
        const sid = resolveSessionId();
        if (sid) {
            await exportSessionRRT(sid);
            return;
        }
        const pkg = resolvePackage();
        if (pkg) {
            downloadPackageRRT(pkg);
            return;
        }
        throw new Error('没有可导出的数据');
    }

    /** 复制 RRT JSON 到剪贴板 */
    async function copyToClipboard(): Promise<void> {
        const sid = resolveSessionId();
        if (sid) {
            await copySessionRRTToClipboard(sid);
            return;
        }
        const pkg = resolvePackage();
        if (pkg) {
            const jsonStr = JSON.stringify(pkg, null, 2);
            await navigator.clipboard.writeText(jsonStr);
            return;
        }
        throw new Error('没有可复制的数据');
    }

    return { exportRRT, copyToClipboard };
}
