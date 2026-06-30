/**
 * src/content/annotator/tools/freehand-tool.ts — 自由画笔工具
 *
 * 交互：鼠标按住 → 拖拽 → 释放，跟随鼠标轨迹绘制自由线条
 */

import type { FreehandAnnotation } from '@shared/types';
import { BaseTool } from './base-tool';

export class FreehandTool extends BaseTool {
    private points: Array<{ x: number; y: number }> = [];
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
        this.points = [{ x, y }];
        this.isDrawing = true;
    }

    private onMouseMove(e: MouseEvent): void {
        if (!this.isDrawing) return;
        const { x, y } = this.getCanvasCoords(e);
        this.points.push({ x, y });

        const ctx = this.canvasLayer.getContext();
        if (!ctx) return;

        // 实时绘制当前笔画
        this.canvasLayer.clear();
        this.canvasLayer.restoreSnapshot();

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        ctx.stroke();
    }

    private onMouseUp(_e: MouseEvent): void {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        // 忽略过短的笔画
        if (this.points.length < 2) {
            this.points = [];
            this.canvasLayer.clear();
            this.canvasLayer.restoreSnapshot();
            return;
        }

        const annotation: FreehandAnnotation = {
            id: this.generateId(),
            type: 'freehand',
            timestamp: Date.now(),
            sessionId: this.sessionId,
            data: {
                points: [...this.points],
                color: this.color,
                lineWidth: 2,
            },
        };

        this.points = [];
        this.onComplete(annotation);
        this.canvasLayer.drawAnnotation(annotation);
    }

    private onKeyDown(e: KeyboardEvent): void {
        if (e.key === 'Escape' && this.isDrawing) {
            this.isDrawing = false;
            this.points = [];
            this.canvasLayer.clear();
            this.canvasLayer.restoreSnapshot();
        }
    }
}
