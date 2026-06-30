/**
 * src/content/annotator/tools/arrow-tool.ts — 箭头指向工具
 *
 * 交互：鼠标按下（起点）→ 拖拽 → 释放（终点），绘制带箭头的线段
 */

import type { ArrowAnnotation } from '@shared/types';
import { BaseTool } from './base-tool';

export class ArrowTool extends BaseTool {
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

        this.drawArrow(ctx, this.startX, this.startY, x, y);
    }

    private onMouseUp(e: MouseEvent): void {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        const { x, y } = this.getCanvasCoords(e);
        const dx = x - this.startX;
        const dy = y - this.startY;

        // 忽略过短的箭头
        if (Math.sqrt(dx * dx + dy * dy) < 10) {
            this.canvasLayer.clear();
            this.canvasLayer.restoreSnapshot();
            return;
        }

        const annotation: ArrowAnnotation = {
            id: this.generateId(),
            type: 'arrow',
            timestamp: Date.now(),
            sessionId: this.sessionId,
            data: {
                startX: this.startX,
                startY: this.startY,
                endX: x,
                endY: y,
                color: this.color,
                lineWidth: 2,
            },
        };

        this.onComplete(annotation);
        this.canvasLayer.drawAnnotation(annotation);
    }

    /**
     * 绘制带箭头的线段
     */
    private drawArrow(
        ctx: CanvasRenderingContext2D,
        fromX: number,
        fromY: number,
        toX: number,
        toY: number,
    ): void {
        const headLength = 12;
        const angle = Math.atan2(toY - fromY, toX - fromX);

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();

        // 箭头头部
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(
            toX - headLength * Math.cos(angle - Math.PI / 6),
            toY - headLength * Math.sin(angle - Math.PI / 6),
        );
        ctx.moveTo(toX, toY);
        ctx.lineTo(
            toX - headLength * Math.cos(angle + Math.PI / 6),
            toY - headLength * Math.sin(angle + Math.PI / 6),
        );
        ctx.stroke();
    }

    private onKeyDown(e: KeyboardEvent): void {
        if (e.key === 'Escape' && this.isDrawing) {
            this.isDrawing = false;
            this.canvasLayer.clear();
            this.canvasLayer.restoreSnapshot();
        }
    }
}
