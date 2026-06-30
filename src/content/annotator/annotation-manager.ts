/**
 * src/content/annotator/annotation-manager.ts
 *
 * 标注数据管理器 — 管理标注的增删改查和时序索引
 *
 * TODO M3: 实现完整的标注 CRUD
 */

import type { Annotation } from '@shared/types';

export class AnnotationManager {
    private annotations: Annotation[] = [];

    /**
     * 添加标注
     */
    add(annotation: Annotation): void {
        this.annotations.push(annotation);
    }

    /**
     * 删除标注
     */
    remove(id: string): void {
        this.annotations = this.annotations.filter(a => a.id !== id);
    }

    /**
     * 获取所有标注
     */
    getAll(): Annotation[] {
        return [...this.annotations];
    }

    /**
     * 根据时间范围筛选标注（用于回放时按时间显示）
     */
    getByTimeRange(startTime: number, endTime: number): Annotation[] {
        return this.annotations.filter(
            a => a.timestamp >= startTime && a.timestamp <= endTime,
        );
    }

    /**
     * 清空所有标注
     */
    clear(): void {
        this.annotations = [];
    }

    /**
     * 标注数量
     */
    get count(): number {
        return this.annotations.length;
    }
}
