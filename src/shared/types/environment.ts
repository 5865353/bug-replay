// ============================================================
// src/shared/types/environment.ts — 环境快照类型定义
// ============================================================

/** Cookie 完整条目 */
export interface CookieEntry {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: number;
    secure: boolean;
    httpOnly: boolean;
    sameSite?: 'strict' | 'lax' | 'no_restriction' | 'unspecified';
}

/** 环境快照（录制启动时采集一次） */
export interface EnvironmentSnapshot {
    url: string;
    title: string;
    userAgent: string;
    screenResolution: { width: number; height: number };
    viewport: { width: number; height: number };
    devicePixelRatio: number;
    language: string;
    platform: string;
    /** Cookies 完整信息（含 domain/path/expires/secure 等） */
    cookies: CookieEntry[];
    localStorage: Record<string, string>;
    sessionStorage: Record<string, string>;
    timestamp: number;
}
