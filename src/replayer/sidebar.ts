/**
 * src/replayer/sidebar.ts — 侧边栏组件
 *
 * 提供双面板：
 * - 网络请求面板（列表 + 详情）
 * - 控制台日志面板（列表 + 详情）
 * - 搜索过滤
 * - 根据回放时间高亮对应时刻的条目
 */

import type { ConsoleLog, NetworkLog } from '@shared/types';
import { CONSOLE_LEVEL_COLORS } from '@shared/types';
import { formatTime } from '@shared/utils';

export type SidebarTab = 'console' | 'network';

export class Sidebar {
    private container: HTMLElement;
    private tabBtns: Record<SidebarTab, HTMLButtonElement>;
    private contentEl: HTMLElement;
    private searchInput: HTMLInputElement;
    private searchQuery = '';

    private activeTab: SidebarTab = 'console';
    private networkLogs: NetworkLog[] = [];
    private consoleLogs: ConsoleLog[] = [];
    private currentTime = 0;
    private expandedItems = new Set<string>();

    constructor(container: HTMLElement) {
        this.container = container;
        this.container.innerHTML = `
            <div class="sidebar-tabs">
                <button class="sidebar-tab active" data-tab="console">📋 控制台</button>
                <button class="sidebar-tab" data-tab="network">🌐 网络</button>
            </div>
            <div class="sidebar-search">
                <input type="text" class="search-input" placeholder="搜索..." />
            </div>
            <div id="sidebar-content" class="sidebar-content"></div>
        `;

        this.tabBtns = {
            console: this.container.querySelector('[data-tab="console"]')!,
            network: this.container.querySelector('[data-tab="network"]')!,
        };
        this.contentEl = this.container.querySelector('#sidebar-content')!;
        this.searchInput = this.container.querySelector('.search-input')!;

        this.tabBtns.console.addEventListener('click', () => this.switchTab('console'));
        this.tabBtns.network.addEventListener('click', () => this.switchTab('network'));
        this.searchInput.addEventListener('input', () => {
            this.searchQuery = this.searchInput.value.toLowerCase();
            this.render();
        });
    }

    /**
     * 设置数据
     */
    setData(networkLogs: NetworkLog[], consoleLogs: ConsoleLog[]): void {
        this.networkLogs = networkLogs;
        this.consoleLogs = consoleLogs;
        this.render();
    }

    /**
     * 根据回放时间高亮当前条目
     */
    highlightTime(time: number): void {
        this.currentTime = time;
        // 更新样式而非重新渲染（性能优化）
        this.updateHighlight();
    }

    /**
     * 切换面板
     */
    switchTab(tab: SidebarTab): void {
        this.activeTab = tab;
        this.tabBtns.console.classList.toggle('active', tab === 'console');
        this.tabBtns.network.classList.toggle('active', tab === 'network');
        this.render();
    }

    // ---- 渲染 ----

    private render(): void {
        if (this.activeTab === 'console') {
            this.renderConsole();
        } else {
            this.renderNetwork();
        }
        this.updateHighlight();
    }

    private renderConsole(): void {
        const logs = this.filterConsoleLogs();
        if (logs.length === 0) {
            this.contentEl.innerHTML = '<div class="empty-state">无匹配的控制台日志</div>';
            return;
        }

        this.contentEl.innerHTML = logs.map((log, idx) => {
            const color = CONSOLE_LEVEL_COLORS[log.level];
            const levelBadge = `<span class="log-level" style="color:${color}">[${log.level.toUpperCase()}]</span>`;
            const args = log.args.join(' ');
            const isExpanded = this.expandedItems.has(log.id);
            const startTime = logs[0].timestamp;
            const relativeTime = formatTime(log.timestamp - startTime);

            return `
                <div class="sidebar-item console-item" data-id="${log.id}" data-time="${log.timestamp}">
                    <div class="item-header">
                        <span class="item-time">${relativeTime}</span>
                        ${levelBadge}
                        <span class="item-summary">${this.escapeHtml(args.slice(0, 100))}${args.length > 100 ? '...' : ''}</span>
                        <span class="item-expand">${isExpanded ? '▾' : '▸'}</span>
                    </div>
                    ${isExpanded ? `<div class="item-detail"><pre>${this.escapeHtml(args)}</pre></div>` : ''}
                </div>
            `;
        }).join('');

        // 绑定点击事件
        this.contentEl.querySelectorAll('.console-item .item-header').forEach(header => {
            header.addEventListener('click', () => {
                const id = (header.parentElement as HTMLElement).dataset.id!;
                if (this.expandedItems.has(id)) {
                    this.expandedItems.delete(id);
                } else {
                    this.expandedItems.add(id);
                }
                this.render();
            });
        });
    }

    private renderNetwork(): void {
        const logs = this.filterNetworkLogs();
        if (logs.length === 0) {
            this.contentEl.innerHTML = '<div class="empty-state">无匹配的网络请求</div>';
            return;
        }

        this.contentEl.innerHTML = logs.map(log => {
            const statusClass = log.status >= 400 ? 'status-error' : log.status >= 300 ? 'status-redirect' : 'status-ok';
            const methodColor = this.getMethodColor(log.method);
            const isExpanded = this.expandedItems.has(log.id);
            const startTime = logs[0].startTime;
            const relativeTime = formatTime(log.startTime - startTime);

            return `
                <div class="sidebar-item network-item" data-id="${log.id}" data-time="${log.startTime}">
                    <div class="item-header">
                        <span class="item-time">${relativeTime}</span>
                        <span class="item-method" style="color:${methodColor}">${log.method}</span>
                        <span class="item-status ${statusClass}">${log.status || 'ERR'}</span>
                        <span class="item-duration">${log.duration}ms</span>
                        <span class="item-summary">${this.escapeHtml(this.truncateUrl(log.url))}</span>
                        <span class="item-expand">${isExpanded ? '▾' : '▸'}</span>
                    </div>
                    ${isExpanded ? this.renderNetworkDetail(log) : ''}
                </div>
            `;
        }).join('');

        // 绑定点击事件
        this.contentEl.querySelectorAll('.network-item .item-header').forEach(header => {
            header.addEventListener('click', () => {
                const id = (header.parentElement as HTMLElement).dataset.id!;
                if (this.expandedItems.has(id)) {
                    this.expandedItems.delete(id);
                } else {
                    this.expandedItems.add(id);
                }
                this.render();
            });
        });
    }

    private renderNetworkDetail(log: NetworkLog): string {
        return `
            <div class="item-detail">
                <div class="detail-section">
                    <strong>URL:</strong> ${this.escapeHtml(log.url)}
                </div>
                <div class="detail-section">
                    <strong>状态:</strong> ${log.status} ${log.statusText}
                    ${log.error ? `<span class="error-text"> (${log.error})</span>` : ''}
                </div>
                <div class="detail-section">
                    <strong>耗时:</strong> ${log.duration}ms | <strong>类型:</strong> ${log.requestType}
                </div>
                ${this.renderHeaders('请求头', log.requestHeaders)}
                ${log.requestBody ? this.renderBody('请求体', log.requestBody) : ''}
                ${this.renderHeaders('响应头', log.responseHeaders)}
                ${log.responseBody ? this.renderBody('响应体', log.responseBody) : ''}
            </div>
        `;
    }

    private renderHeaders(title: string, headers: Record<string, string>): string {
        const entries = Object.entries(headers);
        if (entries.length === 0) return '';
        return `
            <div class="detail-section">
                <strong>${title}:</strong>
                <pre class="detail-code">${entries.map(([k, v]) => `  ${k}: ${v}`).join('\n')}</pre>
            </div>
        `;
    }

    private renderBody(title: string, body: string): string {
        return `
            <div class="detail-section">
                <strong>${title}:</strong>
                <pre class="detail-code">${this.escapeHtml(body.slice(0, 2000))}${body.length > 2000 ? '\n... [Truncated]' : ''}</pre>
            </div>
        `;
    }

    // ---- 高亮 ----

    private updateHighlight(): void {
        const items = this.contentEl.querySelectorAll('.sidebar-item');
        items.forEach(item => {
            const itemTime = Number((item as HTMLElement).dataset.time);
            if (itemTime <= this.currentTime) {
                item.classList.add('past');
            } else {
                item.classList.remove('past');
            }
        });

        // 找到最接近当前时间的条目并滚动到可见
        let closestItem: Element | null = null;
        let closestDiff = Infinity;
        items.forEach(item => {
            const itemTime = Number((item as HTMLElement).dataset.time);
            const diff = Math.abs(itemTime - this.currentTime);
            if (diff < closestDiff) {
                closestDiff = diff;
                closestItem = item;
            }
        });

        if (closestItem) {
            (closestItem as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    // ---- 过滤 ----

    private filterConsoleLogs(): ConsoleLog[] {
        if (!this.searchQuery) return this.consoleLogs;
        return this.consoleLogs.filter(log =>
            log.args.some(a => a.toLowerCase().includes(this.searchQuery))
            || log.level.includes(this.searchQuery),
        );
    }

    private filterNetworkLogs(): NetworkLog[] {
        if (!this.searchQuery) return this.networkLogs;
        return this.networkLogs.filter(log =>
            log.url.toLowerCase().includes(this.searchQuery)
            || log.method.toLowerCase().includes(this.searchQuery)
            || String(log.status).includes(this.searchQuery),
        );
    }

    // ---- 工具 ----

    private getMethodColor(method: string): string {
        const colors: Record<string, string> = {
            GET: '#22C55E',
            POST: '#3B82F6',
            PUT: '#F59E0B',
            DELETE: '#EF4444',
            PATCH: '#A855F7',
            HEAD: '#9CA3AF',
            OPTIONS: '#9CA3AF',
        };
        return colors[method] || '#9CA3AF';
    }

    private truncateUrl(url: string): string {
        const maxLen = 60;
        if (url.length <= maxLen) return url;
        return url.slice(0, maxLen - 3) + '...';
    }

    private escapeHtml(str: string): string {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}
