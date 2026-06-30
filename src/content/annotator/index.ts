/**
 * src/content/annotator/index.ts — Annotator 统一入口
 *
 * 标注模块总控制器：
 * - 创建 Canvas 覆盖层
 * - 管理悬浮工具栏
 * - 协调各绘图工具
 * - 管理标注数据的增删改查
 * - 步骤编号自动递增
 */

import type { Annotation, AnnotationToolType } from '@shared/types';
import { ANNOTATION_STEP_PREFIX } from '@shared/constants';
import { AnnotationManager } from './annotation-manager';
import { CanvasLayer } from './canvas-layer';
import { Toolbar } from './toolbar';
import { ArrowTool } from './tools/arrow-tool';
import { BaseTool } from './tools/base-tool';
import { FreehandTool } from './tools/freehand-tool';
import { RectTool } from './tools/rect-tool';
import { TextTool } from './tools/text-tool';

export interface AnnotatorOptions {
    /** 标注数据变更回调 */
    onChange: (annotations: Annotation[]) => void;
    /** 录制会话 ID */
    sessionId: string;
}

export class Annotator {
    private options: AnnotatorOptions;
    private annotationManager = new AnnotationManager();
    private canvasLayer = new CanvasLayer();
    private toolbar: Toolbar;
    private activeTool: BaseTool | null = null;
    private isVisible = false;

    constructor(options: AnnotatorOptions) {
        this.options = options;

        this.toolbar = new Toolbar({
            onToolSelect: (tool: AnnotationToolType | null) => this.switchTool(tool),
            onColorChange: (_color: string) => {
                // 颜色变更时，如果当前工具有效则重新创建
                if (this.activeTool) {
                    const toolType = this.getActiveToolType();
                    if (toolType) {
                        this.switchTool(toolType);
                    }
                }
            },
            onUndo: () => this.undo(),
            onClearAll: () => this.clearAll(),
        });
    }

    /**
     * 显示标注工具栏和覆盖层
     */
    show(): void {
        if (this.isVisible) return;
        this.isVisible = true;

        this.canvasLayer.show();
        this.toolbar.show();

        console.log('[BugReplay] Annotator shown');
    }

    /**
     * 隐藏标注工具栏和覆盖层
     */
    hide(): void {
        if (!this.isVisible) return;
        this.isVisible = false;

        // 停用当前工具
        if (this.activeTool) {
            this.activeTool.deactivate();
            this.activeTool = null;
        }

        this.canvasLayer.hide();
        this.toolbar.hide();

        console.log('[BugReplay] Annotator hidden');
    }

    /**
     * 切换当前激活的绘图工具
     */
    private switchTool(type: AnnotationToolType | null): void {
        // 停用当前工具
        if (this.activeTool) {
            this.activeTool.deactivate();
            this.activeTool = null;
        }

        if (type === null) return;

        // 创建新工具
        const toolOptions = {
            canvasLayer: this.canvasLayer,
            sessionId: this.options.sessionId,
            color: this.toolbar.currentColor,
            onComplete: (annotation: Annotation) => this.onAnnotationComplete(annotation),
        };

        switch (type) {
            case 'rect':
                this.activeTool = new RectTool(toolOptions);
                break;
            case 'arrow':
                this.activeTool = new ArrowTool(toolOptions);
                break;
            case 'text':
                this.activeTool = new TextTool(toolOptions);
                break;
            case 'freehand':
                this.activeTool = new FreehandTool(toolOptions);
                break;
        }

        this.activeTool.activate();
    }

    /**
     * 标注完成回调
     */
    private onAnnotationComplete(annotation: Annotation): void {
        // 添加步骤编号
        const count = this.annotationManager.count;
        annotation.stepNumber = count + 1;

        // 存储标注
        this.annotationManager.add(annotation);

        // 通知外部
        this.options.onChange(this.annotationManager.getAll());

        console.log(
            `[BugReplay] Annotation added: ${ANNOTATION_STEP_PREFIX} ${annotation.stepNumber} (${annotation.type})`,
        );
    }

    /**
     * 获取当前工具类型（用于重建）
     */
    private getActiveToolType(): AnnotationToolType | null {
        if (this.activeTool instanceof RectTool) return 'rect';
        if (this.activeTool instanceof ArrowTool) return 'arrow';
        if (this.activeTool instanceof TextTool) return 'text';
        if (this.activeTool instanceof FreehandTool) return 'freehand';
        return null;
    }

    /**
     * 撤销最后一条标注
     */
    undo(): void {
        const lastAnnotation = this.annotationManager.getAll().pop();
        if (lastAnnotation) {
            this.annotationManager.remove(lastAnnotation.id);
            this.canvasLayer.redrawAll(this.annotationManager.getAll());
            this.options.onChange(this.annotationManager.getAll());
        }
    }

    /**
     * 清除所有标注
     */
    clearAll(): void {
        this.annotationManager.clear();
        this.canvasLayer.clear();
        this.options.onChange([]);
    }

    /**
     * 获取当前所有标注
     */
    getAnnotations(): Annotation[] {
        return this.annotationManager.getAll();
    }

    /**
     * 是否正在显示
     */
    get visible(): boolean {
        return this.isVisible;
    }
}
