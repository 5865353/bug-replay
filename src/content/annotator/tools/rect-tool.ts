/**
 * src/content/annotator/tools/rect-tool.ts — 矩形框选工具
 *
 * 交互：鼠标按下 → 拖拽 → 释放，绘制矩形选择框
 */

import type { RectAnnotation } from '@shared/types';
import { BaseTool } from './base-tool';

export class RectTool extends BaseTool {
    private startX = 0;
    private startY = 0;
    private isDrawing = false;

    activate(): void {
        this.isActive = true;
        const canvas = this.canvasLayer.getCanvas();
        if (!canvas) return;

        this.boundMouseDown = this.onMouseDown.bind(this);
        this.boundMouseMove = this.onMouseMove.bind(this);
        this.boundMouseUp = this.onMouseUp.bind(this);
        this.boundKeyDown = this.onKeyDown.bind(this);

        canvas.addEventListener('mousedown', this.boundMouseDown);
        canvas.addEventListener('mousemove', this.boundMouseMove);
        canvas.addEventListener('mouseup', this.boundMouseUp);
        document.addEventListener('keydown', this.boundKeyDown);
    }

    private onMouseDown(e: MouseEvent): void {
        if (e.button !== 0) return;
        const { x, y } = this.getCanvasCoords(e);
        this.startX = x;
        this.startY = y;
        this.isDrawing = true;
    }

    private onMouseMove(e: MouseEvent): void {
        if (!this.isDrawing) return;
        const { x, y } = this.getCanvasCoords(e);
        const ctx = this.canvasLayer.getContext();
        if (!ctx) return;

        this.canvasLayer.clear();
        this.canvasLayer.restoreSnapshot();

        const width = x - this.startX;
        const height = y - this.startY;

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(this.startX, this.startY, width, height);
        ctx.setLineDash([]);

        // 半透明填充
        ctx.fillStyle = `${this.color}20`;
        ctx.fillRect(this.startX, this.startY, width, height);
    }

    private onMouseUp(e: MouseEvent): void {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        const { x, y } = this.getCanvasCoords(e);
        const width = Math.abs(x - this.startX);
        const height = Math.abs(y - this.startY);

        // 忽略过小的选区（可能是误点击）
        if (width < 5 || height < 5) {
            this.canvasLayer.clear();
            this.canvasLayer.restoreSnapshot();
            return;
        }

        const annotation: RectAnnotation = {
            id: this.generateId(),
            type: 'rect',
            timestamp: Date.now(),
            sessionId: this.sessionId,
            data: {
                x: Math.min(this.startX, x),
                y: Math.min(this.startY, y),
                width,
                height,
                strokeColor: this.color,
                strokeWidth: 2,
                fillColor: `${this.color}20`,
            },
        };

        this.onComplete(annotation);
        this.canvasLayer.drawAnnotation(annotation);
    }

    private onKeyDown(e: KeyboardEvent): void {
        if (e.key === 'Escape' && this.isDrawing) {
            this.isDrawing = false;
            this.canvasLayer.clear();
            this.canvasLayer.restoreSnapshot();
        }
    }
}
