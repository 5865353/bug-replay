/**
 * src/platforms/base-platform.ts — 第三方平台抽象基类
 *
 * 定义统一的 Bug 提交流程接口，方便扩展禅道 / GitLab 等
 */

import type { RRTPackage } from '@shared/types';

export interface SubmitResult {
    success: boolean;
    issueId?: string;
    issueUrl?: string;
    error?: string;
    /** 非致命告警（如附件上传失败，但不影响主流程） */
    warning?: string;
}

export abstract class BasePlatform {
    abstract readonly name: string;

    /**
     * 验证 API 配置（Token / URL 等）
     */
    abstract validateConfig(): Promise<boolean>;

    /**
     * 提交 .rrt 数据并创建 Bug
     */
    abstract submitBug(rrtPackage: RRTPackage): Promise<SubmitResult>;

    /**
     * 上传 .rrt 文件作为附件
     */
    abstract uploadAttachment(issueId: string, rrtPackage: RRTPackage): Promise<SubmitResult>;
}
