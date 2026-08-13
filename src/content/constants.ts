/**
 * src/content/constants.ts — Content Script 专用常量
 *
 * 集中管理 content/ 目录下散布的字面量常量（postMessage 标识、元素 ID、
 * z-index 层级、标注相关的魔法数字、工具栏颜色/尺寸等）。
 */

// ============================================================
// postMessage 通信标识（content-script.ts ↔ page-interceptor.js）
// ============================================================

/** 页面主世界 → Content Script：网络日志 */
export const PM_SOURCE_NETWORK = 'bugreplay-network' as const;
/** 页面主世界 → Content Script：页面事件（URL/Storage） */
export const PM_SOURCE_PAGE_EVENT = 'bugreplay-page-event' as const;
/** Content Script → 页面主世界：控制指令 */
export const PM_SOURCE_CONTROL = 'bugreplay-control' as const;

/** 控制指令：开始上报 */
export const PM_ACTION_START = 'start' as const;
/** 控制指令：停止上报 */
export const PM_ACTION_STOP = 'stop' as const;

/** postMessage 通配目标源 */
export const PM_TARGET_ORIGIN = '*' as const;

// ============================================================
// DOM 元素 ID
// ============================================================

export const ID_CANVAS_LAYER = 'bugreplay-canvas-layer' as const;
export const ID_FABRIC_CANVAS = 'bugreplay-fabric-canvas' as const;
export const ID_TOOLBAR = 'bugreplay-toolbar' as const;

// ============================================================
// z-index 层级（保证工具栏 > 画布层的叠加顺序）
// ============================================================

/** Canvas 画布层 z-index */
export const Z_INDEX_CANVAS = 2147483646;
/** 工具栏及提示面板 z-index */
export const Z_INDEX_TOOLBAR = 2147483647;

// ============================================================
// 拦截器脚本路径
// ============================================================

export const INTERCEPTOR_SCRIPT_PATH = 'src/content/recorder/page-interceptor.js' as const;

// ============================================================
// 禅道附件回放（useZentaoReplay.ts ↔ zentao-helper.js postMessage 协议）
// ============================================================

/** helper 脚本路径（manifest.config.ts 的 web_accessible_resources 需同步引用） */
export const ZENTAO_HELPER_SCRIPT_PATH = 'src/content/zentao/zentao-helper.js' as const;
/** helper 脚本注入用的元素 ID / 全局标记（与 zentao-helper.js 内 FLAG 保持一致） */
export const ZENTAO_HELPER_ELEMENT_ID = '__bugreplay_zentao_helper__' as const;
/** 禅道 postMessage 协议：source 标识 */
export const ZENTAO_MSG_SOURCE = 'bugreplay-zentao' as const;
/** 禅道 postMessage 协议：消息类型 */
export const ZENTAO_MSG_PING = 'PING' as const;
export const ZENTAO_MSG_READY = 'READY' as const;
export const ZENTAO_MSG_DOWNLOAD = 'DOWNLOAD' as const;
export const ZENTAO_MSG_RESULT = 'RESULT' as const;

// ============================================================
// 标注画布 (CanvasLayer) 相关常量
// ============================================================

/** 矩形默认圆角半径 (px) */
export const RECT_CORNER_RADIUS = 4;

/** 填充透明度后缀（hex 颜色后拼接，如 "#ff000020"） */
export const FILL_OPACITY_RECT = '20' as const;
/** 文本背景透明度后缀 */
export const FILL_OPACITY_TEXT = '15' as const;

/** 文本标注默认内边距 (px) */
export const TEXT_PADDING = 6;
/** 文本进入编辑模式的延迟 (ms) */
export const TEXT_EDIT_DELAY = 50;
/** 文本占位符 */
export const TEXT_PLACEHOLDER = '输入批注...' as const;

/** 箭头头部尺寸 (px) */
export const ARROW_HEAD_SIZE = 14;
/** 箭头头部张角的一半 */
export const ARROW_HEAD_ANGLE = Math.PI / 6;
/** 箭头头部三角形 strokeWidth */
export const ARROW_HEAD_STROKE_WIDTH = 2;

// ============================================================
// 工具激活阈值
// ============================================================

/** 矩形工具：最小有效尺寸 (px)，低于此值视为误触 */
export const RECT_MIN_SIZE = 5;
/** 箭头工具：最小有效距离 (px) */
export const ARROW_MIN_DISTANCE = 10;

/** 预览虚线样式 */
export const PREVIEW_DASH_ARRAY = [6, 3] as const;
/** 预览填充透明度后缀 */
export const PREVIEW_FILL_OPACITY = '18' as const;
/** 预览线宽 */
export const PREVIEW_STROKE_WIDTH = 2;

// ============================================================
// 光标类型
// ============================================================

export const CURSOR_CROSSHAIR = 'crosshair' as const;
export const CURSOR_TEXT = 'text' as const;
export const CURSOR_DEFAULT = 'default' as const;

// ============================================================
// 工具栏 (Toolbar) 颜色
// ============================================================

/** 录制指示器 / 计时器颜色 */
export const COLOR_RECORDING = '#ef4444' as const;
/** 图标/文字主色 */
export const COLOR_ICON_PRIMARY = '#374151' as const;
/** 按钮 hover 背景色 */
export const COLOR_HOVER_BG = '#f3f4f6' as const;
/** 分割线 / 边框色 */
export const COLOR_DIVIDER = '#e5e7eb' as const;
/** 拖拽手柄颜色 */
export const COLOR_DRAG_HANDLE = '#9ca3af' as const;
/** 提示面板背景色 */
export const COLOR_HINT_BG = '#1f2937' as const;
/** 提示面板文字色 */
export const COLOR_HINT_TEXT = '#f9fafb' as const;
/** 绘制 badge 渐变起始色 */
export const COLOR_BADGE_START = '#6467f0' as const;
/** 绘制 badge 渐变结束色 */
export const COLOR_BADGE_END = '#8b5cf6' as const;
/** 提示面板高亮色 */
export const COLOR_HINT_ACCENT = '#cba6f7' as const;

// ============================================================
// 工具栏 (Toolbar) 尺寸与布局
// ============================================================

/** 工具栏圆角 */
export const TOOLBAR_BORDER_RADIUS = 12;
/** 工具栏内边距 */
export const TOOLBAR_PADDING = '6px 10px' as const;
/** 工具栏组件间距 */
export const TOOLBAR_GAP = 6;
/** 图标按钮尺寸 (px) */
export const ICON_BTN_SIZE = 34;
/** 图标按钮圆角 */
export const ICON_BTN_RADIUS = 8;
/** 颜色选择器尺寸 (px) */
export const COLOR_PICKER_SIZE = 26;
/** 分割线高度 (px) */
export const DIVIDER_HEIGHT = 24;
/** 录制指示点尺寸 (px) */
export const DOT_SIZE = 8;
/** 计时器字号 (px) */
export const TIMER_FONT_SIZE = 13;
/** 绘制 badge 字号 (px) */
export const BADGE_FONT_SIZE = 11;
/** 工具栏距底部距离 (px) */
export const TOOLBAR_BOTTOM = 24;
/** 拖拽最小边距 (px) */
export const DRAG_MARGIN = 8;

// ============================================================
// 计时器
// ============================================================

/** 计时器刷新间隔 (ms) */
export const TIMER_INTERVAL = 1000;
/** 计时器初始显示 */
export const TIMER_INITIAL = '00:00' as const;

// ============================================================
// Fabric 事件名
// ============================================================

export const FABRIC_EVENT_MOUSE_DOWN = 'mouse:down' as const;
export const FABRIC_EVENT_MOUSE_MOVE = 'mouse:move' as const;
export const FABRIC_EVENT_MOUSE_UP = 'mouse:up' as const;
export const FABRIC_EVENT_OBJECT_MODIFIED = 'object:modified' as const;
export const FABRIC_EVENT_PATH_CREATED = 'path:created' as const;

// ============================================================
// DOM 事件名
// ============================================================

export const DOM_EVENT_KEYDOWN = 'keydown' as const;
export const DOM_EVENT_RESIZE = 'resize' as const;
export const DOM_EVENT_WHEEL = 'wheel' as const;
export const DOM_EVENT_MOUSE_DOWN = 'mousedown' as const;
export const DOM_EVENT_MOUSE_MOVE = 'mousemove' as const;
export const DOM_EVENT_MOUSE_UP = 'mouseup' as const;
export const DOM_EVENT_MOUSE_ENTER = 'mouseenter' as const;
export const DOM_EVENT_MOUSE_LEAVE = 'mouseleave' as const;
export const DOM_EVENT_CLICK = 'click' as const;
export const DOM_EVENT_INPUT = 'input' as const;

/** Delete 键 */
export const KEY_DELETE = 'Delete' as const;

// ============================================================
// pointer-events / touch-action 值
// ============================================================

export const POINTER_EVENTS_NONE = 'none' as const;
export const POINTER_EVENTS_AUTO = 'auto' as const;
export const TOUCH_ACTION_NONE = 'none' as const;

// ============================================================
// 录制状态标签
// ============================================================

export const LABEL_PAUSE = '暂停录制' as const;
export const LABEL_RESUME = '继续录制' as const;
export const LABEL_STOP = '停止录制' as const;
export const LABEL_UNDO = '撤销' as const;
export const LABEL_CLEAR_ALL = '清除全部' as const;
export const LABEL_PICK_COLOR = '选择颜色' as const;

// ============================================================
// Console 拦截器
// ============================================================

export const CONSOLE_LEVELS = ['log', 'info', 'warn', 'error', 'debug'] as const;

// ============================================================
// 存储 key 前缀
// ============================================================

export const STORAGE_KEY_PREFIX = 'temp_session_' as const;
