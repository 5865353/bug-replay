/**
 * src/replayer/composables/annotation-overlay.ts — 回放标注图层 (Fabric.js)
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

    getWrapper(): HTMLDivElement | null { return this.wrapperEl; }

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

    private handleResize = (): void => {
        if (!this.canvas || !this.container) return;
        this.canvas.setWidth(this.container.clientWidth);
        this.canvas.setHeight(this.container.clientHeight);
        this.canvas.requestRenderAll();
    };

    private renderAnnotation(ann: Annotation): void {
        let obj = null;
        switch (ann.type) {
            case 'rect':
                obj = new Rect({
                    left: ann.data.x,
                    top: ann.data.y,
                    width: ann.data.width,
                    height: ann.data.height,
                    fill: ann.data.fillColor || `${ann.data.strokeColor}20`,
                    stroke: ann.data.strokeColor,
                    strokeWidth: ann.data.strokeWidth,
                    rx: 4,
                    ry: 4,
                    selectable: false,
                    evented: false,
                });
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
                ], { fill: color, stroke: color, strokeWidth: 2, selectable: false, evented: false });
                this.canvas!.add(tri);
                break;
            }
            case 'text':
                obj = new Text(ann.data.text || '', {
                    left: ann.data.x,
                    top: ann.data.y,
                    fontSize: ann.data.fontSize,
                    fontFamily: 'system-ui, sans-serif',
                    fill: ann.data.color,
                    backgroundColor: `${ann.data.color}15`,
                    padding: 4,
                    selectable: false,
                    evented: false,
                });
                break;
            case 'freehand': {
                const path = new Path(
                    ann.data.points.reduce((acc: string, p: { x: number; y: number }, i: number) =>
                        acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`), ''),
                    {
                        stroke: ann.data.color,
                        strokeWidth: ann.data.lineWidth || 2,
                        fill: '',
                        selectable: false,
                        evented: false,
                    },
                );
                this.canvas!.add(path);
                break;
            }
        }
        if (obj) this.canvas!.add(obj);
    }
}
