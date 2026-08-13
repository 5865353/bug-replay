/**
 * text-tool.ts — 文本批注工具 (Fabric 原生事件)
 *
 * - 点击空白区：创建 IText 并自动进入编辑
 * - 双击已有 IText：Fabric 原生编辑（无需额外处理）
 */

import type { Canvas, TPointerEventInfo } from 'fabric';
import {
    CURSOR_DEFAULT,
    CURSOR_TEXT,
    FABRIC_EVENT_MOUSE_DOWN
} from '../../constants';
import { BaseTool } from './base-tool';

export class TextTool extends BaseTool {
    private fc: Canvas | null = null;

    activate(): void {
        this.isActive = true;
        this.fc = this.canvasLayer.getFabricCanvas();
        if (!this.fc) return;
        this.fc.defaultCursor = CURSOR_TEXT;
        this.fc.on(FABRIC_EVENT_MOUSE_DOWN, this.onDown);
    }

    deactivate(): void {
        if (this.fc) {
            this.fc.off(FABRIC_EVENT_MOUSE_DOWN, this.onDown);
            this.fc.defaultCursor = CURSOR_DEFAULT;
        }
        this.fc = null;
        super.deactivate();
    }

    private onDown = (e: TPointerEventInfo): void => {
        // 点击已有文本 → 交给 Fabric 处理（双击编辑 / 选中移动）
        if (e.target) return;

        const ptr = this.fc!.getScenePoint(e.e);
        this.canvasLayer.addText(ptr.x, ptr.y, '', this.color);
    };
}
