/**
 * src/content/annotator/canvas-layer.ts
 *
 * Canvas 覆盖层 — 在页面上覆盖全屏透明 Canvas，用于渲染标注和接收绘图事件
 */

import type { Annotation } from '@shared/types';

export class CanvasLayer {
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    /** 已确认标注的快照（用于撤销/恢复） */
    private snapshot: ImageData | null = null;

    /**
     * 创建覆盖层 Canvas
     */
    show(): void {
        if (this.canvas) return;

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'bugreplay-canvas-layer';
        this.canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 2147483646;
      pointer-events: auto;
      cursor: crosshair;
    `;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        this.ctx = this.canvas.getContext('2d');
        document.body.appendChild(this.canvas);

        // 监听视口变化，同步更新 canvas 尺寸
        window.addEventListener('resize', this.handleResize);
    }

    /**
     * 销毁覆盖层 Canvas
     */
    hide(): void {
        if (this.canvas) {
            this.canvas.remove();
            this.canvas = null;
            this.ctx = null;
            this.snapshot = null;
            window.removeEventListener('resize', this.handleResize);
        }
    }

    /**
     * 清空 Canvas
     */
    clear(): void {
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    /**
     * 获取 Canvas 元素（工具需要绑定事件）
     */
    getCanvas(): HTMLCanvasElement | null {
        return this.canvas;
    }

    /**
     * 获取 Canvas 上下文（供工具使用）
     */
    getContext(): CanvasRenderingContext2D | null {
        return this.ctx;
    }

    /**
     * 保存当前 Canvas 状态为快照
     */
    saveSnapshot(): void {
        if (this.ctx && this.canvas) {
            this.snapshot = this.ctx.getImageData(
                0, 0,
                this.canvas.width,
                this.canvas.height,
            );
        }
    }

    /**
     * 恢复到上次快照状态
     */
    restoreSnapshot(): void {
        if (this.ctx && this.snapshot) {
            this.ctx.putImageData(this.snapshot, 0, 0);
        }
    }

    /**
     * 在 Canvas 上绘制标注
     */
    drawAnnotation(annotation: Annotation): void {
        const ctx = this.ctx;
        if (!ctx) return;

        switch (annotation.type) {
            case 'rect': {
                const { x, y, width, height, strokeColor, strokeWidth, fillColor } = annotation.data;
                if (fillColor) {
                    ctx.fillStyle = fillColor;
                    ctx.fillRect(x, y, width, height);
                }
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = strokeWidth;
                ctx.setLineDash([]);
                ctx.strokeRect(x, y, width, height);
                break;
            }
            case 'arrow': {
                const { startX, startY, endX, endY, color, lineWidth } = annotation.data;
                const headLength = 12;
                const angle = Math.atan2(endY - startY, endX - startX);

                ctx.strokeStyle = color;
                ctx.lineWidth = lineWidth;
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();

                // 箭头头部
                ctx.beginPath();
                ctx.moveTo(endX, endY);
                ctx.lineTo(
                    endX - headLength * Math.cos(angle - Math.PI / 6),
                    endY - headLength * Math.sin(angle - Math.PI / 6),
                );
                ctx.moveTo(endX, endY);
                ctx.lineTo(
                    endX - headLength * Math.cos(angle + Math.PI / 6),
                    endY - headLength * Math.sin(angle + Math.PI / 6),
                );
                ctx.stroke();
                break;
            }
            case 'freehand': {
                const { points, color, lineWidth } = annotation.data;
                if (points.length < 2) return;
                ctx.strokeStyle = color;
                ctx.lineWidth = lineWidth;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
                ctx.stroke();
                break;
            }
            case 'text': {
                // 文本不在此绘制（已在 DOM 层显示标注编号标记点）
                const { x, y, color } = annotation.data;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x + 8, y + 16, 5, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
        }

        // 绘制完成后保存快照
        this.saveSnapshot();
    }

    /**
     * 根据标注列表重新绘制所有标注
     */
    redrawAll(annotations: Annotation[]): void {
        this.clear();
        this.snapshot = null;
        for (const annotation of annotations) {
            this.drawAnnotation(annotation);
        }
    }

    /**
     * 视口变化时更新 Canvas 尺寸
     */
    private handleResize = (): void => {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    };
}
