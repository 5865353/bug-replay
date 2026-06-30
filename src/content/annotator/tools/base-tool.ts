/**
 * src/content/annotator/tools/base-tool.ts
 *
 * 绘图工具抽象基类 — 所有标注工具的父类
 * 提供统一的 Canvas 鼠标事件绑定/解绑、坐标转换等公共逻辑
 */

import type { Annotation } from '@shared/types';
import type { CanvasLayer } from '../canvas-layer';
import { generateUUID } from '@shared/utils';

export interface ToolOptions {
    canvasLayer: CanvasLayer;
    sessionId: string;
    color: string;
    onComplete: (annotation: Annotation) => void;
}

export abstract class BaseTool {
    protected canvasLayer: CanvasLayer;
    protected sessionId: string;
    protected color: string;
    protected onComplete: (annotation: Annotation) => void;
    protected isActive = false;

    /** 绑定的鼠标事件处理器 */
    protected boundMouseDown: ((e: MouseEvent) => void) | null = null;
    protected boundMouseMove: ((e: MouseEvent) => void) | null = null;
    protected boundMouseUp: ((e: MouseEvent) => void) | null = null;
    protected boundKeyDown: ((e: KeyboardEvent) => void) | null = null;

    constructor(options: ToolOptions) {
        this.canvasLayer = options.canvasLayer;
        this.sessionId = options.sessionId;
        this.color = options.color;
        this.onComplete = options.onComplete;
    }

    /**
     * 激活工具（绑定事件监听）
     */
    abstract activate(): void;

    /**
     * 停用工具（解绑事件监听）
     */
    deactivate(): void {
        this.isActive = false;
        const canvas = this.canvasLayer.getCanvas();
        if (!canvas) return;

        if (this.boundMouseDown) {
            canvas.removeEventListener('mousedown', this.boundMouseDown);
            this.boundMouseDown = null;
        }
        if (this.boundMouseMove) {
            canvas.removeEventListener('mousemove', this.boundMouseMove);
            this.boundMouseMove = null;
        }
        if (this.boundMouseUp) {
            canvas.removeEventListener('mouseup', this.boundMouseUp);
            this.boundMouseUp = null;
        }
        if (this.boundKeyDown) {
            document.removeEventListener('keydown', this.boundKeyDown);
            this.boundKeyDown = null;
        }
    }

    /**
     * 获取 Canvas 相对于视口的坐标
     */
    protected getCanvasCoords(e: MouseEvent): { x: number; y: number } {
        const canvas = this.canvasLayer.getCanvas();
        if (!canvas) return { x: e.clientX, y: e.clientY };
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    }

    /**
     * 生成标注 ID
     */
    protected generateId(): string {
        return generateUUID();
    }
}
