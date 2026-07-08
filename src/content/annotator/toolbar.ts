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
import {
    BADGE_FONT_SIZE,
    COLOR_BADGE_END,
    COLOR_BADGE_START,
    COLOR_DIVIDER,
    COLOR_DRAG_HANDLE,
    COLOR_HINT_ACCENT,
    COLOR_HINT_BG,
    COLOR_HINT_TEXT,
    COLOR_HOVER_BG,
    COLOR_ICON_PRIMARY,
    COLOR_PICKER_SIZE,
    COLOR_RECORDING,
    DIVIDER_HEIGHT,
    DOM_EVENT_CLICK,
    DOM_EVENT_INPUT,
    DOM_EVENT_MOUSE_DOWN,
    DOM_EVENT_MOUSE_ENTER,
    DOM_EVENT_MOUSE_LEAVE,
    DOM_EVENT_MOUSE_MOVE,
    DOM_EVENT_MOUSE_UP,
    DOT_SIZE,
    DRAG_MARGIN,
    ICON_BTN_RADIUS,
    ICON_BTN_SIZE,
    ID_TOOLBAR,
    LABEL_CLEAR_ALL,
    LABEL_PAUSE,
    LABEL_PICK_COLOR,
    LABEL_RESUME,
    LABEL_STOP,
    LABEL_UNDO,
    TIMER_FONT_SIZE,
    TIMER_INITIAL,
    TIMER_INTERVAL,
    TOOLBAR_BORDER_RADIUS,
    TOOLBAR_BOTTOM,
    TOOLBAR_GAP,
    TOOLBAR_PADDING,
    Z_INDEX_TOOLBAR,
} from '../constants';

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
    undo: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9 5 4"/><path d="M4 9h10a6 6 0 0 1 0 12h-4"/></svg>`,
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
    private drawingBadge: HTMLSpanElement | null = null;
    private hintPanel: HTMLDivElement | null = null;

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
        if (this.hintPanel) {
            this.hintPanel.remove();
            this.hintPanel = null;
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
            this.pauseBtn.title = LABEL_RESUME;
        }
    }

    setResumed(): void {
        this.recordingState = 'recording';
        this.recordingStartTime = Date.now();
        this.startTimer();
        if (this.pauseBtn) {
            this.pauseBtn.innerHTML = '';
            this.pauseBtn.appendChild(createSvg('pause'));
            this.pauseBtn.title = LABEL_PAUSE;
        }
    }

    // ============================================================
    // 构建 DOM
    // ============================================================

    private buildToolbar(): HTMLDivElement {
        const el = document.createElement('div');
        el.id = ID_TOOLBAR;
        el.style.cssText = `
            position: fixed;
            bottom: ${TOOLBAR_BOTTOM}px;
            left: 50%;
            transform: translateX(-50%);
            z-index: ${Z_INDEX_TOOLBAR};
            background: #ffffff;
            border-radius: ${TOOLBAR_BORDER_RADIUS}px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.15);
            padding: ${TOOLBAR_PADDING};
            display: inline-flex;
            flex-direction: row;
            align-items: center;
            gap: ${TOOLBAR_GAP}px;
            font-family: system-ui, -apple-system, sans-serif;
            user-select: none;
            cursor: default;
            white-space: nowrap;
        `;

        // ---- 拖拽手柄 ----
        const handle = this.createDragHandle();
        el.appendChild(handle);

        // ---- 录制指示器 + 计时器 ----
        const dot = document.createElement('span');
        dot.style.cssText = `width:${DOT_SIZE}px;height:${DOT_SIZE}px;background:${COLOR_RECORDING};border-radius:50%;flex-shrink:0;animation:bugreplay-pulse 1.5s infinite;`;
        el.appendChild(dot);

        this.timerEl = document.createElement('span');
        this.timerEl.style.cssText = `font-size:${TIMER_FONT_SIZE}px;font-weight:600;color:${COLOR_RECORDING};font-variant-numeric:tabular-nums;`;
        this.timerEl.textContent = TIMER_INITIAL;
        el.appendChild(this.timerEl);

        // ---- 绘制中标识 ----
        this.drawingBadge = document.createElement('span');
        this.drawingBadge.style.cssText = `
            font-size: ${BADGE_FONT_SIZE}px; font-weight: 700; color: #fff;
            background: linear-gradient(135deg, ${COLOR_BADGE_START}, ${COLOR_BADGE_END});
            padding: 2px 7px; border-radius: 5px; display: none;
            flex-shrink: 0; letter-spacing: 0.5px; cursor: help;
            align-items: center; gap: 3px;
        `;
        this.drawingBadge.innerHTML = `绘制中 <span style="display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;background:rgba(255,255,255,0.25);border-radius:50%;font-size:9px;font-weight:700;">i</span>`;
        this.drawingBadge.title = '悬停查看提示';
        el.appendChild(this.drawingBadge);

        // ---- 分隔线 ----
        el.appendChild(this.createDivider());

        // ---- 暂停 / 停止 ----
        this.pauseBtn = this.createIconBtn('pause', LABEL_PAUSE, () => {
            if (this.recordingState === 'recording') {
                this.setPaused();
                this.callbacks.onPause();
            }
            else {
                this.setResumed();
                this.callbacks.onResume();
            }
        });
        el.appendChild(this.pauseBtn);

        this.stopBtn = this.createIconBtn('stop', LABEL_STOP, () => this.callbacks.onStop());
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
        el.appendChild(this.createIconBtn('undo', LABEL_UNDO, () => this.callbacks.onUndo()));
        el.appendChild(this.createIconBtn('trash', LABEL_CLEAR_ALL, () => this.callbacks.onClearAll()));

        // ---- 拖拽事件 ----
        handle.addEventListener(DOM_EVENT_MOUSE_DOWN, this.onDragStart);
        document.addEventListener(DOM_EVENT_MOUSE_MOVE, this.onDragMove);
        document.addEventListener(DOM_EVENT_MOUSE_UP, this.onDragEnd);

        // ---- 绘制提示面板 ----
        this.hintPanel = document.createElement('div');
        this.hintPanel.style.cssText = `
            position: fixed; left: 50%; transform: translateX(-50%);
            display: none; flex-direction: column; gap: 0;
            z-index: ${Z_INDEX_TOOLBAR}; pointer-events: none;
        `;
        this.hintPanel.innerHTML = `
            <div style="background:${COLOR_HINT_BG};color:${COLOR_HINT_TEXT};padding:8px 14px;border-radius:10px;font-size:12px;line-height:1.7;box-shadow:0 4px 16px rgba(0,0,0,0.25);white-space:nowrap;text-align:center;">
                <div>✋ 页面滚动和点击已禁用</div>
                <div>🗑 按 <b style="color:${COLOR_HINT_ACCENT}">Delete</b> 删除选中标注</div>
                <div>↩ 点击 <b style="color:${COLOR_HINT_ACCENT}">撤销</b> 移除最后一条</div>
            </div>
            <div style="width:0;height:0;margin:-1px auto 0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:8px solid ${COLOR_HINT_BG};"></div>
        `;
        document.body.appendChild(this.hintPanel);

        return el;
    }

    // ============================================================
    // 子组件构建
    // ============================================================

    private createDragHandle(): HTMLDivElement {
        const handle = document.createElement('div');
        handle.style.cssText = `
            display: flex; align-items: center; justify-content: center;
            padding: 0 2px; cursor: grab; color: ${COLOR_DRAG_HANDLE};
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

        btn.addEventListener(DOM_EVENT_MOUSE_ENTER, () => {
            if (this.selectedTool !== config.type) {
                btn.style.background = COLOR_HOVER_BG;
            }
        });
        btn.addEventListener(DOM_EVENT_MOUSE_LEAVE, () => {
            if (this.selectedTool !== config.type) {
                btn.style.background = 'transparent';
            }
        });

        btn.addEventListener(DOM_EVENT_CLICK, (e) => {
            e.stopPropagation();
            if (this.selectedTool === config.type) {
                this.deselectAllTools();
                this.callbacks.onToolSelect(null);
            }
            else {
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
        input.title = LABEL_PICK_COLOR;
        input.style.cssText = `
            width: ${COLOR_PICKER_SIZE}px; height: ${COLOR_PICKER_SIZE}px; border: 2px solid ${COLOR_DIVIDER}; border-radius: 6px;
            cursor: pointer; padding: 0; background: none; flex-shrink: 0;
        `;
        input.addEventListener(DOM_EVENT_INPUT, () => {
            this.selectedColor = input.value;
            this.callbacks.onColorChange(input.value);
        });
        input.addEventListener(DOM_EVENT_CLICK, e => e.stopPropagation());
        return input;
    }

    private createIconBtn(iconName: string, title: string, onClick: () => void): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.title = title;
        btn.style.cssText = this.iconBtnStyle();
        btn.appendChild(createSvg(iconName));
        btn.addEventListener(DOM_EVENT_MOUSE_ENTER, () => {
            btn.style.background = COLOR_HOVER_BG;
        });
        btn.addEventListener(DOM_EVENT_MOUSE_LEAVE, () => {
            btn.style.background = 'transparent';
        });
        btn.addEventListener(DOM_EVENT_CLICK, (e) => {
            e.stopPropagation();
            onClick();
        });
        return btn;
    }

    private createDivider(): HTMLDivElement {
        const div = document.createElement('div');
        div.style.cssText = `border-left: 1px solid ${COLOR_DIVIDER}; width: 0; height: ${DIVIDER_HEIGHT}px; margin: 0 2px;`;
        return div;
    }

    private iconBtnStyle(): string {
        return `
            display: flex; align-items: center; justify-content: center;
            width: ${ICON_BTN_SIZE}px; height: ${ICON_BTN_SIZE}px; border: 2px solid transparent;
            border-radius: ${ICON_BTN_RADIUS}px; background: transparent; cursor: pointer;
            font-size: 16px; transition: all 0.15s ease; padding: 0;
            flex-shrink: 0; color: ${COLOR_ICON_PRIMARY};
        `;
    }

    // ============================================================
    // 工具选中状态
    // ============================================================

    private selectTool(type: AnnotationToolType): void {
        this.selectedTool = type;
        this.updateToolButtonStyles();
        this.updateToolLabel();
    }

    private deselectAllTools(): void {
        this.selectedTool = null;
        this.updateToolButtonStyles();
        this.updateToolLabel();
    }

    private updateToolLabel(): void {
        if (!this.drawingBadge || !this.hintPanel || !this.container) return;
        if (!this.selectedTool) {
            this.drawingBadge.style.display = 'none';
            this.hintPanel.style.display = 'none';
            return;
        }
        this.drawingBadge.style.display = 'inline-flex';

        // 鼠标悬浮到 badge 上才显示提示面板
        this.drawingBadge.onmouseenter = () => {
            const badgeRect = this.drawingBadge!.getBoundingClientRect();
            this.hintPanel!.style.display = 'flex';
            this.hintPanel!.style.bottom = `${window.innerHeight - badgeRect.top + DRAG_MARGIN}px`;
            this.hintPanel!.style.left = `${badgeRect.left + badgeRect.width / 2}px`;
            this.hintPanel!.style.transform = 'translateX(-50%)';
            this.hintPanel!.style.top = 'auto';
        };
        this.drawingBadge.onmouseleave = () => {
            this.hintPanel!.style.display = 'none';
        };
    }

    private updateToolButtonStyles(): void {
        for (const [type, btn] of this.toolButtons) {
            if (type === this.selectedTool) {
                btn.style.borderColor = this.selectedColor;
                btn.style.background = `${this.selectedColor}18`;
            }
            else {
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
        this.timerInterval = setInterval(update, TIMER_INTERVAL);
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
        // 锁定宽度防止 flex 换行，但不锁高度避免 flex 布局异常
        this.container.style.width = `${r.width}px`;
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
        newLeft = Math.max(DRAG_MARGIN, Math.min(newLeft, maxLeft));
        newTop = Math.max(DRAG_MARGIN, Math.min(newTop, maxTop));

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
        document.removeEventListener(DOM_EVENT_MOUSE_MOVE, this.onDragMove);
        document.removeEventListener(DOM_EVENT_MOUSE_UP, this.onDragEnd);
        this.hide();
    }
}
