// ============================================================
// src/shared/types/rrt-package.ts — .rrt 打包格式定义
// ============================================================

import type { Annotation } from './annotation';
import type { ConsoleLog } from './console';
import type { EnvironmentSnapshot } from './environment';
import type { NetworkLog } from './network';

// ============================================================
// rrweb 事件类型引用
// ============================================================

/**
 * rrweb 事件类型（避免硬依赖 rrweb 类型定义）
 * 实际运行时与 rrweb 的 eventWithTime 兼容
 */
export interface rrwebEvent {
    type: number;
    data: unknown;
    timestamp: number;
    delay?: number;
    [key: string]: unknown;
}

// ============================================================
// .rrt 打包结构
// ============================================================

/** .rrt 文件格式版本 */
export const RRT_FORMAT_VERSION = '1.0.0';

/** .rrt 文件扩展名 */
export const RRT_FILE_EXTENSION = '.rrt';

/** .rrt 文件 MIME 类型 */
export const RRT_MIME_TYPE = 'application/json';

/**
 * RRTPackage — .rrt 文件顶层结构
 *
 * 这是 BugReplay 录制数据的完整序列化格式。
 * 包含 DOM 事件流、网络日志、控制台日志、标注数据、环境快照。
 */
export interface RRTPackage {
    /** .rrt 格式版本号 */
    version: string;
    /** 文件导出时间戳 */
    exportedAt: number;
    /** 元数据 */
    metadata: RRTPackageMetadata;
    /** 环境快照 */
    environment: EnvironmentSnapshot;
    /** rrweb DOM 事件流（eventWithTime 数组） */
    rrwebEvents: rrwebEvent[];
    /** 网络请求日志 */
    networkLogs: NetworkLog[];
    /** 控制台日志 */
    consoleLogs: ConsoleLog[];
    /** 标注数据 */
    annotations: Annotation[];
}

/** .rrt 包元数据 */
export interface RRTPackageMetadata {
    /** 录制标题 */
    title: string;
    /** 录制时长 (ms) */
    duration: number;
    /** Bug 描述 */
    description?: string;
    /** 用户标签 */
    tags: string[];
    /** BugReplay 插件版本号 */
    extensionVersion: string;
    /** 创建者标识 */
    createdBy?: string;
    /** 关联的外部 Bug ID */
    externalIssueId?: string;
}

// ============================================================
// 回放相关类型
// ============================================================

/** 回放器状态 */
export interface ReplayState {
    /** 是否正在播放 */
    isPlaying: boolean;
    /** 当前播放时间 (ms) */
    currentTime: number;
    /** 总时长 (ms) */
    totalTime: number;
    /** 播放速度倍率 */
    speed: number;
    /** 是否显示标注图层 */
    showAnnotations: boolean;
    /** 侧边栏当前活跃标签 */
    activeTab: 'console' | 'network';
}

/** 回放器支持的播放速度 */
export const REPLAY_SPEEDS = [0.5, 1, 2, 4] as const;
