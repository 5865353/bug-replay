/**
 * src/replayer/annotation-overlay.ts — 回放标注图层
 *
 * 在回放时根据时间轴精准叠加显示标注
 * - 使用 Canvas 在回放视图上叠加渲染
 * - 根据 timestamp 在对应时间点渐显
 * - 开关按钮控制显示/隐藏
 */

import type { Annotation } from '@shared/types';

export class AnnotationOverlay {
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private visible = true;
    private annotations: Annotation[] = [];
    private shownAnnotations = new Set<string>();
    private container: HTMLElement | null = null;

    /**
     * 初始化覆盖层（挂载到指定容器）
     */
    init(container: HTMLElement, annotations: Annotation[]): void {
        this.container = container;
        this.annotations = annotations;
        this.shownAnnotations.clear();

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'bugreplay-annotation-overlay';
        this.canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 10;
        `;

        container.style.position = 'relative';
        container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this.resize();
        window.addEventListener('resize', this.resize.bind(this));
    }

    /**
     * 根据当前回放时间更新标注显示
     */
    updateTime(currentTime: number): void {
        if (!this.visible || !this.ctx || !this.canvas) return;

        const ctx = this.ctx;
        const canvas = this.canvas;

        // 找出当前时间应该显示的标注
        const activeAnnotations = this.annotations.filter(
            a => a.timestamp <= currentTime,
        );

        // 检查是否有新增的标注
        const newIds = activeAnnotations.map(a => a.id);
        const hasNew = newIds.some(id => !this.shownAnnotations.has(id));

        if (hasNew) {
            this.shownAnnotations = new Set(newIds);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            this.renderAnnotations(ctx, activeAnnotations);
        }
    }

    /**
     * 切换显示/隐藏
     */
    toggle(): boolean {
        this.visible = !this.visible;
        if (this.canvas) {
            this.canvas.style.display = this.visible ? 'block' : 'none';
        }
        return this.visible;
    }

    /**
     * 切换显示/隐藏
     */
    setVisible(visible: boolean): void {
        this.visible = visible;
        if (this.canvas) {
            this.canvas.style.display = visible ? 'block' : 'none';
        }
    }

    /**
     * 销毁
     */
    destroy(): void {
        if (this.canvas) {
            this.canvas.remove();
            this.canvas = null;
            this.ctx = null;
        }
        window.removeEventListener('resize', this.resize.bind(this));
    }

    // ---- 渲染 ----

    private renderAnnotations(
        ctx: CanvasRenderingContext2D,
        annotations: Annotation[],
    ): void {
        for (const annotation of annotations) {
            this.drawAnnotation(ctx, annotation);

            // 绘制步骤编号
            if (annotation.stepNumber) {
                this.drawStepNumber(ctx, annotation);
            }
        }
    }

    private drawAnnotation(
        ctx: CanvasRenderingContext2D,
        annotation: Annotation,
    ): void {
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
                const { x, y, text, fontSize, fontFamily, color, backgroundColor } = annotation.data;
                const padding = 4;
                ctx.font = `${fontSize}px ${fontFamily}`;
                const metrics = ctx.measureText(text);

                if (backgroundColor) {
                    ctx.fillStyle = backgroundColor;
                    ctx.fillRect(
                        x - padding,
                        y - fontSize - padding,
                        metrics.width + padding * 2,
                        fontSize + padding * 2,
                    );
                }

                ctx.fillStyle = color;
                ctx.fillText(text, x, y);
                break;
            }
        }
    }

    private drawStepNumber(
        ctx: CanvasRenderingContext2D,
        annotation: Annotation,
    ): void {
        const { x, y } = this.getAnnotationPosition(annotation);
        const stepText = `Step ${annotation.stepNumber}`;
        const fontSize = 12;
        ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
        const metrics = ctx.measureText(stepText);
        const padding = 4;
        const badgeWidth = metrics.width + padding * 2;
        const badgeHeight = fontSize + padding * 2;

        // 在标注位置附近绘制步骤编号徽章
        const badgeX = x;
        const badgeY = y - badgeHeight - 4;

        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        this.roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillText(stepText, badgeX + padding, badgeY + fontSize + 1);
    }

    private getAnnotationPosition(annotation: Annotation): { x: number; y: number } {
        switch (annotation.type) {
            case 'rect':
                return { x: annotation.data.x, y: annotation.data.y };
            case 'arrow':
                return { x: annotation.data.endX, y: annotation.data.endY };
            case 'freehand':
                return annotation.data.points[0] || { x: 0, y: 0 };
            case 'text':
                return { x: annotation.data.x, y: annotation.data.y };
        }
    }

    private resize(): void {
        if (!this.canvas || !this.container) return;
        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;

        // 重新绘制
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            const activeAnnotations = this.annotations.filter(
                a => this.shownAnnotations.has(a.id),
            );
            this.renderAnnotations(this.ctx, activeAnnotations);
        }
    }

    /**
     * 绘制圆角矩形（兼容旧浏览器）
     */
    private roundRect(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        r: number,
    ): void {
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
    }
}
