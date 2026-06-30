/**
 * src/content/annotator/tools/text-tool.ts — 文本批注工具
 *
 * 交互：鼠标点击放置 → 弹出输入框 → 确认后放置文本标注
 */

import type { TextAnnotation } from '@shared/types';
import { BaseTool } from './base-tool';

export class TextTool extends BaseTool {
    private inputEl: HTMLDivElement | null = null;

    activate(): void {
        this.isActive = true;
        const canvas = this.canvasLayer.getCanvas();
        if (!canvas) return;

        this.boundMouseDown = this.onMouseDown.bind(this);
        canvas.addEventListener('mousedown', this.boundMouseDown);
        canvas.style.cursor = 'text';
    }

    deactivate(): void {
        this.removeInput();
        const canvas = this.canvasLayer.getCanvas();
        if (canvas) {
            canvas.style.cursor = 'crosshair';
        }
        super.deactivate();
    }

    private onMouseDown(e: MouseEvent): void {
        if (e.button !== 0) return;
        // 如果已有输入框在显示，先提交
        if (this.inputEl) {
            this.commitText();
            return;
        }

        const { x, y } = this.getCanvasCoords(e);
        this.showInput(x, y);
    }

    /**
     * 在指定位置显示文本输入框
     */
    private showInput(x: number, y: number): void {
        this.removeInput();

        const container = document.createElement('div');
        container.className = 'bugreplay-text-input-container';
        container.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y - 12}px;
            z-index: 2147483647;
            background: white;
            border: 2px solid ${this.color};
            border-radius: 4px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.15);
            min-width: 120px;
            font-family: system-ui, sans-serif;
        `;

        const input = document.createElement('textarea');
        input.style.cssText = `
            border: none;
            outline: none;
            padding: 6px 10px;
            font-size: 14px;
            font-family: inherit;
            resize: both;
            min-width: 120px;
            min-height: 32px;
            color: #1f2937;
            background: transparent;
            border-radius: 4px;
        `;
        input.placeholder = '输入批注...';
        input.rows = 2;

        const toolbar = document.createElement('div');
        toolbar.style.cssText = `
            display: flex;
            gap: 4px;
            padding: 4px 6px;
            border-top: 1px solid #e5e7eb;
            background: #f9fafb;
            border-radius: 0 0 4px 4px;
        `;

        const btnConfirm = document.createElement('button');
        btnConfirm.textContent = '✓';
        btnConfirm.style.cssText = `
            border: none;
            background: ${this.color};
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        btnConfirm.addEventListener('mousedown', (ev) => {
            ev.stopPropagation();
            ev.preventDefault();
        });
        btnConfirm.addEventListener('click', (ev) => {
            ev.stopPropagation();
            this.commitText();
        });

        const btnCancel = document.createElement('button');
        btnCancel.textContent = '✕';
        btnCancel.style.cssText = `
            border: none;
            background: #e5e7eb;
            color: #6b7280;
            width: 24px;
            height: 24px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        btnCancel.addEventListener('mousedown', (ev) => {
            ev.stopPropagation();
            ev.preventDefault();
        });
        btnCancel.addEventListener('click', (ev) => {
            ev.stopPropagation();
            this.removeInput();
        });

        toolbar.appendChild(btnConfirm);
        toolbar.appendChild(btnCancel);
        container.appendChild(input);
        container.appendChild(toolbar);

        document.body.appendChild(container);
        input.focus();

        // 回车提交（Shift+Enter 换行）
        input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' && !ev.shiftKey) {
                ev.preventDefault();
                this.commitText();
            }
            if (ev.key === 'Escape') {
                this.removeInput();
            }
        });

        this.inputEl = container;
    }

    /**
     * 提交文本，创建标注
     */
    private commitText(): void {
        if (!this.inputEl) return;

        const textarea = this.inputEl.querySelector('textarea');
        const text = textarea?.value?.trim();

        if (text) {
            const rect = this.inputEl.getBoundingClientRect();
            const annotation: TextAnnotation = {
                id: this.generateId(),
                type: 'text',
                timestamp: Date.now(),
                sessionId: this.sessionId,
                data: {
                    x: rect.left,
                    y: rect.top,
                    text,
                    fontSize: 14,
                    fontFamily: 'system-ui, sans-serif',
                    color: '#1f2937',
                    backgroundColor: '#ffffff',
                },
            };

            this.onComplete(annotation);
            // 在 canvas 上绘制文本标记点
            const ctx = this.canvasLayer.getContext();
            if (ctx) {
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(rect.left + 8, rect.top + 16, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        this.removeInput();
    }

    /**
     * 移除文本输入框
     */
    private removeInput(): void {
        if (this.inputEl) {
            this.inputEl.remove();
            this.inputEl = null;
        }
    }
}
