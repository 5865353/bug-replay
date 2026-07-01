/**
 * freehand-tool.ts — 自由画笔工具 (Fabric PencilBrush)
 *
 * - 拖拽空白区：自由绘制
 * - 点击已有对象：交给 Fabric 选中/拖拽（临时关掉绘制模式）
 */

import type { CanvasLayer } from '../canvas-layer';
import type { Canvas, TPointerEventInfo } from 'fabric';
import { BaseTool } from './base-tool';

export class FreehandTool extends BaseTool {
    private fc: Canvas | null = null;
    private disableFreehand: (() => void) | null = null;
    private drawingEnabled = false;

    activate(): void {
        this.isActive = true;
        this.fc = this.canvasLayer.getFabricCanvas();
        if (!this.fc) return;

        this.enableDrawing();
        this.fc.on('mouse:down', this.onDown);
    }

    deactivate(): void {
        if (this.fc) {
            this.fc.off('mouse:down', this.onDown);
            this.disableDrawing();
            this.fc.defaultCursor = 'default';
        }
        this.fc = null;
        super.deactivate();
    }

    private onDown = (e: TPointerEventInfo): void => {
        if (e.target) {
            this.disableDrawing();
            requestAnimationFrame(() => {
                if (this.isActive) this.enableDrawing();
            });
        }
    };

    private enableDrawing(): void {
        if (this.drawingEnabled) return;
        this.drawingEnabled = true;
        this.disableFreehand = this.canvasLayer.enableFreehand(this.color);
        if (this.fc) this.fc.defaultCursor = 'crosshair';
    }

    private disableDrawing(): void {
        if (!this.drawingEnabled) return;
        this.drawingEnabled = false;
        this.disableFreehand?.();
        this.disableFreehand = null;
    }
}
