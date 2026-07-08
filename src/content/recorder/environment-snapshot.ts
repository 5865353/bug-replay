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

import type { CookieEntry, EnvironmentSnapshot } from '@shared/types';
import browser from 'webextension-polyfill';

export class EnvironmentCollector {
    static async collect(): Promise<EnvironmentSnapshot> {
        return {
            url: window.location.href,
            title: document.title,
            userAgent: navigator.userAgent,
            screenResolution: { width: screen.width, height: screen.height },
            viewport: { width: window.innerWidth, height: window.innerHeight },
            devicePixelRatio: window.devicePixelRatio,
            language: navigator.language,
            platform: navigator.platform,
            cookies: await EnvironmentCollector.collectCookies(),
            localStorage: EnvironmentCollector.collectStorage(localStorage),
            sessionStorage: EnvironmentCollector.collectStorage(sessionStorage),
            timestamp: Date.now(),
        };
    }

    /** 通过 chrome.cookies API 获取完整 Cookie 信息 */
    private static async collectCookies(): Promise<CookieEntry[]> {
        try {
            const cookies = await browser.cookies.getAll({ url: window.location.href });
            return cookies.map(c => ({
                name: c.name,
                value: c.value,
                domain: c.domain,
                path: c.path,
                expires: c.expirationDate,
                secure: c.secure,
                httpOnly: c.httpOnly,
                sameSite: c.sameSite as CookieEntry['sameSite'],
            }));
        }
        catch {
            // fallback: 仅 name=value
            const result: CookieEntry[] = [];
            document.cookie.split(';').forEach((cookie) => {
                const [key, ...vp] = cookie.trim().split('=');
                if (key) {
                    result.push({
                        name: key,
                        value: vp.join('='),
                        domain: '',
                        path: '/',
                        secure: false,
                        httpOnly: false,
                    });
                }
            });
            return result;
        }
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
