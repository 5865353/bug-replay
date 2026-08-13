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
    private renderedIds = new Set<string>();
    private animFrameId: number | null = null;
    private mouseTrail: Path | null = null;

    /** 渐显动画时长 (ms) */
    private static readonly FADE_DURATION = 350;
    /** 鼠标轨迹保留时长 (ms) */
    private static readonly TRAIL_DURATION = 500;

    init(container: HTMLElement, annotations: Annotation[]): void {
        this.container = container;
        this.annotations = annotations;

        const cw = container.clientWidth || 1280;
        const ch = container.clientHeight || 720;

        this.wrapperEl = document.createElement('div');
        this.wrapperEl.style.cssText = `position:absolute;top:0;left:0;width:${cw}px;height:${ch}px;pointer-events:none;z-index:10;`;
        container.style.position = 'relative';
        container.appendChild(this.wrapperEl);

        const canvasEl = document.createElement('canvas');
        canvasEl.width = cw;
        canvasEl.height = ch;
        canvasEl.style.cssText = 'position:absolute;top:0;left:0;';
        this.wrapperEl.appendChild(canvasEl);

        this.canvas = new Canvas(canvasEl, {
            width: cw,
            height: ch,
            selection: false,
            renderOnAddRemove: false,
            backgroundColor: 'transparent'
        });
        this.canvas.renderAll();

        window.addEventListener('resize', this.handleResize);
    }

    updateTime(currentTime: number): void {
        if (!this.visible || !this.canvas) return;

        // 筛选：已创建 且 未删除（或尚未到删除时间）
        const active = this.annotations.filter(
            a => a.timestamp <= currentTime && (!a.deletedAt || a.deletedAt > currentTime)
        );

        // 需要移除的标注（到了 deletedAt 时间点）
        const toRemove = this.annotations.filter(
            a => a.deletedAt && a.deletedAt <= currentTime && a.timestamp <= currentTime
        );
        const removeIds = new Set(toRemove.map(a => a.id));

        // 回退时重置（seeking backward / replay）
        if (active.length < this.renderedIds.size || removeIds.size > 0) {
            // 如果有标注需要移除（deletedAt 到期），或 active 数量减少，执行完全重绘
            this.renderedIds.clear();
            this.mouseTrail = null;
            this.canvas.clear();
            this.canvas.backgroundColor = 'transparent';

            // 重新绘制所有 active 标注
            for (const ann of active) {
                this.renderedIds.add(ann.id);
                this.renderAnnotation(ann, false);
            }
            this.canvas.renderAll();
            return;
        }

        const newIds: string[] = [];

        for (const ann of active) {
            if (!this.renderedIds.has(ann.id)) {
                this.renderedIds.add(ann.id);
                newIds.push(ann.id);
                this.renderAnnotation(ann, true);
            }
        }

        // 有新标注时启动渐显动画
        if (newIds.length > 0) {
            this.startFadeIn();
        }

        this.canvas.renderAll();
    }

    /**
     * 渲染鼠标移动轨迹
     * @param positions 全部鼠标位置数组 [{ time, x, y }, ...]
     * @param currentTime 当前回放时间
     */
    updateMouseTrail(positions: Array<{ time: number; x: number; y: number }>, currentTime: number): void {
        if (!this.canvas) return;

        if (this.mouseTrail) {
            this.canvas.remove(this.mouseTrail);
            this.mouseTrail = null;
        }

        const cutoff = currentTime - AnnotationOverlay.TRAIL_DURATION;
        const trail = positions.filter(p => p.time > cutoff && p.time <= currentTime);
        if (trail.length < 2) {
            this.canvas.renderAll();
            return;
        }

        const pathStr = trail.reduce(
            (acc, p, i) => acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`),
            ''
        );

        this.mouseTrail = new Path(pathStr, {
            stroke: '#7ba4f5',
            strokeWidth: 2,
            fill: '',
            opacity: 0.4,
            selectable: false,
            evented: false
        });

        this.canvas.add(this.mouseTrail);
        this.canvas.renderAll();
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
        const canvasEl = this.canvas.getElement();
        canvasEl.width = w;
        canvasEl.height = h;
        this.canvas.setWidth(w);
        this.canvas.setHeight(h);
        this.canvas.renderAll();
    }

    destroy(): void {
        this.stopFadeIn();
        window.removeEventListener('resize', this.handleResize);
        if (this.mouseTrail) {
            this.canvas?.remove(this.mouseTrail);
            this.mouseTrail = null;
        }
        this.canvas?.dispose();
        this.canvas = null;
        this.wrapperEl?.remove();
        this.wrapperEl = null;
        this.renderedIds.clear();
    }

    // ============================================================
    // 渐显动画
    // ============================================================
    private startFadeIn(): void {
        if (this.animFrameId) return;

        const startTime = performance.now();
        const duration = AnnotationOverlay.FADE_DURATION;
        const canvas = this.canvas!;

        const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out cubic
            const t = 1 - (1 - progress) ** 3;

            const objects = canvas.getObjects();
            let allDone = true;

            for (const obj of objects) {
                const o = obj as any;
                if (o.opacity !== undefined && o.opacity < 1) {
                    o.set({ opacity: t, scaleX: 0.9 + 0.1 * t, scaleY: 0.9 + 0.1 * t });
                    allDone = false;
                }
            }

            canvas.renderAll();

            if (allDone) {
                this.animFrameId = null;
            }
            else {
                this.animFrameId = requestAnimationFrame(animate);
            }
        };

        this.animFrameId = requestAnimationFrame(animate);
    }

    private stopFadeIn(): void {
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
    }

    private handleResize = (): void => {
        if (!this.canvas || !this.container) return;
        this.canvas.setWidth(this.container.clientWidth);
        this.canvas.setHeight(this.container.clientHeight);
        this.canvas.requestRenderAll();
    };

    private renderAnnotation(ann: Annotation, fadeIn = false): void {
        let obj = null;
        const scale = fadeIn ? 0.9 : 1;
        const opacity = fadeIn ? 0 : 1;

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
                    opacity,
                    scaleX: scale,
                    scaleY: scale
                });
                break;
            case 'arrow': {
                const { startX, startY, endX, endY, color, lineWidth } = ann.data;
                const line = new Line([startX, startY, endX, endY], {
                    stroke: color,
                    strokeWidth: lineWidth,
                    selectable: false,
                    evented: false,
                    opacity
                });
                this.canvas!.add(line);

                const angle = Math.atan2(endY - startY, endX - startX);
                const h = 14;
                const tri = new Polygon([
                    { x: endX, y: endY },
                    { x: endX - h * Math.cos(angle - Math.PI / 6), y: endY - h * Math.sin(angle - Math.PI / 6) },
                    { x: endX - h * Math.cos(angle + Math.PI / 6), y: endY - h * Math.sin(angle + Math.PI / 6) }
                ], {
                    fill: color,
                    stroke: color,
                    strokeWidth: 2,
                    selectable: false,
                    evented: false,
                    opacity
                });
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
                    opacity,
                    scaleX: scale,
                    scaleY: scale
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
                        opacity
                    }
                );
                this.canvas!.add(path);
                break;
            }
        }
        if (obj) this.canvas!.add(obj);
    }
}
