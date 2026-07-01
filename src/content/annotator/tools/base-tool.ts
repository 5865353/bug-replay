/**
 * src/content/annotator/tools/base-tool.ts
 *
 * 绘图工具抽象基类 — Fabric.js 版本
 * 所有工具共享 CanvasLayer，通过配置 Fabric Canvas 实现不同交互模式
 */

import type { CanvasLayer } from '../canvas-layer';
import { generateUUID } from '@shared/utils';

export interface ToolOptions {
    canvasLayer: CanvasLayer;
    color: string;
}

export abstract class BaseTool {
    protected canvasLayer: CanvasLayer;
    protected color: string;
    protected isActive = false;

    constructor(options: ToolOptions) {
        this.canvasLayer = options.canvasLayer;
        this.color = options.color;
    }

    abstract activate(): void;

    deactivate(): void {
        this.isActive = false;
    }

    protected generateId(): string {
        return generateUUID();
    }
}
