/**
 * src/replayer/replayer.ts — 回放主控制器
 *
 * 负责：
 * 1. 加载 .rrt 文件并解析
 * 2. 使用 rrweb-player 渲染 DOM 回放
 * 3. 管理时间轴（Timeline 组件）
 * 4. 同步侧边栏（Sidebar 组件）
 * 5. 标注图层叠加（AnnotationOverlay 组件）
 */

import type { ReplayState, RRTPackage } from '@shared/types';
import { Sidebar } from './sidebar';
import { Timeline } from './timeline';
import { AnnotationOverlay } from './annotation-overlay';

// ============================================================
// DOM 引用
// ============================================================

const fileInput = document.getElementById('file-input') as HTMLInputElement;
const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
const playerContainer = document.getElementById('rrweb-player') as HTMLDivElement;
const timelineContainer = document.getElementById('timeline') as HTMLDivElement;
const sidebarContainer = document.getElementById('sidebar') as HTMLDivElement;
const btnToggleAnnotations = document.getElementById(
    'btn-toggle-annotations',
) as HTMLButtonElement;
const metadataTitle = document.getElementById('metadata-title') as HTMLElement;

// ============================================================
// 状态
// ============================================================

const replayState: ReplayState = {
    isPlaying: false,
    currentTime: 0,
    totalTime: 0,
    speed: 1,
    showAnnotations: true,
    activeTab: 'console',
};

let currentPackage: RRTPackage | null = null;
let rrwebReplayer: any = null;
let animationFrameId: number | null = null;
let lastFrameTime = 0;

// ============================================================
// 组件
// ============================================================

let timeline: Timeline;
let sidebar: Sidebar;
let annotationOverlay: AnnotationOverlay;

// ============================================================
// 文件加载
// ============================================================

fileInput.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        await loadRRTFile(file);
    }
});

// 拖拽加载
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.background = '#313244';
});

dropZone.addEventListener('dragleave', () => {
    dropZone.style.background = '';
});

dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.style.background = '';
    const file = e.dataTransfer?.files?.[0];
    if (file && (file.name.endsWith('.rrt') || file.name.endsWith('.json'))) {
        await loadRRTFile(file);
    }
});

async function loadRRTFile(file: File): Promise<void> {
    try {
        const text = await file.text();
        currentPackage = JSON.parse(text) as RRTPackage;

        // 验证 .rrt 格式
        if (!currentPackage.version || !currentPackage.rrwebEvents) {
            throw new Error('Invalid .rrt file format');
        }

        // 初始化状态
        replayState.totalTime = currentPackage.metadata.duration;
        replayState.currentTime = 0;
        replayState.isPlaying = false;

        // 显示回放界面
        dropZone.style.display = 'none';
        playerContainer.style.display = 'block';
        timelineContainer.style.display = 'block';
        sidebarContainer.style.display = 'flex';

        // 更新标题
        if (metadataTitle) {
            metadataTitle.textContent = currentPackage.metadata.title || 'BugReplay 回放';
        }

        // 初始化 rrweb-player
        await initRRWebPlayer();

        // 初始化 UI 组件
        initComponents();

        console.log(
            `[BugReplay] Loaded: ${currentPackage.metadata.title} (${currentPackage.rrwebEvents.length} events)`,
        );
    } catch (error) {
        console.error('[BugReplay] Failed to load .rrt file:', error);
        // eslint-disable-next-line no-alert
        alert('文件加载失败，请检查 .rrt 文件格式');
    }
}

// ============================================================
// rrweb Player 初始化
// ============================================================

async function initRRWebPlayer(): Promise<void> {
    if (!currentPackage) return;

    try {
        const rrwebPlayer = await import('rrweb-player');
        // eslint-disable-next-line ts/no-unsafe-assignment, ts/no-unsafe-call
        rrwebReplayer = new rrwebPlayer.default({
            target: playerContainer,
            props: {
                events: currentPackage.rrwebEvents,
                width: playerContainer.clientWidth,
                height: playerContainer.clientHeight,
                autoPlay: false,
                speed: replayState.speed,
                showController: false, // 使用自定义控制器
                skipInactive: true,
            },
        });

        // 监听 rrweb-player 的播放时间更新
        // eslint-disable-next-line ts/no-unsafe-call
        rrwebReplayer?.addEventListener?.('ui-update-current-time', (e: CustomEvent) => {
            // eslint-disable-next-line ts/no-unsafe-member-access
            const time = e.detail?.payload as number;
            if (typeof time === 'number') {
                replayState.currentTime = time;
                timeline.updateTime(time);
                sidebar.highlightTime(time);
                annotationOverlay.updateTime(time);
            }
        });

        // 监听播放状态变化
        // eslint-disable-next-line ts/no-unsafe-call
        rrwebReplayer?.addEventListener?.('ui-update-player-state', (e: CustomEvent) => {
            // eslint-disable-next-line ts/no-unsafe-member-access
            const playing = e.detail?.payload === 'playing';
            replayState.isPlaying = playing;
            timeline.setPlaying(playing);
        });
    } catch (err) {
        console.warn('[BugReplay] rrweb-player init failed, using fallback:', err);
        // Fallback: 使用基本的 rrweb replayer
        const rrweb = await import('rrweb');
        // eslint-disable-next-line ts/no-unsafe-call
        rrwebReplayer = new rrweb.Replayer(currentPackage.rrwebEvents, {
            root: playerContainer,
            speed: replayState.speed,
            skipInactive: true,
        });
    }
}

// ============================================================
// UI 组件初始化
// ============================================================

function initComponents(): void {
    if (!currentPackage) return;

    // Timeline
    timeline = new Timeline(timelineContainer, {
        onPlayPause: togglePlayPause,
        onSeek: (time: number) => seekTo(time),
        onSpeedChange: (speed: number) => setSpeed(speed),
        onStepForward: () => stepTime(1000),
        onStepBack: () => stepTime(-1000),
    });
    timeline.setTotalTime(replayState.totalTime);
    timeline.setPlaying(false);
    timeline.updateTime(0);

    // Sidebar
    sidebar = new Sidebar(sidebarContainer);
    sidebar.setData(
        currentPackage.networkLogs,
        currentPackage.consoleLogs,
    );

    // Annotation Overlay
    annotationOverlay = new AnnotationOverlay();
    annotationOverlay.init(playerContainer, currentPackage.annotations);
    annotationOverlay.setVisible(replayState.showAnnotations);

    // 标注切换按钮
    btnToggleAnnotations.addEventListener('click', () => {
        replayState.showAnnotations = annotationOverlay.toggle();
        btnToggleAnnotations.style.opacity = replayState.showAnnotations ? '1' : '0.5';
    });
}

// ============================================================
// 播放控制
// ============================================================

function togglePlayPause(): void {
    if (!rrwebReplayer) return;

    if (replayState.isPlaying) {
        // eslint-disable-next-line ts/no-unsafe-call
        rrwebReplayer.pause?.();
        stopPlaybackLoop();
    } else {
        // eslint-disable-next-line ts/no-unsafe-call
        rrwebReplayer.play?.(replayState.currentTime);
        startPlaybackLoop();
    }
}

function seekTo(time: number): void {
    if (!rrwebReplayer) return;
    replayState.currentTime = time;
    // eslint-disable-next-line ts/no-unsafe-call
    rrwebReplayer.play?.(time);
    // eslint-disable-next-line ts/no-unsafe-call
    rrwebReplayer.pause?.();
    stopPlaybackLoop();
    replayState.isPlaying = false;
    timeline.setPlaying(false);
    sidebar.highlightTime(time);
    annotationOverlay.updateTime(time);
}

function stepTime(offset: number): void {
    const newTime = Math.max(
        0,
        Math.min(replayState.totalTime, replayState.currentTime + offset),
    );
    seekTo(newTime);
}

function setSpeed(speed: number): void {
    replayState.speed = speed;
    if (rrwebReplayer) {
        // eslint-disable-next-line ts/no-unsafe-call
        rrwebReplayer.setConfig?.({ speed });
    }
}

// ============================================================
// 播放循环（fallback 模式下的手动时间推进）
// ============================================================

function startPlaybackLoop(): void {
    if (animationFrameId) return;
    lastFrameTime = performance.now();

    const loop = (now: number) => {
        if (!replayState.isPlaying) {
            animationFrameId = null;
            return;
        }

        const delta = (now - lastFrameTime) * replayState.speed;
        lastFrameTime = now;

        const newTime = Math.min(
            replayState.totalTime,
            replayState.currentTime + delta,
        );

        if (newTime >= replayState.totalTime) {
            replayState.currentTime = replayState.totalTime;
            replayState.isPlaying = false;
            timeline.setPlaying(false);
            stopPlaybackLoop();
            return;
        }

        replayState.currentTime = newTime;
        timeline.updateTime(newTime);
        sidebar.highlightTime(newTime);
        annotationOverlay.updateTime(newTime);

        animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
}

function stopPlaybackLoop(): void {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

// ============================================================
// 窗口大小适配
// ============================================================

window.addEventListener('resize', () => {
    if (rrwebReplayer && playerContainer) {
        // eslint-disable-next-line ts/no-unsafe-call
        rrwebReplayer.setConfig?.({
            width: playerContainer.clientWidth,
            height: playerContainer.clientHeight,
        });
    }
});
console.log('[BugReplay] Replayer initialized');
