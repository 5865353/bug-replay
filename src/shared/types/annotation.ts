// ============================================================
// src/shared/types/annotation.ts — 标注数据类型定义
// ============================================================

/** 标注工具类型枚举 */
export type AnnotationToolType = 'rect' | 'arrow' | 'text' | 'freehand';

/** 标注基础属性 */
export interface AnnotationBase {
    /** 唯一标识（UUID） */
    id: string;
    /** 工具类型 */
    type: AnnotationToolType;
    /** 创建时间戳 (ms)，用于回放时按时间轴叠加显示 */
    timestamp: number;
    /** 删除时间戳 (ms)，有值表示已删除，回放时到该时间点后隐藏 */
    deletedAt?: number;
    /** 自动步骤编号（如 "Step 1", "Step 2"） */
    stepNumber?: number;
    /** 所属录制会话 ID */
    sessionId: string;
}

/** 矩形框选标注 */
export interface RectAnnotation extends AnnotationBase {
    type: 'rect';
    data: {
        /** 左上角 X 坐标（相对于视口） */
        x: number;
        /** 左上角 Y 坐标（相对于视口） */
        y: number;
        /** 矩形宽度 */
        width: number;
        /** 矩形高度 */
        height: number;
        /** 边框颜色（十六进制） */
        strokeColor: string;
        /** 边框宽度 (px) */
        strokeWidth: number;
        /** 填充颜色（含透明度，如 "rgba(255,0,0,0.15)"） */
        fillColor?: string;
        /** 附加备注文本 */
        comment?: string;
    };
}

/** 箭头指向标注 */
export interface ArrowAnnotation extends AnnotationBase {
    type: 'arrow';
    data: {
        /** 起点 X */
        startX: number;
        /** 起点 Y */
        startY: number;
        /** 终点 X（箭头指向） */
        endX: number;
        /** 终点 Y（箭头指向） */
        endY: number;
        /** 箭头颜色 */
        color: string;
        /** 线宽 */
        lineWidth: number;
        /** 附加备注文本 */
        comment?: string;
    };
}

/** 文本批注标注 */
export interface TextAnnotation extends AnnotationBase {
    type: 'text';
    data: {
        /** 文本左上角 X */
        x: number;
        /** 文本左上角 Y */
        y: number;
        /** 批注文本内容 */
        text: string;
        /** 字号 (px) */
        fontSize: number;
        /** 字体族 */
        fontFamily: string;
        /** 文字颜色 */
        color: string;
        /** 背景色 */
        backgroundColor?: string;
        /** 最大宽度（超出自动换行） */
        maxWidth?: number;
    };
}

/** 自由画笔标注 */
export interface FreehandAnnotation extends AnnotationBase {
    type: 'freehand';
    data: {
        /** 笔画路径点数组 */
        points: Array<{ x: number; y: number }>;
        /** 画笔颜色 */
        color: string;
        /** 画笔线宽 */
        lineWidth: number;
    };
}

/** 标注联合类型 */
export type Annotation
    = | RectAnnotation
        | ArrowAnnotation
        | TextAnnotation
        | FreehandAnnotation;

/** 工具栏预设颜色 */
export const ANNOTATION_COLORS = [
    '#EF4444', // 红色
    '#F97316', // 橙色
    '#EAB308', // 黄色
    '#22C55E', // 绿色
    '#3B82F6', // 蓝色
    '#A855F7' // 紫色
];

/** 默认标注配置 */
export const DEFAULT_ANNOTATION_CONFIG = {
    strokeColor: '#EF4444',
    strokeWidth: 3,
    fillColor: 'rgba(239, 68, 68, 0.15)',
    fontSize: 16,
    fontFamily: 'system-ui, sans-serif',
    textColor: '#EF4444',
    textBackgroundColor: 'rgba(255, 255, 255, 0.9)',
    lineWidth: 3
} as const;
