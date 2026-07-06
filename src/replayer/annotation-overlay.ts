/**
 * src/replayer/annotation-overlay.ts — 回放标注图层 (Fabric.js)
 *
 * 使用 Fabric.Canvas 静态渲染标注，无交互
 * 根据 timestamp 在对应时间点渐显
 */

import type { Annotation } from '@shared/types';
import { Canvas, classRegistry, IText, Line, Path, Polygon, Rect, Text } from 'fabric';

classRegistry.setClass(Rect, 'Rect');
classRegistry.setClass(Line, 'Line');
classRegistry.setClass(IText, 'IText');
classRegistry.setClass(Polygon, 'Polygon');

export class AnnotationOverlay {
    private canvas: Canvas | null = null;
    private wrapperEl: HTMLDivElement | null = null;
    private visible = true;
    private annotations: Annotation[] = [];
    private container: HTMLElement | null = null;
    private lastShownCount = 0;

    init(container: HTMLElement, annotations: Annotation[]): void {
        this.container = container;
        this.annotations = annotations;

        this.wrapperEl = document.createElement('div');
        this.wrapperEl.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;background:transparent;';
        container.style.position = 'relative';
        container.appendChild(this.wrapperEl);

        const canvasEl = document.createElement('canvas');
        this.wrapperEl.appendChild(canvasEl);

        this.canvas = new Canvas(canvasEl, {
            width: container.clientWidth || 1280,
            height: container.clientHeight || 720,
            selection: false,
            renderOnAddRemove: true,
            backgroundColor: 'transparent',
        });

        console.log(
            `[BugReplay] AnnotationOverlay init: ${annotations.length} annotations, `
            + `container=${container.clientWidth}x${container.clientHeight}`,
        );

        window.addEventListener('resize', this.handleResize);
    }

    updateTime(currentTime: number): void {
        if (!this.visible || !this.canvas) return;
        const active = this.annotations.filter(a => a.timestamp <= currentTime);
        if (active.length === this.lastShownCount) return;
        this.lastShownCount = active.length;

        this.canvas.clear();
        for (const ann of active) this.renderAnnotation(ann);
        this.canvas.requestRenderAll();
    }

    toggle(): boolean {
        this.visible = !this.visible;
        if (this.wrapperEl) this.wrapperEl.style.display = this.visible ? 'block' : 'none';
        return this.visible;
    }

    setVisible(v: boolean): void {
        this.visible = v;
        if (this.wrapperEl) this.wrapperEl.style.display = v ? 'block' : 'none';
    }

    /** 获取 wrapper 元素（供外部缩放同步） */
    getWrapper(): HTMLDivElement | null { return this.wrapperEl; }

    /** 调整 canvas 尺寸（供外部缩放同步调用） */
    resize(w: number, h: number): void {
        if (!this.canvas) return;
        this.canvas.setWidth(w);
        this.canvas.setHeight(h);
        this.canvas.requestRenderAll();
    }

    destroy(): void {
        window.removeEventListener('resize', this.handleResize);
        this.canvas?.dispose();
        this.canvas = null;
        this.wrapperEl?.remove();
        this.wrapperEl = null;
    }

    private renderAnnotation(ann: Annotation): void {
        let obj = null;
        switch (ann.type) {
            case 'rect':
                obj = new Rect({ left: ann.data.x, top: ann.data.y, width: ann.data.width, height: ann.data.height, fill: ann.data.fillColor || `${ann.data.strokeColor}20`, stroke: ann.data.strokeColor, strokeWidth: ann.data.strokeWidth, rx: 4, ry: 4, selectable: false, evented: false });
                break;
            case 'arrow': {
                const { startX, startY, endX, endY, color, lineWidth } = ann.data;
                const line = new Line([startX, startY, endX, endY], {
                    stroke: color,
                    strokeWidth: lineWidth,
                    selectable: false,
                    evented: false,
                });
                this.canvas!.add(line);
                const angle = Math.atan2(endY - startY, endX - startX);
                const h = 14;
                const tri = new Polygon([
                    { x: endX, y: endY },
                    { x: endX - h * Math.cos(angle - Math.PI / 6), y: endY - h * Math.sin(angle - Math.PI / 6) },
                    { x: endX - h * Math.cos(angle + Math.PI / 6), y: endY - h * Math.sin(angle + Math.PI / 6) },
                ], {
                    fill: color,
                    stroke: color,
                    strokeWidth: 2,
                    selectable: false,
                    evented: false,
                });
                this.canvas!.add(tri);
                if (ann.stepNumber) this.addStepBadge(ann);
                return;
            }
            case 'text':
                obj = new IText(ann.data.text, { left: ann.data.x, top: ann.data.y, fontSize: ann.data.fontSize, fontFamily: ann.data.fontFamily, fill: ann.data.color, backgroundColor: ann.data.backgroundColor || `${ann.data.color}15`, padding: 6, selectable: false, evented: false, editable: false });
                break;
            case 'freehand': {
                const { points, color, lineWidth } = ann.data;
                if (points.length === 0) break;
                const d = points.map((p, i) => {
                    const rx = p.x - points[0].x;
                    const ry = p.y - points[0].y;
                    return i === 0 ? `M ${rx} ${ry}` : `L ${rx} ${ry}`;
                }).join(' ');
                obj = new Path(d, { left: points[0].x, top: points[0].y, stroke: color, strokeWidth: lineWidth, fill: '', selectable: false, evented: false });
                break;
            }
        }
        if (obj) {
            this.canvas!.add(obj);
            if (ann.stepNumber) {
                this.addStepBadge(ann);
            }
        }
    }

    private addStepBadge(ann: Annotation): void {
        const pos = this.getAnnotationPos(ann);
        const badge = new Text(`Step ${ann.stepNumber}`, {
            left: pos.x,
            top: pos.y - 22,
            fontSize: 11,
            fontFamily: 'system-ui, sans-serif',
            fontWeight: 'bold',
            fill: '#ffffff',
            backgroundColor: '#1f2937',
            padding: 3,
            selectable: false,
            evented: false,
        });
        this.canvas!.add(badge);
    }

    private getAnnotationPos(ann: Annotation): { x: number; y: number } {
        switch (ann.type) {
            case 'rect': return { x: ann.data.x, y: ann.data.y };
            case 'arrow': return { x: ann.data.endX, y: ann.data.endY };
            case 'freehand': return ann.data.points[0] || { x: 0, y: 0 };
            case 'text': return { x: ann.data.x, y: ann.data.y };
        }
    }

    private handleResize = (): void => {
        // 缩放由 syncContentScale 统一管理，这里不再干预
    };
}
