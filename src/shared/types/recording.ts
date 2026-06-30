// ============================================================
// src/shared/types/recording.ts — 录制会话类型定义
// ============================================================

import type { Annotation } from './annotation';
import type { ConsoleLog } from './console';
import type { EnvironmentSnapshot } from './environment';
import type { NetworkLog } from './network';
import type { rrwebEvent } from './rrt-package';

/** 录制状态 */
export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped';

/** 录制会话（运行时的完整数据结构） */
export interface RecordingSession {
    /** 会话唯一标识（UUID） */
    id: string;
    /** 录制标题（可自定义，默认 "{页面标题} - {日期}"） */
    title: string;
    /** 录制状态 */
    status: RecordingStatus;
    /** 录制开始时间戳 (Date.now()) */
    startTime: number;
    /** 录制结束时间戳 */
    endTime?: number;
    /** rrweb 事件流（录制过程中实时追加） */
    events: rrwebEvent[];
    /** 网络日志列表（录制过程中实时追加） */
    networkLogs: NetworkLog[];
    /** 控制台日志列表（录制过程中实时追加） */
    consoleLogs: ConsoleLog[];
    /** 标注列表（录制过程中实时追加） */
    annotations: Annotation[];
    /** 环境快照（录制开始时采集） */
    environment: EnvironmentSnapshot | null;
    /** 用户自定义标签 */
    tags: string[];
    /** Bug 描述（用户填写） */
    description?: string;
    /** 关联的外部 Bug ID（提交到 Jira/禅道 后回填） */
    externalIssueId?: string;
    /** 关联的外部平台名称 */
    externalPlatform?: 'jira' | 'zentao';
}
