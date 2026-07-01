/**
 * src/replayer/timeline.ts — 时间轴组件
 *
 * 提供播放进度控制：
 * - 进度条（可拖拽跳转）
 * - 播放/暂停
 * - 速度控制
 * - 逐帧前进/后退
 * - 时间显示
 */

import { REPLAY_SPEEDS } from '@shared/types';
import { formatTime } from '@shared/utils';

export interface TimelineCallbacks {
    onPlayPause: () => void;
    onSeek: (time: number) => void;
    onSpeedChange: (speed: number) => void;
    onStepForward: () => void;
    onStepBack: () => void;
}

export class Timeline {
    private container: HTMLElement;
    private progressBar: HTMLElement;
    private progressFill: HTMLElement;
    private timeDisplay: HTMLElement;
    private durationDisplay: HTMLElement;
    private btnPlayPause: HTMLButtonElement;
    private btnSkipBack: HTMLButtonElement;
    private btnSkipForward: HTMLButtonElement;
    private speedSelect: HTMLSelectElement;
    private callbacks: TimelineCallbacks;

    private currentTime = 0;
    private totalTime = 0;
    private isPlaying = false;
    private isDragging = false;

    constructor(container: HTMLElement, callbacks: TimelineCallbacks) {
        this.container = container;
        this.callbacks = callbacks;

        // Build timeline UI
        this.container.innerHTML = `
            <div class="timeline-controls">
                <button id="btn-skip-back" class="btn btn-icon" title="后退 1s (←)">⏮</button>
                <button id="btn-play-pause" class="btn btn-primary btn-icon" title="播放/暂停 (Space)">▶</button>
                <button id="btn-skip-forward" class="btn btn-icon" title="前进 1s (→)">⏭</button>
                <span id="time-display" class="time-display">00:00</span>
                <span class="time-separator">/</span>
                <span id="duration-display" class="time-display">00:00</span>
                <select id="speed-select" class="speed-select">
                    ${REPLAY_SPEEDS.map(s => `<option value="${s}" ${s === 1 ? 'selected' : ''}>${s}x</option>`).join('')}
                </select>
            </div>
            <div class="timeline-bar-container" id="timeline-bar">
                <div class="timeline-progress" id="timeline-progress"></div>
                <div class="timeline-thumb" id="timeline-thumb"></div>
            </div>
        `;

        this.progressBar = this.container.querySelector('#timeline-bar')!;
        this.progressFill = this.container.querySelector('#timeline-progress')!;
        this.timeDisplay = this.container.querySelector('#time-display')!;
        this.durationDisplay = this.container.querySelector('#duration-display')!;
        this.btnPlayPause = this.container.querySelector('#btn-play-pause')!;
        this.btnSkipBack = this.container.querySelector('#btn-skip-back')!;
        this.btnSkipForward = this.container.querySelector('#btn-skip-forward')!;
        this.speedSelect = this.container.querySelector('#speed-select')!;

        this.bindEvents();
    }

    /**
     * 设置总时长
     */
    setTotalTime(ms: number): void {
        this.totalTime = ms;
        this.durationDisplay.textContent = formatTime(ms);
    }

    /**
     * 更新当前时间
     */
    updateTime(ms: number): void {
        this.currentTime = ms;
        this.timeDisplay.textContent = formatTime(ms);

        if (!this.isDragging && this.totalTime > 0) {
            const pct = (ms / this.totalTime) * 100;
            this.progressFill.style.width = `${pct}%`;
        }
    }

    /**
     * 设置播放状态
     */
    setPlaying(playing: boolean): void {
        this.isPlaying = playing;
        this.btnPlayPause.textContent = playing ? '⏸' : '▶';
        this.btnPlayPause.title = playing ? '暂停 (Space)' : '播放 (Space)';
    }

    /**
     * 获取当前速度
     */
    getSpeed(): number {
        return Number.parseFloat(this.speedSelect.value);
    }

    // ---- 事件绑定 ----

    private bindEvents(): void {
        this.btnPlayPause.addEventListener('click', () => this.callbacks.onPlayPause());

        this.btnSkipBack.addEventListener('click', () => this.callbacks.onStepBack());
        this.btnSkipForward.addEventListener('click', () => this.callbacks.onStepForward());

        this.speedSelect.addEventListener('change', () => {
            this.callbacks.onSpeedChange(this.getSpeed());
        });

        // 进度条拖拽
        this.progressBar.addEventListener('mousedown', this.onProgressMouseDown.bind(this));
        document.addEventListener('mousemove', this.onProgressMouseMove.bind(this));
        document.addEventListener('mouseup', this.onProgressMouseUp.bind(this));

        // 键盘快捷键
        document.addEventListener('keydown', this.onKeyDown.bind(this));
    }

    private onProgressMouseDown(e: MouseEvent): void {
        this.isDragging = true;
        this.seekToPosition(e);
    }

    private onProgressMouseMove(e: MouseEvent): void {
        if (!this.isDragging) return;
        this.seekToPosition(e);
    }

    private onProgressMouseUp(e: MouseEvent): void {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.seekToPosition(e);
    }

    private seekToPosition(e: MouseEvent): void {
        const rect = this.progressBar.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const time = pct * this.totalTime;
        this.updateTime(time);
        this.callbacks.onSeek(time);
    }

    private onKeyDown(e: KeyboardEvent): void {
        // 忽略输入框中的按键
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
            return;
        }

        switch (e.key) {
            case ' ':
                e.preventDefault();
                this.callbacks.onPlayPause();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.callbacks.onStepBack();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.callbacks.onStepForward();
                break;
        }
    }
}
