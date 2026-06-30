// ============================================================
// src/shared/types/environment.ts — 环境快照类型定义
// ============================================================

/** 环境快照（录制启动时采集一次） */
export interface EnvironmentSnapshot {
    /** 页面完整 URL */
    url: string;
    /** 页面标题 */
    title: string;
    /** 浏览器 UserAgent 字符串 */
    userAgent: string;
    /** 屏幕分辨率 */
    screenResolution: {
        width: number;
        height: number;
    };
    /** 视口（可视区域）大小 */
    viewport: {
        width: number;
        height: number;
    };
    /** 设备像素比 (window.devicePixelRatio) */
    devicePixelRatio: number;
    /** 浏览器首选语言 (navigator.language) */
    language: string;
    /** 浏览器平台 (navigator.platform) */
    platform: string;
    /** Cookies（过滤 HttpOnly 后的键值对） */
    cookies: Record<string, string>;
    /** LocalStorage 完整快照 */
    localStorage: Record<string, string>;
    /** SessionStorage 完整快照 */
    sessionStorage: Record<string, string>;
    /** 采集时间戳 (ms) */
    timestamp: number;
}
