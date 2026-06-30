/**
 * src/content/utils/dom-utils.ts
 *
 * DOM 辅助工具
 *
 * TODO M2: 按需扩展 DOM 操作辅助函数
 */

/**
 * 安全获取元素的计算样式
 */
export function getComputedStyleSafe(el: Element, property: string): string {
    try {
        return window.getComputedStyle(el).getPropertyValue(property);
    }
    catch {
        return '';
    }
}

/**
 * 判断元素是否在视口内
 */
export function isElementInViewport(el: Element): boolean {
    const rect = el.getBoundingClientRect();
    return (
        rect.top < window.innerHeight
        && rect.bottom > 0
        && rect.left < window.innerWidth
        && rect.right > 0
    );
}
