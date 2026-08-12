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

export type { CookieEntry, EnvironmentSnapshot } from './environment';

export type {
    HttpMethod,
    NetworkLog,
} from './network';
export { MAX_RESPONSE_BODY_SIZE, SENSITIVE_HEADERS } from './network';

export type {
    PageEvent,
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
// 禅道平台类型
// ============================================================

/** 禅道产品（提交 Bug 时用于选择目标产品） */
export interface ZentaoProduct {
    id: number;
    name: string;
}

/** 禅道产品列表查询结果 */
export interface ZentaoProductsResult {
    success: boolean;
    products?: ZentaoProduct[];
    error?: string;
}

/** 禅道项目（提交 Bug 时用于选择目标项目） */
export interface ZentaoProject {
    id: number;
    name: string;
}

/** 禅道项目列表查询结果 */
export interface ZentaoProjectsResult {
    success: boolean;
    projects?: ZentaoProject[];
    error?: string;
}

// ============================================================
// 消息协议类型（Content Script ↔ Service Worker）
// ============================================================

/** Content Script → Service Worker 消息类型 */
export enum ContentToBackgroundAction {
    START_RECORDING = 'START_RECORDING',
    STOP_RECORDING = 'STOP_RECORDING',
    PAUSE_RECORDING = 'PAUSE_RECORDING',
    RESUME_RECORDING = 'RESUME_RECORDING',
    EXPORT_RRT = 'EXPORT_RRT',
    SUBMIT_TO_PLATFORM = 'SUBMIT_TO_PLATFORM',
    GET_ZENTAO_PRODUCTS = 'GET_ZENTAO_PRODUCTS',
    GET_ZENTAO_PROJECTS = 'GET_ZENTAO_PROJECTS',
    GET_SESSIONS = 'GET_SESSIONS',
    GET_SESSION = 'GET_SESSION',
    DELETE_SESSION = 'DELETE_SESSION',
    DELETE_ALL_SESSIONS = 'DELETE_ALL_SESSIONS',
    UPDATE_SESSION_META = 'UPDATE_SESSION_META',
    GET_RECORDING_STATUS = 'GET_RECORDING_STATUS',
}

/** Content Script → Service Worker 消息体 */
export interface ContentToBackgroundMessage {
    action: ContentToBackgroundAction;
    payload?: unknown;
    /** 请求 ID，用于匹配响应 */
    requestId?: string;
}

/** Service Worker → Content Script 消息类型 */
export enum BackgroundToContentAction {
    RECORDING_STARTED = 'RECORDING_STARTED',
    RECORDING_STOPPED = 'RECORDING_STOPPED',
    RECORDING_PAUSED = 'RECORDING_PAUSED',
    RECORDING_RESUMED = 'RECORDING_RESUMED',
    EXPORT_READY = 'EXPORT_READY',
    ZENTAO_PRODUCTS = 'ZENTAO_PRODUCTS',
    ZENTAO_PROJECTS = 'ZENTAO_PROJECTS',
    SESSIONS_LIST = 'SESSIONS_LIST',
    SESSION_DATA = 'SESSION_DATA',
    SESSION_DELETED = 'SESSION_DELETED',
    SESSIONS_CLEARED = 'SESSIONS_CLEARED',
    SESSION_UPDATED = 'SESSION_UPDATED',
    RECORDING_STATUS = 'RECORDING_STATUS',
    ERROR = 'ERROR',
}

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
