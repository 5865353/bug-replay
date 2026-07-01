/**
 * arrow-tool.ts — 箭头指向工具 (Fabric 原生事件)
 *
 * - 拖拽空白区：实时预览 → 松手创建箭头
 * - 点击已有对象：交给 Fabric 选中/拖拽，不创建新对象
 */

import type { Canvas, TPointerEventInfo } from 'fabric';
import { Line } from 'fabric';
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
        this.fc.defaultCursor = 'crosshair';
        this.fc.on('mouse:down', this.onDown);
        this.fc.on('mouse:move', this.onMove);
        this.fc.on('mouse:up', this.onUp);
    }

    deactivate(): void {
        if (this.fc) {
            this.fc.off('mouse:down', this.onDown);
            this.fc.off('mouse:move', this.onMove);
            this.fc.off('mouse:up', this.onUp);
            this.fc.defaultCursor = 'default';
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
        if (Math.sqrt(dx * dx + dy * dy) < 10) return;

        this.canvasLayer.addArrow(this.startX, this.startY, ptr.x, ptr.y, this.color);
    };

    private updatePreview(ex: number, ey: number): void {
        this.removePreview();
        this.preview = new Line([this.startX, this.startY, ex, ey], {
            stroke: this.color,
            strokeWidth: 2,
            selectable: false,
            evented: false,
            strokeDashArray: [6, 3],
        });
        this.fc!.add(this.preview);
        this.fc!.requestRenderAll();
    }

    private removePreview(): void {
        if (this.preview) { this.fc?.remove(this.preview); this.preview = null; }
    }
}
