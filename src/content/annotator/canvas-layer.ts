/**
 * src/content/annotator/canvas-layer.ts
 *
 * 基于 Fabric.js 的标注画布层
 * - 在页面上覆盖全屏 Fabric.Canvas
 * - 所有标注对象可选中、拖拽、缩放、删除
 * - 支持序列化/反序列化为 Annotation[] 格式
 */

import type { Annotation, AnnotationToolType } from '@shared/types';
import type { FabricObject } from 'fabric';
import { DEFAULT_ANNOTATION_CONFIG } from '@shared/types';
import { generateUUID } from '@shared/utils';
import { Canvas, classRegistry, IText, Line, Path, PencilBrush, Polygon, Rect } from 'fabric';
import {
    ARROW_HEAD_ANGLE,
    ARROW_HEAD_SIZE,
    ARROW_HEAD_STROKE_WIDTH,
    DOM_EVENT_KEYDOWN,
    DOM_EVENT_RESIZE,
    DOM_EVENT_WHEEL,
    FABRIC_EVENT_OBJECT_MODIFIED,
    FABRIC_EVENT_PATH_CREATED,
    FILL_OPACITY_RECT,
    FILL_OPACITY_TEXT,
    ID_CANVAS_LAYER,
    ID_FABRIC_CANVAS,
    KEY_DELETE,
    POINTER_EVENTS_AUTO,
    POINTER_EVENTS_NONE,
    RECT_CORNER_RADIUS,
    TEXT_EDIT_DELAY,
    TEXT_PADDING,
    TEXT_PLACEHOLDER,
    TOUCH_ACTION_NONE,
    Z_INDEX_CANVAS
} from '../constants';

// 注册 Fabric 类以支持 fromJSON 反序列化
classRegistry.setClass(Rect, 'Rect');
classRegistry.setClass(Line, 'Line');
classRegistry.setClass(IText, 'IText');
classRegistry.setClass(Polygon, 'Polygon');

// ============================================================
// CanvasLayer
// ============================================================

export class CanvasLayer {
    private canvas: Canvas | null = null;
    private wrapperEl: HTMLDivElement | null = null;
    private sessionId = '';
    private annotationMetadata = new WeakMap<FabricObject, { type: AnnotationToolType; stepNumber?: number; createdAt: number; annotationId: string }>();
    /** 箭头线 → 三角形附属对象的映射（用于删除时联动清除） */
    private arrowTriangles = new WeakMap<FabricObject, FabricObject>();
    private stepCounter = 0;

    // 回调
    private onChangeCallback: (() => void) | null = null;

    /** 设置数据变更回调（通知 Annotator 更新数据） */
    onObjectsChanged(cb: () => void): void {
        this.onChangeCallback = cb;
    }

    // ============================================================
    // 显示 / 隐藏
    // ============================================================

    show(sessionId: string): void {
        if (this.canvas) return;
        this.sessionId = sessionId;

        // 外层容器
        this.wrapperEl = document.createElement('div');
        this.wrapperEl.id = ID_CANVAS_LAYER;
        this.wrapperEl.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            z-index: ${Z_INDEX_CANVAS}; pointer-events: ${POINTER_EVENTS_NONE};
        `;
        document.body.appendChild(this.wrapperEl);

        // Fabric Canvas
        const canvasEl = document.createElement('canvas');
        canvasEl.id = ID_FABRIC_CANVAS;
        this.wrapperEl.appendChild(canvasEl);

        this.canvas = new Canvas(canvasEl, {
            width: window.innerWidth,
            height: window.innerHeight,
            selection: false,
            preserveObjectStacking: true,
            stopContextMenu: true,
            renderOnAddRemove: true
        });

        // Fabric 创建 .canvas-container 包裹 canvas，设为 pointer-events: none
        // 画布始终渲染（绘图预览、最终图形都可见），但不拦截点击
        setTimeout(() => {
            const container = this.wrapperEl?.querySelector('.canvas-container') as HTMLElement | null;
            if (container) container.style.pointerEvents = POINTER_EVENTS_NONE;
        }, 0);

        // Delete 键删除选中对象
        this.canvas.on(FABRIC_EVENT_OBJECT_MODIFIED, () => this.notifyChange());
        document.addEventListener(DOM_EVENT_KEYDOWN, this.handleKeyDown);

        // 响应式缩放
        window.addEventListener(DOM_EVENT_RESIZE, this.handleResize);
    }

    hide(): void {
        document.removeEventListener(DOM_EVENT_KEYDOWN, this.handleKeyDown);
        window.removeEventListener(DOM_EVENT_RESIZE, this.handleResize);
        if (this.canvas) {
            this.canvas.dispose();
            this.canvas = null;
        }
        if (this.wrapperEl) {
            this.wrapperEl.remove();
            this.wrapperEl = null;
        }
        this.annotationMetadata = new WeakMap();
    }

    // ============================================================
    // 添加标注对象
    // ============================================================

    /** 添加矩形 */
    addRect(x: number, y: number, width: number, height: number, color: string): FabricObject {
        const rect = new Rect({
            left: Math.min(x, x + width),
            top: Math.min(y, y + height),
            width: Math.abs(width),
            height: Math.abs(height),
            fill: `${color}${FILL_OPACITY_RECT}`,
            stroke: color,
            strokeWidth: DEFAULT_ANNOTATION_CONFIG.strokeWidth,
            rx: RECT_CORNER_RADIUS,
            ry: RECT_CORNER_RADIUS,
            selectable: true,
            evented: true
        });
        this.canvas!.add(rect);
        this.trackObject(rect, 'rect');
        this.canvas!.setActiveObject(rect);
        this.canvas!.requestRenderAll();
        this.notifyChange();
        return rect;
    }

    /** 添加箭头：独立的 Line + 三角形 Polygon */
    addArrow(fromX: number, fromY: number, toX: number, toY: number, color: string): FabricObject {
        const line = new Line([fromX, fromY, toX, toY], {
            stroke: color,
            strokeWidth: DEFAULT_ANNOTATION_CONFIG.strokeWidth,
            selectable: true,
            evented: true
        });
        this.canvas!.add(line);

        // 三角形箭头头部
        const angle = Math.atan2(toY - fromY, toX - fromX);
        const h = ARROW_HEAD_SIZE;
        const px = toX;
        const py = toY;
        const tri = new Polygon([
            { x: px, y: py },
            { x: px - h * Math.cos(angle - ARROW_HEAD_ANGLE), y: py - h * Math.sin(angle - ARROW_HEAD_ANGLE) },
            { x: px - h * Math.cos(angle + ARROW_HEAD_ANGLE), y: py - h * Math.sin(angle + ARROW_HEAD_ANGLE) }
        ], {
            fill: color,
            stroke: color,
            strokeWidth: ARROW_HEAD_STROKE_WIDTH,
            selectable: false,
            evented: false
        });
        this.canvas!.add(tri);

        this.trackObject(line, 'arrow');
        // 记录三角形附属关系，以便删除箭头时联动清除
        this.arrowTriangles.set(line, tri);
        this.canvas!.setActiveObject(line);
        this.canvas!.requestRenderAll();
        this.notifyChange();
        return line;
    }

    /** 添加文本 */
    addText(x: number, y: number, text: string, color: string): FabricObject {
        const displayText = text || TEXT_PLACEHOLDER;
        const itext = new IText(displayText, {
            left: x,
            top: y,
            fontSize: DEFAULT_ANNOTATION_CONFIG.fontSize,
            fontFamily: DEFAULT_ANNOTATION_CONFIG.fontFamily,
            fill: color,
            backgroundColor: `${color}${FILL_OPACITY_TEXT}`,
            padding: TEXT_PADDING,
            selectable: true,
            evented: true,
            editable: true
        });
        this.canvas!.add(itext);
        this.trackObject(itext, 'text');
        this.canvas!.setActiveObject(itext);
        this.canvas!.requestRenderAll();
        this.notifyChange();

        // 进入编辑模式（全选占位文本方便替换）
        setTimeout(() => {
            this.canvas!.setActiveObject(itext);
            itext.enterEditing();
            if (text === '') itext.selectAll();
        }, TEXT_EDIT_DELAY);

        return itext;
    }

    /** 启用自由画笔模式，返回清理函数 */
    enableFreehand(color: string): () => void {
        const canvas = this.canvas!;
        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush = new PencilBrush(canvas);
        canvas.freeDrawingBrush.color = color;
        canvas.freeDrawingBrush.width = DEFAULT_ANNOTATION_CONFIG.strokeWidth;
        this.setInteractive(true);

        const onPathCreated = (e: { path: FabricObject }) => {
            e.path.set({ selectable: true, evented: true });
            this.trackObject(e.path, 'freehand');
            this.notifyChange();
            canvas.requestRenderAll();
        };
        canvas.on(FABRIC_EVENT_PATH_CREATED, onPathCreated);

        return () => {
            canvas.isDrawingMode = false;
            canvas.off(FABRIC_EVENT_PATH_CREATED, onPathCreated);
            this.setInteractive(false);
            canvas.requestRenderAll();
        };
    }

    // ============================================================
    // 撤销 / 清除 / 选中状态
    // ============================================================

    /** 撤销最后一个对象（含箭头三角形联动） */
    undoLast(): boolean {
        const objects = this.canvas!.getObjects();
        if (objects.length === 0) return false;
        const last = objects[objects.length - 1]!;
        this.removeObject(last);
        this.notifyChange();
        return true;
    }

    /** 清除所有对象 */
    clearAll(): void {
        this.canvas!.clear();
        this.annotationMetadata = new WeakMap();
        this.arrowTriangles = new WeakMap();
        this.notifyChange();
    }

    /** 是否有选中对象 */
    hasSelection(): boolean {
        return !!this.canvas?.getActiveObject();
    }

    /** 删除选中对象（含箭头三角形联动） */
    deleteSelected(): void {
        const obj = this.canvas?.getActiveObject();
        if (obj) {
            this.removeObject(obj);
            this.canvas!.discardActiveObject();
            this.canvas!.requestRenderAll();
            this.notifyChange();
        }
    }

    /** 移除对象及其附属（如箭头的三角形），清理元数据 */
    private removeObject(obj: FabricObject): void {
        // 联动删除箭头三角形
        const tri = this.arrowTriangles.get(obj);
        if (tri) {
            this.canvas!.remove(tri);
            this.arrowTriangles.delete(obj);
        }
        this.canvas!.remove(obj);
        this.annotationMetadata.delete(obj);
    }

    /** 取消选中 */
    deselectAll(): void {
        this.canvas?.discardActiveObject();
        this.canvas?.requestRenderAll();
    }

    /** 暴露 Fabric Canvas 给工具使用 */
    getFabricCanvas(): Canvas | null {
        return this.canvas;
    }

    /** 切换画布是否拦截点击。默认关闭，工具激活时才开启 */
    setInteractive(enabled: boolean): void {
        const container = this.wrapperEl?.querySelector('.canvas-container') as HTMLElement | null;
        if (container) {
            container.style.pointerEvents = enabled ? POINTER_EVENTS_AUTO : POINTER_EVENTS_NONE;
            container.style.touchAction = enabled ? TOUCH_ACTION_NONE : '';
        }
        // 绘制时防止页面滚动
        if (this.wrapperEl) {
            this.wrapperEl.style.touchAction = enabled ? TOUCH_ACTION_NONE : '';
            if (enabled) {
                this.wrapperEl.addEventListener(DOM_EVENT_WHEEL, this.preventDefault, { passive: false });
            }
            else {
                this.wrapperEl.removeEventListener(DOM_EVENT_WHEEL, this.preventDefault);
            }
        }
    }

    /** 阻止默认滚动 */
    private preventDefault = (e: Event): void => {
        e.preventDefault();
    };

    // ============================================================
    // 序列化 / 反序列化
    // ============================================================

    /** 导出为 Annotation[]（用于 .rrt 存储） */
    toAnnotations(): Annotation[] {
        const annotations: Annotation[] = [];
        const objects = this.canvas!.getObjects();

        for (const obj of objects) {
            const meta = this.annotationMetadata.get(obj);
            if (!meta) continue;

            const annotation = this.fabricToAnnotation(obj, meta);
            if (annotation) annotations.push(annotation);
        }

        return annotations;
    }

    /** 从 Annotation[] 恢复标注 */
    loadAnnotations(annotations: Annotation[]): void {
        this.canvas!.clear();
        this.annotationMetadata = new WeakMap();

        for (const ann of annotations) {
            // 跳过已删除的标注
            if (ann.deletedAt) continue;
            const obj = this.annotationToFabric(ann);
            if (obj) {
                this.canvas!.add(obj);
                this.trackObject(obj, ann.type, ann.stepNumber, ann.id);
            }
        }

        this.canvas!.requestRenderAll();
    }

    // ============================================================
    // 私有方法
    // ============================================================

    /** 跟踪对象元数据，自动分配步骤编号，记录绘制时刻和稳定 ID */
    private trackObject(
        obj: FabricObject,
        type: AnnotationToolType,
        stepNumber?: number,
        annotationId?: string
    ): void {
        const num = stepNumber ?? ++this.stepCounter;
        this.annotationMetadata.set(obj, {
            type,
            stepNumber: num,
            createdAt: Date.now(),
            annotationId: annotationId ?? generateUUID()
        });
    }

    /** Fabric 对象 → Annotation */
    private fabricToAnnotation(
        obj: FabricObject,
        meta: { type: AnnotationToolType; stepNumber?: number; createdAt?: number; annotationId?: string }
    ): Annotation | null {
        const base = {
            id: meta.annotationId ?? generateUUID(),
            timestamp: meta.createdAt ?? Date.now(),
            sessionId: this.sessionId,
            stepNumber: meta.stepNumber
        };

        switch (meta.type) {
            case 'rect': {
                const r = obj as Rect;
                return {
                    ...base,
                    type: 'rect',
                    data: {
                        x: r.left!,
                        y: r.top!,
                        width: r.width! * (r.scaleX ?? 1),
                        height: r.height! * (r.scaleY ?? 1),
                        strokeColor: String(r.stroke ?? DEFAULT_ANNOTATION_CONFIG.strokeColor),
                        strokeWidth: r.strokeWidth ?? DEFAULT_ANNOTATION_CONFIG.strokeWidth,
                        fillColor: String(r.fill ?? '')
                    }
                };
            }
            case 'arrow': {
                const l = obj as Line;
                // Fabric v6 的 Line 构造函数后 x1/y1/x2/y2 保持原始绝对坐标，
                // left/top 是包围盒中心点（由 _setWidthHeight 设置），不应相加
                return {
                    ...base,
                    type: 'arrow',
                    data: {
                        startX: l.x1 ?? 0,
                        startY: l.y1 ?? 0,
                        endX: l.x2 ?? 0,
                        endY: l.y2 ?? 0,
                        color: String(l.stroke ?? DEFAULT_ANNOTATION_CONFIG.strokeColor),
                        lineWidth: l.strokeWidth ?? DEFAULT_ANNOTATION_CONFIG.strokeWidth
                    }
                };
            }
            case 'text': {
                const t = obj as IText;
                // Fabric.js v6 中 IText.text 可能是 string[]，需要 join
                const rawText = t.text;
                const textStr = Array.isArray(rawText) ? rawText.join('') : (rawText ?? '');
                return {
                    ...base,
                    type: 'text',
                    data: {
                        x: t.left!,
                        y: t.top!,
                        text: textStr,
                        fontSize: t.fontSize ?? DEFAULT_ANNOTATION_CONFIG.fontSize,
                        fontFamily: t.fontFamily ?? DEFAULT_ANNOTATION_CONFIG.fontFamily,
                        color: String(t.fill ?? DEFAULT_ANNOTATION_CONFIG.textColor),
                        backgroundColor: String(t.backgroundColor ?? '')
                    }
                };
            }
            case 'freehand': {
                const path = obj as FabricObject & { path?: Array<[string, number, number]> };
                const rawPath = path.path ?? [];
                const points = rawPath
                    .filter((cmd): cmd is [string, number, number] => cmd[0] === 'M' || cmd[0] === 'L' || cmd[0] === 'Q')
                    .map(cmd => ({ x: cmd[1] + obj.left!, y: cmd[2] + obj.top! }));
                return {
                    ...base,
                    type: 'freehand',
                    data: {
                        points: points.length > 0 ? points : [{ x: obj.left!, y: obj.top! }],
                        color: String(obj.stroke ?? DEFAULT_ANNOTATION_CONFIG.strokeColor),
                        lineWidth: obj.strokeWidth ?? DEFAULT_ANNOTATION_CONFIG.strokeWidth
                    }
                };
            }
        }
    }

    /** Annotation → Fabric 对象 */
    private annotationToFabric(ann: Annotation): FabricObject | null {
        switch (ann.type) {
            case 'rect': {
                return new Rect({
                    left: ann.data.x,
                    top: ann.data.y,
                    width: ann.data.width,
                    height: ann.data.height,
                    fill: ann.data.fillColor || `${ann.data.strokeColor}20`,
                    stroke: ann.data.strokeColor,
                    strokeWidth: ann.data.strokeWidth,
                    rx: 4,
                    ry: 4,
                    selectable: true,
                    evented: true
                });
            }
            case 'arrow': {
                const { startX, startY, endX, endY, color, lineWidth } = ann.data;
                const line = new Line([startX, startY, endX, endY], {
                    stroke: color,
                    strokeWidth: lineWidth,
                    selectable: true,
                    evented: true
                });
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
                    evented: false
                });
                this.canvas!.add(line);
                this.canvas!.add(tri);
                return line;
            }
            case 'text': {
                return new IText(ann.data.text, {
                    left: ann.data.x,
                    top: ann.data.y,
                    fontSize: ann.data.fontSize,
                    fontFamily: ann.data.fontFamily,
                    fill: ann.data.color,
                    backgroundColor: ann.data.backgroundColor || `${ann.data.color}15`,
                    padding: 6,
                    selectable: true,
                    evented: true,
                    editable: false // 回放时不可编辑
                });
            }
            case 'freehand': {
                const { points, color, lineWidth } = ann.data;
                if (points.length === 0) return null;
                const pathData = points
                    .map((p, i) => {
                        const relX = p.x - points[0].x;
                        const relY = p.y - points[0].y;
                        return i === 0 ? `M ${relX} ${relY}` : `L ${relX} ${relY}`;
                    })
                    .join(' ');
                return new Path(pathData, {
                    left: points[0].x,
                    top: points[0].y,
                    stroke: color,
                    strokeWidth: lineWidth,
                    fill: '',
                    selectable: true,
                    evented: true
                });
            }
        }
    }

    private notifyChange(): void {
        this.onChangeCallback?.();
    }

    private handleKeyDown = (e: KeyboardEvent): void => {
        if (e.key === KEY_DELETE || e.key === 'Backspace') {
            // 避免在文本编辑时删除
            const active = document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.getAttribute('contenteditable') === 'true')) {
                return;
            }
            this.deleteSelected();
        }
        if (e.key === 'Escape') {
            this.deselectAll();
        }
    };

    private handleResize = (): void => {
        if (!this.canvas) return;
        this.canvas.setWidth(window.innerWidth);
        this.canvas.setHeight(window.innerHeight);
        this.canvas.requestRenderAll();
    };
}
