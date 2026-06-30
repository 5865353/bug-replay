/**
 * src/content/recorder/rrweb-recorder.ts
 *
 * rrweb 录制封装 — 负责 DOM 快照与事件流的录制管理
 *
 * 集成 rrweb record() API，配置隐私屏蔽和事件回调
 */

import type { rrwebEvent } from '@shared/types';
import { record } from 'rrweb';

export interface RRWebRecorderOptions {
    /** rrweb 事件回调 */
    onEvent: (event: rrwebEvent) => void;
    /** 是否屏蔽所有文本输入内容（默认 true） */
    maskAllInputs?: boolean;
    /** 是否屏蔽文本内容（默认 true） */
    maskText?: boolean;
    /** 额外的 CSS 选择器用于屏蔽元素 */
    maskSelectors?: string[];
    /** 需要屏蔽的 input 类型 */
    maskInputTypes?: string[];
    /** 采样策略配置 */
    sampling?: {
        /** mousemove 采样间隔 (ms)，默认 50 */
        mousemove?: number;
        /** scroll 采样间隔 (ms)，默认 150 */
        scroll?: number;
    };
}

export class RRWebRecorder {
    private stopFn: (() => void) | null = null;
    private options: Required<RRWebRecorderOptions>;
    private eventCount = 0;

    /** 默认配置 */
    private static readonly DEFAULTS: Omit<Required<RRWebRecorderOptions>, 'onEvent'> = {
        maskAllInputs: true,
        maskText: true,
        maskSelectors: ['input[type="password"]', '[data-bugreplay-mask]'],
        maskInputTypes: ['password'],
        sampling: {
            mousemove: 50,
            scroll: 150,
        },
    };

    constructor(options: RRWebRecorderOptions) {
        this.options = {
            ...RRWebRecorder.DEFAULTS,
            ...options,
            sampling: {
                ...RRWebRecorder.DEFAULTS.sampling,
                ...options.sampling,
            },
            maskSelectors: [
                ...RRWebRecorder.DEFAULTS.maskSelectors,
                ...(options.maskSelectors ?? []),
            ],
            maskInputTypes: [
                ...RRWebRecorder.DEFAULTS.maskInputTypes,
                ...(options.maskInputTypes ?? []),
            ],
        } as Required<RRWebRecorderOptions>;
    }

    /**
     * 开始 rrweb 录制
     */
    async start(): Promise<void> {
        this.eventCount = 0;

        const stopFunction = record({
            emit: (event) => {
                this.eventCount++;
                this.options.onEvent(event as rrwebEvent);
            },
            // 隐私配置
            maskAllInputs: this.options.maskAllInputs,
            maskTextClass: 'bugreplay-mask',
            maskInputOptions: {
                password: this.options.maskInputTypes.includes('password'),
                text: this.options.maskInputTypes.includes('text'),
                email: this.options.maskInputTypes.includes('email'),
                tel: this.options.maskInputTypes.includes('tel'),
                number: this.options.maskInputTypes.includes('number'),
            },
            // 屏蔽指定选择器
            maskTextSelector: this.options.maskSelectors.join(','),
            // 采样策略（减少事件量）
            sampling: {
                mousemove: this.options.sampling.mousemove,
                scroll: this.options.sampling.scroll,
            },
            // 内联样式表（确保回放时样式正确）
            inlineStylesheet: true,
            // 收集 iframe 内容
            collectFonts: true,
            // 不录制 Canvas 元素（减少数据量）
            recordCanvas: false,
        });

        this.stopFn = stopFunction as unknown as (() => void) | null;
    }

    /**
     * 停止 rrweb 录制
     */
    stop(): void {
        if (this.stopFn) {
            this.stopFn();
            this.stopFn = null;
        }
    }

    /**
     * 获取已录制的事件数量
     */
    get eventTotal(): number {
        return this.eventCount;
    }

    /**
     * 是否正在录制
     */
    get isRecording(): boolean {
        return this.stopFn !== null;
    }
}
