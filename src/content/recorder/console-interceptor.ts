/**
 * src/content/recorder/console-interceptor.ts
 *
 * 控制台日志劫持器 — 拦截 console.log/warn/error/info/debug
 *
 * 安全处理：
 * - 参数循环引用检测与序列化
 * - 特殊类型处理（BigInt, Symbol, Function, Error 等）
 * - 调用栈采集（仅 error/warn 级别）
 *
 * TODO M2: 实现完整的 console 劫持逻辑
 */

import type { ConsoleLevel, ConsoleLog } from '@shared/types';
import { CAPTURE_STACK_LEVELS } from '@shared/types';
import {
    captureStackTrace,
    generateUUID,
    serializeConsoleArgs,
} from '@shared/utils';
import { CONSOLE_LEVELS } from '../constants';

export interface ConsoleInterceptorOptions {
    /** 日志回调 */
    onLog: (log: ConsoleLog) => void;
}

/** 原始 console 方法引用（用于内部日志和恢复） */
type OriginalConsoleFn = (...args: unknown[]) => void;

export class ConsoleInterceptor {
    private options: ConsoleInterceptorOptions;
    private originals: Record<ConsoleLevel, OriginalConsoleFn> = {} as Record<ConsoleLevel, OriginalConsoleFn>;
    private rrwebEventCount = 0;

    constructor(options: ConsoleInterceptorOptions) {
        this.options = options;
    }

    /**
     * 开始劫持 console
     */
    start(): void {
        const levels = [...CONSOLE_LEVELS];

        // 先保存原始引用
        for (const level of levels) {
            this.originals[level] = console[level].bind(console);
        }

        // 再替换（用闭包捕获 originals，避免自引用）
        for (const level of levels) {
            const originalFn = this.originals[level];
            console[level] = (...args: unknown[]) => {
                // 1. 调用原始方法（保证控制台正常输出）
                originalFn(...args);

                // 2. 记录日志
                const log = this.createLog(level, args);
                this.options.onLog(log);
            };
        }

        // 使用原始方法输出，避免触发自身的拦截
        this.originals.log('[BugReplay] Console interceptor started');
    }

    /**
     * 停止劫持（恢复原始 console）
     */
    stop(): void {
        const levels = [...CONSOLE_LEVELS];
        for (const level of levels) {
            if (this.originals[level]) {
                console[level] = this.originals[level];
            }
        }
        // stop 时 console 已恢复，可以正常调用
        console.log('[BugReplay] Console interceptor stopped');
    }

    /**
     * 更新 rrweb 事件计数（用于回放时时间对齐）
     */
    setRRWebEventCount(count: number): void {
        this.rrwebEventCount = count;
    }

    /**
     * 创建日志条目
     */
    private createLog(level: ConsoleLevel, args: unknown[]): ConsoleLog {
        const log: ConsoleLog = {
            id: generateUUID(),
            level,
            args: serializeConsoleArgs(args),
            timestamp: Date.now(),
            rrwebEventIndex: this.rrwebEventCount,
        };

        // 仅 warn/error 级别采集调用栈
        if (CAPTURE_STACK_LEVELS.includes(level)) {
            log.stackTrace = captureStackTrace(4);
        }

        return log;
    }
}
