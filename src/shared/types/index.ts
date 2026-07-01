// ============================================================
// src/shared/types/index.ts — 统一导出
// ============================================================

// 导入本地使用的类型（export type from 只重导出，不引入本地作用域）
import type { RecordingSession, RecordingStatus } from './recording';

export type {
    Annotation,
    AnnotationBase,
    AnnotationToolType,
    ArrowAnnotation,
    FreehandAnnotation,
    RectAnnotation,
    TextAnnotation,
} from './annotation';
export {
    ANNOTATION_COLORS,
    DEFAULT_ANNOTATION_CONFIG,
} from './annotation';

export type {
    ConsoleLevel,
    ConsoleLog,
} from './console';
export { CAPTURE_STACK_LEVELS, CONSOLE_LEVEL_COLORS } from './console';

export type { EnvironmentSnapshot } from './environment';

export type {
    HttpMethod,
    NetworkLog,
} from './network';
export { MAX_RESPONSE_BODY_SIZE, SENSITIVE_HEADERS } from './network';

export type {
    RecordingSession,
    RecordingStatus,
} from './recording';

export type {
    ReplayState,
    RRTPackage,
    RRTPackageMetadata,
    rrwebEvent,
} from './rrt-package';
export {
    REPLAY_SPEEDS,
    RRT_FILE_EXTENSION,
    RRT_FORMAT_VERSION,
    RRT_MIME_TYPE,
} from './rrt-package';

// ============================================================
// 消息协议类型（Content Script ↔ Service Worker）
// ============================================================

/** Content Script → Service Worker 消息类型 */
export type ContentToBackgroundAction
    = | 'START_RECORDING'
        | 'STOP_RECORDING'
        | 'PAUSE_RECORDING'
        | 'RESUME_RECORDING'
        | 'EXPORT_RRT'
        | 'SUBMIT_TO_PLATFORM'
        | 'GET_SESSIONS'
        | 'DELETE_SESSION'
        | 'UPDATE_SESSION_META'
        | 'GET_RECORDING_STATUS';

/** Content Script → Service Worker 消息体 */
export interface ContentToBackgroundMessage {
    action: ContentToBackgroundAction;
    payload?: unknown;
    /** 请求 ID，用于匹配响应 */
    requestId?: string;
}

/** Service Worker → Content Script 消息类型 */
export type BackgroundToContentAction
    = | 'RECORDING_STARTED'
        | 'RECORDING_STOPPED'
        | 'RECORDING_PAUSED'
        | 'RECORDING_RESUMED'
        | 'EXPORT_READY'
        | 'SESSIONS_LIST'
        | 'SESSION_DELETED'
        | 'SESSION_UPDATED'
        | 'RECORDING_STATUS'
        | 'ERROR';

/** Service Worker → Content Script 消息体 */
export interface BackgroundToContentMessage {
    action: BackgroundToContentAction;
    payload?: unknown;
    /** 匹配请求的 requestId */
    requestId?: string;
}

// ============================================================
// Popup UI 状态
// ============================================================

/** Popup 窗口状态 */
export interface PopupState {
    /** 当前录制状态 */
    recordingStatus: RecordingStatus;
    /** 当前活跃的录制会话 */
    activeSession: RecordingSession | null;
    /** 历史会话列表 */
    sessions: RecordingSessionSummary[];
}

/** 录制会话摘要（列表展示用） */
export interface RecordingSessionSummary {
    id: string;
    title: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    tags: string[];
    hasAnnotations: boolean;
    networkLogCount: number;
    consoleLogCount: number;
}
