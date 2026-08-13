/**
 * src/content/composables/useAnnotator.ts — Annotator composable (hooks pattern)
 */

import type { Annotation, AnnotationToolType } from '@shared/types';
import type { BaseTool } from '../annotator/tools/base-tool';
import { CanvasLayer } from '../annotator/canvas-layer';
import { Toolbar } from '../annotator/toolbar';
import { ArrowTool } from '../annotator/tools/arrow-tool';
import { FreehandTool } from '../annotator/tools/freehand-tool';
import { RectTool } from '../annotator/tools/rect-tool';
import { TextTool } from '../annotator/tools/text-tool';

export interface AnnotatorHooks {
    sessionId: string;
    onChange: (annotations: Annotation[]) => void;
    onPause?: () => void;
    onResume?: () => void;
    onStop?: () => void;
}

export function useAnnotator(hooks: AnnotatorHooks) {
    const canvasLayer = new CanvasLayer();
    let activeTool: BaseTool | null = null;
    let isVisible = false;

    canvasLayer.onObjectsChanged(() => {
        hooks.onChange(canvasLayer.toAnnotations());
    });

    const toolbar = new Toolbar({
        onPause: () => hooks.onPause?.(),
        onResume: () => hooks.onResume?.(),
        onStop: () => hooks.onStop?.(),
        onToolSelect: (tool: AnnotationToolType | null) => switchTool(tool),
        onColorChange: () => {
            if (activeTool) {
                const t = getActiveToolType();
                if (t) switchTool(t);
            }
        },
        onUndo: () => undo(),
        onClearAll: () => clearAll()
    });

    function switchTool(type: AnnotationToolType | null): void {
        if (activeTool) {
            activeTool.deactivate();
            activeTool = null;
        }
        if (type === null) {
            canvasLayer.setInteractive(false);
            return;
        }
        canvasLayer.setInteractive(true);
        const opts = { canvasLayer, color: toolbar.currentColor };
        switch (type) {
            case 'rect':
                activeTool = new RectTool(opts);
                break;
            case 'arrow':
                activeTool = new ArrowTool(opts);
                break;
            case 'text':
                activeTool = new TextTool(opts);
                break;
            case 'freehand':
                activeTool = new FreehandTool(opts);
                break;
        }
        activeTool?.activate();
    }

    function getActiveToolType(): AnnotationToolType | null {
        if (activeTool instanceof RectTool) return 'rect';
        if (activeTool instanceof ArrowTool) return 'arrow';
        if (activeTool instanceof TextTool) return 'text';
        if (activeTool instanceof FreehandTool) return 'freehand';
        return null;
    }

    function show(sessionId: string): void {
        if (isVisible) return;
        isVisible = true;
        canvasLayer.show(sessionId);
        toolbar.show();
    }

    function hide(): void {
        if (!isVisible) return;
        isVisible = false;
        if (activeTool) {
            activeTool.deactivate();
            activeTool = null;
        }
        canvasLayer.setInteractive(false);
        canvasLayer.hide();
        toolbar.hide();
    }

    function setPaused(): void {
        toolbar.setPaused();
    }
    function setResumed(): void {
        toolbar.setResumed();
    }
    function undo(): void {
        canvasLayer.undoLast();
    }
    function clearAll(): void {
        canvasLayer.clearAll();
    }
    function getAnnotations(): Annotation[] {
        return canvasLayer.toAnnotations();
    }

    return {
        show,
        hide,
        setPaused,
        setResumed,
        undo,
        clearAll,
        getAnnotations,
        toolbar,
        canvasLayer
    };
}
