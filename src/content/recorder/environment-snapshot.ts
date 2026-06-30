/**
 * src/content/recorder/environment-snapshot.ts
 *
 * 环境快照采集器 — 录制开始时采集页面运行环境信息
 *
 * 采集内容：
 * - 页面信息：URL, Title
 * - 浏览器信息：UserAgent, Language, Platform
 * - 显示信息：屏幕分辨率, 视口大小, DevicePixelRatio
 * - 存储状态：Cookies（非 HttpOnly）, LocalStorage, SessionStorage
 *
 * TODO M2: 完善敏感信息过滤逻辑
 */

import type { EnvironmentSnapshot } from '@shared/types';

export class EnvironmentCollector {
    /**
     * 采集当前页面的完整环境快照
     */
    static collect(): EnvironmentSnapshot {
        return {
            url: window.location.href,
            title: document.title,
            userAgent: navigator.userAgent,
            screenResolution: {
                width: screen.width,
                height: screen.height,
            },
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
            },
            devicePixelRatio: window.devicePixelRatio,
            language: navigator.language,
            platform: navigator.platform,
            cookies: EnvironmentCollector.collectCookies(),
            localStorage: EnvironmentCollector.collectStorage(localStorage),
            sessionStorage: EnvironmentCollector.collectStorage(sessionStorage),
            timestamp: Date.now(),
        };
    }

    /**
     * 采集 Cookies（过滤 HttpOnly，无法通过 JS 读取）
     */
    private static collectCookies(): Record<string, string> {
        const cookies: Record<string, string> = {};
        document.cookie.split(';').forEach((cookie) => {
            const [key, ...valueParts] = cookie.trim().split('=');
            if (key) {
                cookies[key] = valueParts.join('=');
            }
        });
        return cookies;
    }

    /**
     * 采集 Storage（LocalStorage / SessionStorage）
     */
    private static collectStorage(
        storage: Storage,
    ): Record<string, string> {
        const data: Record<string, string> = {};
        try {
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key) {
                    data[key] = storage.getItem(key) || '';
                }
            }
        }
        catch {
            // storage 不可访问时返回空对象
        }
        return data;
    }
}
