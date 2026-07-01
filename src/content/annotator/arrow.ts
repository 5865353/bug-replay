/**
 * src/content/annotator/arrow.ts — 自定义箭头类
 *
 * 继承 Fabric.Line，在 _render 中绘制箭头头部。
 * 行为完全像一个普通的 Line 对象：可选中/拖拽/缩放。
 */

import { Line, classRegistry } from 'fabric';
import type { FabricObjectProps, SerializedObjectProps, ObjectEvents } from 'fabric';

export class ArrowLine extends Line {
    static type = 'ArrowLine';

    // Fabric v6 兼容的初始化
    // eslint-disable-next-line ts/no-explicit-any
    static fromObject(object: any): Promise<ArrowLine> {
        return Promise.resolve(new ArrowLine(
            [object.x1, object.y1, object.x2, object.y2],
            object,
        ));
    }

    _render(ctx: CanvasRenderingContext2D): void {
        super._render(ctx);

        const x1 = this.x1 ?? 0;
        const y1 = this.y1 ?? 0;
        const x2 = this.x2 ?? 0;
        const y2 = this.y2 ?? 0;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = 14;
        const color = String(this.stroke ?? '#EF4444');

        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

// 注册到 Fabric 全局类表，支持 JSON 序列化/反序列化
classRegistry.setClass(ArrowLine, 'ArrowLine');
