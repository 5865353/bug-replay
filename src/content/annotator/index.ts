/**
 * src/content/annotator/index.ts — Annotator 统一入口 (Fabric.js)
 */
import type { Annotation, AnnotationToolType } from '@shared/types';
import type { BaseTool } from './tools/base-tool';
import { CanvasLayer } from './canvas-layer';
import { Toolbar } from './toolbar';
import { ArrowTool } from './tools/arrow-tool';
import { FreehandTool } from './tools/freehand-tool';
import { RectTool } from './tools/rect-tool';
import { TextTool } from './tools/text-tool';

export interface AnnotatorOptions {
    onChange: (annotations: Annotation[]) => void;
    sessionId: string;
    onPause?: () => void;
    onResume?: () => void;
    onStop?: () => void;
}

export class Annotator {
    private options: AnnotatorOptions;
    private canvasLayer = new CanvasLayer();
    private toolbar: Toolbar;
    private activeTool: BaseTool | null = null;
    private isVisible = false;

    constructor(options: AnnotatorOptions) {
        this.options = options;
        this.canvasLayer.onObjectsChanged(() => {
            this.options.onChange(this.canvasLayer.toAnnotations());
        });
        this.toolbar = new Toolbar({
            onPause: () => options.onPause?.(), onResume: () => options.onResume?.(), onStop: () => options.onStop?.(),
            onToolSelect: (tool: AnnotationToolType | null) => this.switchTool(tool),
            onColorChange: () => { if (this.activeTool) { const t = this.getActiveToolType(); if (t) this.switchTool(t); } },
            onUndo: () => this.undo(), onClearAll: () => this.clearAll(),
        });
    }

    show(): void { if (this.isVisible) return; this.isVisible = true; this.canvasLayer.show(this.options.sessionId); this.toolbar.show(); }
    hide(): void { if (!this.isVisible) return; this.isVisible = false; if (this.activeTool) { this.activeTool.deactivate(); this.activeTool = null; } this.canvasLayer.setInteractive(false); this.canvasLayer.hide(); this.toolbar.hide(); }
    setPaused(): void { this.toolbar.setPaused(); }
    setResumed(): void { this.toolbar.setResumed(); }

    private switchTool(type: AnnotationToolType | null): void {
        if (this.activeTool) { this.activeTool.deactivate(); this.activeTool = null; }
        if (type === null) {
            this.canvasLayer.setInteractive(false);
            return;
        }
        this.canvasLayer.setInteractive(true);
        const opts = { canvasLayer: this.canvasLayer, color: this.toolbar.currentColor };
        switch (type) { case 'rect': this.activeTool = new RectTool(opts); break; case 'arrow': this.activeTool = new ArrowTool(opts); break; case 'text': this.activeTool = new TextTool(opts); break; case 'freehand': this.activeTool = new FreehandTool(opts); break; }
        this.activeTool?.activate();
    }

    private getActiveToolType(): AnnotationToolType | null {
        if (this.activeTool instanceof RectTool) return 'rect'; if (this.activeTool instanceof ArrowTool) return 'arrow'; if (this.activeTool instanceof TextTool) return 'text'; if (this.activeTool instanceof FreehandTool) return 'freehand'; return null;
    }

    undo(): void { this.canvasLayer.undoLast(); }
    clearAll(): void { this.canvasLayer.clearAll(); }
    getAnnotations(): Annotation[] { return this.canvasLayer.toAnnotations(); }
}
