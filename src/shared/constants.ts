// ============================================================
// src/shared/constants.ts — 全局常量定义
// ============================================================

/** 插件名称 */
export const EXTENSION_NAME = 'BugReplay';

/** 插件版本（与 package.json 同步） */
export const EXTENSION_VERSION = '1.0.0';

/** 录制会话最大时长 (ms) — 30 分钟 */
export const MAX_RECORDING_DURATION = 30 * 60 * 1000;

/** 默认录制标题前缀 */
export const DEFAULT_RECORDING_TITLE_PREFIX = 'BugReplay';

/** IndexedDB 数据库名称 */
export const DB_NAME = 'bugreplay_db';

/** IndexedDB 数据库版本 */
export const DB_VERSION = 1;

/** IndexedDB Object Store 名称 */
export const STORE_SESSIONS = 'recording_sessions';

/** Content Script 安全序列化最大深度 */
export const MAX_SERIALIZE_DEPTH = 5;

/** 单个 JSON 参数最大序列化长度 */
export const MAX_ARG_SERIALIZE_LENGTH = 5000;

/** .rrt 文件名日期格式 */
export const RRT_FILENAME_DATE_FORMAT = 'YYYY-MM-DD_HH-mm-ss';

/** 标注步骤编号前缀 */
export const ANNOTATION_STEP_PREFIX = 'Step';
