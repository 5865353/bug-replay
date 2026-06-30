// ============================================================
// src/shared/types/console.ts — 控制台日志类型定义
// ============================================================

/** 控制台日志级别 */
export type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

/** 控制台日志记录 */
export interface ConsoleLog {
    /** 唯一标识 */
    id: string;
    /** 日志级别 */
    level: ConsoleLevel;
    /** 参数列表（安全序列化后的字符串数组，每个参数独立序列化） */
    args: string[];
    /** 触发时间戳 (ms) */
    timestamp: number;
    /** 调用栈字符串（仅 error / warn 级别采集） */
    stackTrace?: string;
    /** 触发时对应的 rrweb 事件在事件流中的序号（用于回放时对齐高亮） */
    rrwebEventIndex?: number;
}

/** 日志级别对应的显示颜色 */
export const CONSOLE_LEVEL_COLORS: Record<ConsoleLevel, string> = {
    log: '#9CA3AF', // 灰色
    info: '#3B82F6', // 蓝色
    warn: '#F59E0B', // 黄色
    error: '#EF4444', // 红色
    debug: '#8B5CF6', // 紫色
};

/** 需要采集调用栈的日志级别 */
export const CAPTURE_STACK_LEVELS: ConsoleLevel[] = ['warn', 'error'];
