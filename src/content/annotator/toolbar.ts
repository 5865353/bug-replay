/**
 * src/content/annotator/toolbar.ts
 *
 * 悬浮工具栏 UI 组件
 * - 位置：页面右侧悬浮，可拖拽移动
 * - 按钮：矩形 / 箭头 / 文本 / 画笔 / 撤销 / 清除
 * - 颜色选择器
 */

import type { AnnotationToolType } from '@shared/types';
import { ANNOTATION_COLORS } from '@shared/types';

export interface ToolbarCallbacks {
    onToolSelect: (tool: AnnotationToolType | null) => void;
    onColorChange: (color: string) => void;
    onUndo: () => void;
    onClearAll: () => void;
}

interface ToolButtonConfig {
    type: AnnotationToolType;
    icon: string;
    label: string;
}

const TOOL_BUTTONS: ToolButtonConfig[] = [
    { type: 'rect', icon: '⬜', label: '矩形框选' },
    { type: 'arrow', icon: '➡️', label: '箭头指向' },
    { type: 'text', icon: '📝', label: '文本批注' },
    { type: 'freehand', icon: '✏️', label: '自由画笔' },
];

export class Toolbar {
    private container: HTMLDivElement | null = null;
    private callbacks: ToolbarCallbacks;
    private selectedTool: AnnotationToolType | null = null;
    private selectedColor = ANNOTATION_COLORS[0];
    private isDragging = false;
    private dragStartX = 0;
    private dragStartY = 0;
    private toolbarX = 0;
    private toolbarY = 0;

    constructor(callbacks: ToolbarCallbacks) {
        this.callbacks = callbacks;
    }

    /**
     * 创建并显示工具栏
     */
    show(): void {
        if (this.container) return;
        this.container = this.buildToolbar();
        document.body.appendChild(this.container);
    }

    /**
     * 隐藏并销毁工具栏
     */
    hide(): void {
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }

    /**
     * 获取当前选中的颜色
     */
    get currentColor(): string {
        return this.selectedColor;
    }

    /**
     * 构建工具栏 DOM
     */
    private buildToolbar(): HTMLDivElement {
        const el = document.createElement('div');
        el.id = 'bugreplay-annotator-toolbar';
        el.style.cssText = `
            position: fixed;
            top: 80px;
            right: 16px;
            z-index: 2147483647;
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.15);
            padding: 8px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            font-family: system-ui, sans-serif;
            user-select: none;
            width: 52px;
            cursor: grab;
        `;

        // ---- 拖拽手柄 ----
        const handle = document.createElement('div');
        handle.style.cssText = `
            display: flex;
            justify-content: center;
            padding: 4px 0 6px 0;
            border-bottom: 1px solid #e5e7eb;
            margin-bottom: 4px;
            cursor: grab;
        `;
        handle.innerHTML = '<span style="color:#9ca3af;font-size:12px;letter-spacing:2px;">⋮⋮</span>';
        el.appendChild(handle);

        // ---- 工具按钮 ----
        for (const btn of TOOL_BUTTONS) {
            const toolBtn = this.createToolButton(btn);
            el.appendChild(toolBtn);
        }

        // ---- 分隔线 ----
        const divider = document.createElement('div');
        divider.style.cssText = `
            border-top: 1px solid #e5e7eb;
            margin: 4px 0;
        `;
        el.appendChild(divider);

        // ---- 颜色选择器 ----
        const colorPicker = this.createColorPicker();
        el.appendChild(colorPicker);

        // ---- 分隔线 ----
        const divider2 = document.createElement('div');
        divider2.style.cssText = `
            border-top: 1px solid #e5e7eb;
            margin: 4px 0;
        `;
        el.appendChild(divider2);

        // ---- 操作按钮 ----
        const undoBtn = this.createActionButton('↩', '撤销', () => this.callbacks.onUndo());
        el.appendChild(undoBtn);

        const clearBtn = this.createActionButton('🗑', '清除全部', () => this.callbacks.onClearAll());
        el.appendChild(clearBtn);

        // ---- 拖拽事件 ----
        handle.addEventListener('mousedown', this.onDragStart.bind(this));
        document.addEventListener('mousemove', this.onDragMove.bind(this));
        document.addEventListener('mouseup', this.onDragEnd.bind(this));

        return el;
    }

    /**
     * 创建工具按钮
     */
    private createToolButton(config: ToolButtonConfig): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.title = config.label;
        btn.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border: 2px solid transparent;
            border-radius: 8px;
            background: transparent;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.15s ease;
            padding: 0;
            margin: 0 auto;
        `;

        btn.textContent = config.icon;

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
                // 再次点击取消选择
                this.deselectAllTools();
                this.callbacks.onToolSelect(null);
            } else {
                this.selectTool(config.type);
                this.callbacks.onToolSelect(config.type);
            }
        });

        return btn;
    }

    /**
     * 创建颜色选择器
     */
    private createColorPicker(): HTMLDivElement {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 4px;
            align-items: center;
        `;

        for (const color of ANNOTATION_COLORS) {
            const dot = document.createElement('button');
            dot.style.cssText = `
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: ${color};
                border: 2px solid ${this.selectedColor === color ? '#1f2937' : 'transparent'};
                cursor: pointer;
                padding: 0;
                transition: border-color 0.15s ease;
                flex-shrink: 0;
            `;
            dot.title = color;
            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectedColor = color;
                this.callbacks.onColorChange(color);
                // 更新所有颜色按钮边框
                const allDots = container.querySelectorAll('button');
                allDots.forEach((d) => {
                    d.style.borderColor = 'transparent';
                });
                dot.style.borderColor = '#1f2937';
            });
            container.appendChild(dot);
        }

        return container;
    }

    /**
     * 创建操作按钮
     */
    private createActionButton(
        icon: string,
        label: string,
        onClick: () => void,
    ): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.title = label;
        btn.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border: none;
            border-radius: 8px;
            background: transparent;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.15s ease;
            margin: 0 auto;
        `;
        btn.textContent = icon;

        btn.addEventListener('mouseenter', () => {
            btn.style.background = '#f3f4f6';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'transparent';
        });
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            onClick();
        });

        return btn;
    }

    /**
     * 选中工具（高亮按钮）
     */
    private selectTool(type: AnnotationToolType): void {
        this.selectedTool = type;
        this.updateToolButtonStyles();
    }

    /**
     * 取消所有工具选中状态
     */
    private deselectAllTools(): void {
        this.selectedTool = null;
        this.updateToolButtonStyles();
    }

    /**
     * 更新工具按钮样式
     */
    private updateToolButtonStyles(): void {
        if (!this.container) return;
        const buttons = this.container.querySelectorAll('button');
        // 跳过颜色按钮和操作按钮，只更新工具按钮
        let toolBtnIndex = 0;
        for (const btn of buttons) {
            const title = btn.title;
            if (TOOL_BUTTONS.some(t => t.label === title)) {
                if (TOOL_BUTTONS[toolBtnIndex]?.type === this.selectedTool) {
                    btn.style.borderColor = this.selectedColor;
                    btn.style.background = `${this.selectedColor}15`;
                } else {
                    btn.style.borderColor = 'transparent';
                    btn.style.background = 'transparent';
                }
                toolBtnIndex++;
            }
        }
    }

    // ============================================================
    // 拖拽逻辑
    // ============================================================

    private onDragStart(e: MouseEvent): void {
        if (!this.container) return;
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        const rect = this.container.getBoundingClientRect();
        this.toolbarX = rect.left;
        this.toolbarY = rect.top;
        this.container.style.cursor = 'grabbing';
        e.preventDefault();
    }

    private onDragMove(e: MouseEvent): void {
        if (!this.isDragging || !this.container) return;
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        this.container.style.right = 'auto';
        this.container.style.top = `${Math.max(0, this.toolbarY + dy)}px`;
        this.container.style.left = `${Math.max(0, this.toolbarX + dx)}px`;
    }

    private onDragEnd(): void {
        if (!this.isDragging || !this.container) return;
        this.isDragging = false;
        this.container.style.cursor = 'grab';
    }
}
