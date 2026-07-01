/**
 * src/content/annotator/toolbar.ts
 *
 * 统一悬浮工具栏 UI 组件
 * - 录制控制：暂停/继续、停止、计时器
 * - 标注工具：矩形 / 箭头 / 文本 / 画笔
 * - 颜色选择器 + 撤销 / 清除
 * - 支持拖拽移动
 */

import type { AnnotationToolType } from '@shared/types';
import { ANNOTATION_COLORS } from '@shared/types';

// ============================================================
// 回调接口
// ============================================================

export interface ToolbarCallbacks {
    // ---- 录制控制 ----
    onPause: () => void;
    onResume: () => void;
    onStop: () => void;
    // ---- 标注工具 ----
    onToolSelect: (tool: AnnotationToolType | null) => void;
    onColorChange: (color: string) => void;
    onUndo: () => void;
    onClearAll: () => void;
}

// ============================================================
// 工具按钮配置
// ============================================================

interface ToolButtonConfig {
    type: AnnotationToolType;
    icon: string;
    label: string;
}

const TOOL_BUTTONS: ToolButtonConfig[] = [
    { type: 'rect', icon: 'rect', label: '矩形框选' },
    { type: 'arrow', icon: 'arrow', label: '箭头指向' },
    { type: 'text', icon: 'text', label: '文本批注' },
    { type: 'freehand', icon: 'freehand', label: '自由画笔' },
];

// ============================================================
// 内联 SVG 图标
// ============================================================

const SVG_ICONS: Record<string, string> = {
    drag: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2.5" stroke-linecap="round"><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg>`,
    pause: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#374151"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
    play: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#374151"><polygon points="6,3 20,12 6,21"/></svg>`,
    stop: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#374151"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>`,
    rect: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="16" height="12" rx="1"/></svg>`,
    arrow: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="19" x2="19" y2="5"/><polyline points="12 5 19 5 19 12"/></svg>`,
    text: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 7 5 4 19 4 19 7"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="8" y1="20" x2="16" y2="20"/></svg>`,
    freehand: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 17c2-4 6-8 10-6s4 6 2 8c-2 3-5 1-4-2s4-5 8-4"/></svg>`,
    undo: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M4 16a9 9 0 1 1 1-10"/></svg>`,
    trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M8 6v14h8V6M10 6V4h4v4"/></svg>`,
};

function createSvg(name: string): HTMLElement {
    const span = document.createElement('span');
    span.innerHTML = SVG_ICONS[name] || '';
    span.style.cssText = 'display:flex;align-items:center;justify-content:center;';
    return span;
}
// Toolbar 类
// ============================================================

export class Toolbar {
    private container: HTMLDivElement | null = null;
    private callbacks: ToolbarCallbacks;
    private selectedTool: AnnotationToolType | null = null;
    private selectedColor = ANNOTATION_COLORS[0];

    // 拖拽状态
    private isDragging = false;
    private dragStartX = 0;
    private dragStartY = 0;
    private toolbarStartX = 0;
    private toolbarStartY = 0;

    // 录制状态
    private recordingState: 'recording' | 'paused' = 'recording';
    private timerEl: HTMLSpanElement | null = null;
    private timerInterval: ReturnType<typeof setInterval> | null = null;
    private recordingStartTime = 0;
    private pauseBtn: HTMLButtonElement | null = null;
    private stopBtn: HTMLButtonElement | null = null;
    private toolButtons: Map<string, HTMLButtonElement> = new Map();

    constructor(callbacks: ToolbarCallbacks) {
        this.callbacks = callbacks;
    }

    // ============================================================
    // 显示 / 隐藏
    // ============================================================

    show(): void {
        if (this.container) return;
        this.container = this.buildToolbar();
        document.body.appendChild(this.container);
        this.recordingStartTime = Date.now();
        this.startTimer();
    }

    hide(): void {
        this.stopTimer();
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }

    get currentColor(): string {
        return this.selectedColor;
    }

    // ============================================================
    // 录制状态更新
    // ============================================================

    setPaused(): void {
        this.recordingState = 'paused';
        this.stopTimer();
        if (this.pauseBtn) {
            this.pauseBtn.innerHTML = '';
            this.pauseBtn.appendChild(createSvg('play'));
            this.pauseBtn.title = '继续录制';
        }
    }

    setResumed(): void {
        this.recordingState = 'recording';
        this.recordingStartTime = Date.now();
        this.startTimer();
        if (this.pauseBtn) {
            this.pauseBtn.innerHTML = '';
            this.pauseBtn.appendChild(createSvg('pause'));
            this.pauseBtn.title = '暂停录制';
        }
    }

    // ============================================================
    // 构建 DOM
    // ============================================================

    private buildToolbar(): HTMLDivElement {
        const el = document.createElement('div');
        el.id = 'bugreplay-toolbar';
        el.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 2147483647;
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.15);
            padding: 6px 10px;
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 6px;
            font-family: system-ui, -apple-system, sans-serif;
            user-select: none;
            cursor: default;
        `;

        // ---- 拖拽手柄 ----
        const handle = this.createDragHandle();
        el.appendChild(handle);

        // ---- 录制指示器 + 计时器 ----
        const dot = document.createElement('span');
        dot.style.cssText = 'width:8px;height:8px;background:#ef4444;border-radius:50%;flex-shrink:0;animation:bugreplay-pulse 1.5s infinite;';
        el.appendChild(dot);

        this.timerEl = document.createElement('span');
        this.timerEl.style.cssText = 'font-size:13px;font-weight:600;color:#ef4444;font-variant-numeric:tabular-nums;';
        this.timerEl.textContent = '00:00';
        el.appendChild(this.timerEl);

        // ---- 分隔线 ----
        el.appendChild(this.createDivider());

        // ---- 暂停 / 停止 ----
        this.pauseBtn = this.createIconBtn('pause', '暂停录制', () => {
            if (this.recordingState === 'recording') { this.setPaused(); this.callbacks.onPause(); }
            else { this.setResumed(); this.callbacks.onResume(); }
        });
        el.appendChild(this.pauseBtn);

        this.stopBtn = this.createIconBtn('stop', '停止录制', () => this.callbacks.onStop());
        el.appendChild(this.stopBtn);

        // ---- 分隔线 ----
        el.appendChild(this.createDivider());

        // ---- 工具按钮 ----
        for (const btn of TOOL_BUTTONS) {
            const toolBtn = this.createToolButton(btn);
            this.toolButtons.set(btn.type, toolBtn);
            el.appendChild(toolBtn);
        }

        // ---- 分隔线 ----
        el.appendChild(this.createDivider());

        // ---- 颜色选择器 ----
        el.appendChild(this.createColorPicker());

        // ---- 分隔线 ----
        el.appendChild(this.createDivider());

        // ---- 撤销 + 清除 ----
        el.appendChild(this.createIconBtn('undo', '撤销', () => this.callbacks.onUndo()));
        el.appendChild(this.createIconBtn('trash', '清除全部', () => this.callbacks.onClearAll()));

        // ---- 拖拽事件 ----
        handle.addEventListener('mousedown', this.onDragStart);
        document.addEventListener('mousemove', this.onDragMove);
        document.addEventListener('mouseup', this.onDragEnd);

        return el;
    }

    // ============================================================
    // 子组件构建
    // ============================================================

    private createDragHandle(): HTMLDivElement {
        const handle = document.createElement('div');
        handle.style.cssText = `
            display: flex; align-items: center; justify-content: center;
            padding: 0 2px; cursor: grab; color: #9ca3af;
            font-size: 14px; letter-spacing: 1px;
        `;
        handle.appendChild(createSvg('drag'));
        return handle;
    }

    private createToolButton(config: ToolButtonConfig): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.title = config.label;
        btn.style.cssText = this.iconBtnStyle();
        btn.appendChild(createSvg(config.icon));

        btn.addEventListener('mouseenter', () => {
            if (this.selectedTool !== config.type) {
                btn.style.background = '#f3f4f6';
            }
        });
        btn.addEventListener('mouseleave', () => {
            if (this.selectedTool !== config.type) {
                btn.style.background = 'transparent';
            }
        });

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.selectedTool === config.type) {
                this.deselectAllTools();
                this.callbacks.onToolSelect(null);
            } else {
                this.selectTool(config.type);
                this.callbacks.onToolSelect(config.type);
            }
        });

        return btn;
    }

    private createColorPicker(): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'color';
        input.value = ANNOTATION_COLORS[0];
        input.title = '选择颜色';
        input.style.cssText = `
            width: 26px; height: 26px; border: 2px solid #e5e7eb; border-radius: 6px;
            cursor: pointer; padding: 0; background: none; flex-shrink: 0;
        `;
        input.addEventListener('input', () => {
            this.selectedColor = input.value;
            this.callbacks.onColorChange(input.value);
        });
        input.addEventListener('click', (e) => e.stopPropagation());
        return input;
    }

    private createIconBtn(iconName: string, title: string, onClick: () => void): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.title = title;
        btn.style.cssText = this.iconBtnStyle();
        btn.appendChild(createSvg(iconName));
        btn.addEventListener('mouseenter', () => { btn.style.background = '#f3f4f6'; });
        btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });
        btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
        return btn;
    }

    private createDivider(): HTMLDivElement {
        const div = document.createElement('div');
        div.style.cssText = 'border-left: 1px solid #e5e7eb; width: 0; height: 24px; margin: 0 2px;';
        return div;
    }

    private iconBtnStyle(): string {
        return `
            display: flex; align-items: center; justify-content: center;
            width: 34px; height: 34px; border: 2px solid transparent;
            border-radius: 8px; background: transparent; cursor: pointer;
            font-size: 16px; transition: all 0.15s ease; padding: 0;
            flex-shrink: 0;
        `;
    }

    // ============================================================
    // 工具选中状态
    // ============================================================

    private selectTool(type: AnnotationToolType): void {
        this.selectedTool = type;
        this.updateToolButtonStyles();
    }

    private deselectAllTools(): void {
        this.selectedTool = null;
        this.updateToolButtonStyles();
    }

    private updateToolButtonStyles(): void {
        for (const [type, btn] of this.toolButtons) {
            if (type === this.selectedTool) {
                btn.style.borderColor = this.selectedColor;
                btn.style.background = `${this.selectedColor}18`;
            } else {
                btn.style.borderColor = 'transparent';
                btn.style.background = 'transparent';
            }
        }
    }

    // ============================================================
    // 计时器
    // ============================================================

    private startTimer(): void {
        this.stopTimer();
        const update = () => {
            if (!this.timerEl) return;
            const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
            const mins = Math.floor(elapsed / 60);
            const secs = elapsed % 60;
            this.timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        };
        update();
        this.timerInterval = setInterval(update, 1000);
    }

    private stopTimer(): void {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    // ============================================================
    // 拖拽
    // ============================================================

    private onDragStart = (e: MouseEvent): void => {
        if (!this.container) return;
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        const r = this.container.getBoundingClientRect();
        this.toolbarStartX = r.left;
        this.toolbarStartY = r.top;
        this.container.style.width = `${r.width}px`;
        this.container.style.height = `${r.height}px`;
        this.container.style.left = `${r.left}px`;
        this.container.style.top = `${r.top}px`;
        this.container.style.transform = 'none';
        this.container.style.cursor = 'grabbing';
        e.preventDefault();
    };

    private onDragMove = (e: MouseEvent): void => {
        if (!this.isDragging || !this.container) return;
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;

        let newLeft = this.toolbarStartX + dx;
        let newTop = this.toolbarStartY + dy;

        const maxLeft = window.innerWidth - this.container.offsetWidth - 8;
        const maxTop = window.innerHeight - this.container.offsetHeight - 8;
        newLeft = Math.max(8, Math.min(newLeft, maxLeft));
        newTop = Math.max(8, Math.min(newTop, maxTop));

        this.container.style.left = `${newLeft}px`;
        this.container.style.top = `${newTop}px`;
    };

    private onDragEnd = (): void => {
        if (!this.isDragging) return;
        this.isDragging = false;
        if (this.container) {
            this.container.style.cursor = 'default';
        }
    };

    // ============================================================
    // 销毁
    // ============================================================

    destroy(): void {
        this.stopTimer();
        document.removeEventListener('mousemove', this.onDragMove);
        document.removeEventListener('mouseup', this.onDragEnd);
        this.hide();
    }
}
