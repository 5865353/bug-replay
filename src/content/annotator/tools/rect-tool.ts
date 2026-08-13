/**
 * rect-tool.ts — 矩形框选工具 (Fabric 原生事件)
 *
 * - 拖拽空白区：实时预览 → 松手创建 Rect
 * - 点击已有对象：交给 Fabric 选中/拖拽/缩放，不创建新对象
 */

import type { Canvas, TPointerEventInfo } from 'fabric';
import { Rect } from 'fabric';
import {
    CURSOR_CROSSHAIR,
    CURSOR_DEFAULT,
    FABRIC_EVENT_MOUSE_DOWN,
    FABRIC_EVENT_MOUSE_MOVE,
    FABRIC_EVENT_MOUSE_UP,
    PREVIEW_DASH_ARRAY,
    PREVIEW_FILL_OPACITY,
    PREVIEW_STROKE_WIDTH,
    RECT_MIN_SIZE
} from '../../constants';
import { BaseTool } from './base-tool';

export class RectTool extends BaseTool {
    private fc: Canvas | null = null;
    private preview: Rect | null = null;
    private startX = 0;
    private startY = 0;
    private isDrawing = false;

    activate(): void {
        this.isActive = true;
        this.fc = this.canvasLayer.getFabricCanvas();
        if (!this.fc) return;
        this.fc.defaultCursor = CURSOR_CROSSHAIR;
        this.fc.on(FABRIC_EVENT_MOUSE_DOWN, this.onDown);
        this.fc.on(FABRIC_EVENT_MOUSE_MOVE, this.onMove);
        this.fc.on(FABRIC_EVENT_MOUSE_UP, this.onUp);
    }

    deactivate(): void {
        if (this.fc) {
            this.fc.off(FABRIC_EVENT_MOUSE_DOWN, this.onDown);
            this.fc.off(FABRIC_EVENT_MOUSE_MOVE, this.onMove);
            this.fc.off(FABRIC_EVENT_MOUSE_UP, this.onUp);
            this.fc.defaultCursor = CURSOR_DEFAULT;
        }
        this.removePreview();
        this.fc = null;
        super.deactivate();
    }

    private onDown = (e: TPointerEventInfo): void => {
        // 点击已有对象 → 不拦截，交给 Fabric 处理
        if (e.target) return;

        const ptr = this.fc!.getScenePoint(e.e);
        this.startX = ptr.x;
        this.startY = ptr.y;
        this.isDrawing = true;

        this.preview = new Rect({
            left: ptr.x,
            top: ptr.y,
            width: 0,
            height: 0,
            fill: `${this.color}${PREVIEW_FILL_OPACITY}`,
            stroke: this.color,
            strokeWidth: PREVIEW_STROKE_WIDTH,
            strokeDashArray: [...PREVIEW_DASH_ARRAY],
            selectable: false,
            evented: false
        });
        this.fc!.add(this.preview);
    };

    private onMove = (e: TPointerEventInfo): void => {
        if (!this.isDrawing || !this.preview) return;
        const ptr = this.fc!.getScenePoint(e.e);
        const w = ptr.x - this.startX;
        const h = ptr.y - this.startY;
        this.preview.set({
            left: Math.min(this.startX, ptr.x),
            top: Math.min(this.startY, ptr.y),
            width: Math.abs(w),
            height: Math.abs(h)
        });
        this.fc!.requestRenderAll();
    };

    private onUp = (e: TPointerEventInfo): void => {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        this.removePreview();

        const ptr = this.fc!.getScenePoint(e.e);
        const w = Math.abs(ptr.x - this.startX);
        const h = Math.abs(ptr.y - this.startY);
        if (w < RECT_MIN_SIZE || h < RECT_MIN_SIZE) return;

        this.canvasLayer.addRect(this.startX, this.startY, ptr.x - this.startX, ptr.y - this.startY, this.color);
    };

    private removePreview(): void {
        if (this.preview) {
            this.fc?.remove(this.preview);
            this.preview = null;
        }
    }
}
