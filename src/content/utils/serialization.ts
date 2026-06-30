/**
 * src/content/utils/serialization.ts
 *
 * 序列化辅助工具 — 处理循环引用、特殊类型的安全序列化
 * 更高级的序列化逻辑在 @shared/utils.ts 中的 safeStringify 已实现，
 * 此文件提供 Content Script 场景下的额外序列化实用函数。
 *
 * TODO M2: 按需扩展
 */

export { safeStringify, serializeConsoleArgs } from '@shared/utils';
