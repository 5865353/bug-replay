/**
 * arrow-tool.ts — 箭头指向工具 (Fabric 原生事件)
 *
 * - 拖拽空白区：实时预览 → 松手创建箭头
 * - 点击已有对象：交给 Fabric 选中/拖拽，不创建新对象
 */

import type { Canvas, TPointerEventInfo } from 'fabric';
import { Line } from 'fabric';
import {
    ARROW_MIN_DISTANCE,
    CURSOR_CROSSHAIR,
    CURSOR_DEFAULT,
    FABRIC_EVENT_MOUSE_DOWN,
    FABRIC_EVENT_MOUSE_MOVE,
    FABRIC_EVENT_MOUSE_UP,
    PREVIEW_DASH_ARRAY,
    PREVIEW_STROKE_WIDTH,
} from '../../constants';
import { BaseTool } from './base-tool';

export class ArrowTool extends BaseTool {
    private fc: Canvas | null = null;
    private preview: Line | null = null;
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
        if (e.target) return;
        const ptr = this.fc!.getScenePoint(e.e);
        this.startX = ptr.x;
        this.startY = ptr.y;
        this.isDrawing = true;
        this.updatePreview(ptr.x, ptr.y);
    };

    private onMove = (e: TPointerEventInfo): void => {
        if (!this.isDrawing) return;
        const ptr = this.fc!.getScenePoint(e.e);
        this.updatePreview(ptr.x, ptr.y);
    };

    private onUp = (e: TPointerEventInfo): void => {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        this.removePreview();

        const ptr = this.fc!.getScenePoint(e.e);
        const dx = ptr.x - this.startX;
        const dy = ptr.y - this.startY;
        if (Math.sqrt(dx * dx + dy * dy) < ARROW_MIN_DISTANCE) return;

        this.canvasLayer.addArrow(this.startX, this.startY, ptr.x, ptr.y, this.color);
    };

    private updatePreview(ex: number, ey: number): void {
        this.removePreview();
        this.preview = new Line([this.startX, this.startY, ex, ey], {
            stroke: this.color,
            strokeWidth: PREVIEW_STROKE_WIDTH,
            selectable: false,
            evented: false,
            strokeDashArray: [...PREVIEW_DASH_ARRAY],
        });
        this.fc!.add(this.preview);
        this.fc!.requestRenderAll();
    }

    private removePreview(): void {
        if (this.preview) {
            this.fc?.remove(this.preview);
            this.preview = null;
        }
    }
}
