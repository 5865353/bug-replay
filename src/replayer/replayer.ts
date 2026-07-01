/**
 * src/replayer/replayer.ts — BugReplay 回放主控制器
 */
import type { ReplayState, RRTPackage } from '@shared/types';
import { formatTime } from '@shared/utils';
import { AnnotationOverlay } from './annotation-overlay';
import { Sidebar } from './sidebar';
import { Timeline } from './timeline';

// ============================================================
// DOM 引用
// ============================================================
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
const stage = document.getElementById('player-stage') as HTMLDivElement;
const stageInner = document.getElementById('stage-inner') as HTMLDivElement;
const playerContainer = document.getElementById('rrweb-player') as HTMLDivElement;
const timelineContainer = document.getElementById('timeline') as HTMLDivElement;
const sidebarContainer = document.getElementById('sidebar') as HTMLDivElement;
const rightPanel = document.getElementById('right-panel') as HTMLDivElement;
const bottomPanel = document.getElementById('bottom-panel') as HTMLDivElement;
const btnToggleAnnotations = document.getElementById('btn-toggle-annotations') as HTMLButtonElement;
const btnReplay = document.getElementById('btn-replay') as HTMLButtonElement;
const btnToggleDevtools = document.getElementById('btn-toggle-devtools') as HTMLButtonElement;
const metadataTitle = document.getElementById('metadata-title') as HTMLElement;
const metaContent = document.getElementById('meta-content') as HTMLElement;
const envContent = document.getElementById('env-content') as HTMLElement;
const keyframeList = document.getElementById('keyframe-list') as HTMLElement;
const devtoolsClose = document.getElementById('devtools-close') as HTMLButtonElement;
const controlsRow = document.getElementById('controls-row') as HTMLDivElement;
const resizeHandle = document.getElementById('resize-handle') as HTMLDivElement;

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
let recordingBaseTime = 0;
let timeline: Timeline;
let sidebar: Sidebar;
let annotationOverlay: AnnotationOverlay;

// ============================================================
// 底部面板开关
// ============================================================
let devtoolsVisible = true;
btnToggleDevtools.addEventListener('click', () => {
    devtoolsVisible = !devtoolsVisible;
    bottomPanel.style.display = devtoolsVisible ? 'flex' : 'none';
    btnToggleDevtools.textContent = devtoolsVisible ? '🔽 面板' : '🔼 面板';
    syncContentScale();
});

// DevTools 折叠
devtoolsClose.addEventListener('click', () => {
    bottomPanel.classList.toggle('collapsed');
    devtoolsClose.textContent = bottomPanel.classList.contains('collapsed') ? '╍' : '╌';
    syncContentScale();
});

// ============================================================
// 右侧 Tab 切换
// ============================================================
document.querySelectorAll<HTMLButtonElement>('.right-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
        const name = tab.dataset.rightTab;
        if (!name) return;
        document.querySelectorAll('.right-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.right-tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`panel-${name}`)?.classList.add('active');
    });
});

// DevTools Tab 切换
document.querySelectorAll<HTMLButtonElement>('#devtools-tabs .devtools-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
        const name = tab.dataset.devtoolsTab as 'console' | 'network' | undefined;
        if (!name) return;
        replayState.activeTab = name;
        document.querySelectorAll('#devtools-tabs .devtools-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        sidebar?.switchTab(name);
    });
});

// 底部面板拖拽
let resizeDragging = false;
let resizeStartY = 0;
let resizeStartH = 0;
resizeHandle.addEventListener('mousedown', (e) => {
    resizeDragging = true;
    resizeStartY = e.clientY;
    resizeStartH = bottomPanel.offsetHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
});
document.addEventListener('mousemove', (e) => {
    if (!resizeDragging) return;
    const newH = Math.max(80, Math.min(600, resizeStartH + (resizeStartY - e.clientY)));
    bottomPanel.style.height = `${newH}px`;
    bottomPanel.classList.remove('collapsed');
    syncContentScale();
});
document.addEventListener('mouseup', () => {
    if (resizeDragging) {
        resizeDragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }
});

// ============================================================
// 标注切换 / 重新播放
// ============================================================
btnToggleAnnotations.addEventListener('click', () => {
    replayState.showAnnotations = annotationOverlay?.toggle() ?? false;
    btnToggleAnnotations.style.opacity = replayState.showAnnotations ? '1' : '0.5';
});
btnReplay.addEventListener('click', () => {
    seekTo(0);
    replayState.isPlaying = false;
    togglePlayPause();
});

// ============================================================
// 内容等比缩放（容器始终撑满，内部 iframe + 标注按视口比例缩放）
// ============================================================

function syncContentScale(): void {
    const iframe = playerContainer.querySelector('iframe');
    if (!iframe || !currentPackage?.environment?.viewport) return;
    const vw = currentPackage.environment.viewport.width;
    const vh = currentPackage.environment.viewport.height;
    const cw = playerContainer.clientWidth;
    const ch = playerContainer.clientHeight;
    if (!cw || !ch || !vw || !vh) return;

    const scale = Math.min(cw / vw, ch / vh, 1);
    const scaledW = vw * scale;
    const scaledH = vh * scale;
    const offsetX = (cw - scaledW) / 2;
    const offsetY = (ch - scaledH) / 2;

    iframe.style.width = `${vw}px`;
    iframe.style.height = `${vh}px`;
    iframe.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    iframe.style.transformOrigin = 'top left';

    const wrapperEl = annotationOverlay?.getWrapper?.();
    if (wrapperEl) {
        wrapperEl.style.width = `${vw}px`;
        wrapperEl.style.height = `${vh}px`;
        wrapperEl.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
        wrapperEl.style.transformOrigin = 'top left';
        annotationOverlay?.resize(vw, vh);
    }
}

const stageObserver = new ResizeObserver(() => syncContentScale());
stageObserver.observe(stage);

new MutationObserver(() => syncContentScale()).observe(bottomPanel, {
    attributes: true,
    attributeFilter: ['class', 'style'],
});

// ============================================================
// 清理
// ============================================================
function cleanup(): void {
    stopPlaybackLoop();
    btnReplay.style.display = 'none';
    if (rrwebReplayer) {
        try {
            (rrwebReplayer as { destroy?: () => void }).destroy?.();
        }
        catch { /* */ }
        rrwebReplayer = null;
    }
    if (annotationOverlay) {
        try {
            annotationOverlay.destroy();
        }
        catch { /* */ }
        annotationOverlay = undefined as any;
    }
    while (playerContainer.firstChild) playerContainer.removeChild(playerContainer.firstChild);
    playerContainer.style.display = 'none';
    dropZone.style.display = '';
    controlsRow.style.display = 'none';
    timelineContainer.style.display = 'none';
    rightPanel.style.display = 'none';
    bottomPanel.style.display = 'none';
    btnToggleDevtools.style.display = 'none';
    stageInner.style.width = '100%';
    stageInner.style.height = '100%';
    recordingBaseTime = 0;
    replayState.currentTime = 0;
    replayState.totalTime = 0;
    replayState.isPlaying = false;
    replayState.showAnnotations = true;
    btnToggleAnnotations.style.opacity = '1';
    currentPackage = null;
}

// ============================================================
// 文件加载
// ============================================================
fileInput.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) await loadRRTFile(file);
});
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#cba6f7';
});

dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = '';
});

dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '';
    const file = e.dataTransfer?.files?.[0];
    if (file && (file.name.endsWith('.rrt') || file.name.endsWith('.json'))) await loadRRTFile(file);
});
dropZone.addEventListener('click', () => fileInput.click());

async function loadRRTFile(file: File): Promise<void> {
    cleanup();
    try {
        const text = await file.text();
        currentPackage = JSON.parse(text) as RRTPackage;
        if (!currentPackage.version || !currentPackage.rrwebEvents) throw new Error('Invalid .rrt file');

        replayState.totalTime = currentPackage.metadata.duration;
        replayState.currentTime = 0;
        replayState.isPlaying = false;

        dropZone.style.display = 'none';
        playerContainer.style.display = 'block';
        controlsRow.style.display = 'flex';
        timelineContainer.style.display = 'block';
        rightPanel.style.display = 'flex';
        bottomPanel.style.display = 'flex';
        btnToggleDevtools.style.display = 'inline-flex';
        bottomPanel.classList.remove('collapsed');
        devtoolsClose.textContent = '╌';
        devtoolsVisible = true;
        metadataTitle.textContent = currentPackage.metadata.title || '— 回放';

        // 打印数据统计
        console.log(
            `[BugReplay] 📦 .rrt loaded:\n`
            + `  events: ${currentPackage.rrwebEvents.length}\n`
            + `  annotations: ${currentPackage.annotations?.length ?? 0}\n`
            + `  networkLogs: ${currentPackage.networkLogs?.length ?? 0}\n`
            + `  consoleLogs: ${currentPackage.consoleLogs?.length ?? 0}`,
        );
        if (currentPackage.annotations?.length) {
            console.log('[BugReplay] 🖊 Annotation sample:', JSON.stringify(currentPackage.annotations[0]).slice(0, 200));
        }
        if (currentPackage.networkLogs?.length) {
            console.log('[BugReplay] 🌐 Network sample:', JSON.stringify(currentPackage.networkLogs[0]).slice(0, 200));
        }

        await initRRWebPlayer();
        initComponents();
        populateMetaPanel();
        populateEnvPanel();
        populateKeyframes();
        syncContentScale();

        console.log(`[BugReplay] ✅ Ready: ${currentPackage.metadata.title}`);
    }
    catch (err) {
        console.error('[BugReplay] Load failed:', err);
        // eslint-disable-next-line no-alert
        alert('文件加载失败，请检查 .rrt 文件格式');
    }
}

// ============================================================
// 右侧面板
// ============================================================
function populateMetaPanel(): void {
    if (!currentPackage) return;
    const m = currentPackage.metadata;
    const rows: [string, string][] = [
        ['标题', m.title],
        ['时长', formatTime(m.duration)],
        ['版本', m.extensionVersion],
    ];
    if (m.description) rows.push(['描述', m.description]);
    if (m.tags?.length) rows.push(['标签', m.tags.join(', ')]);
    if (m.externalIssueId) rows.push(['关联 Issue', m.externalIssueId]);
    metaContent.innerHTML = rows.map(([l, v]) =>
        `<div class="info-row"><span class="info-label">${l}</span><span class="info-value">${esc(String(v))}</span></div>`,
    ).join('');
}
function populateEnvPanel(): void {
    if (!currentPackage?.environment) {
        envContent.innerHTML = '';
        return;
    }
    const e = currentPackage.environment;
    envContent.innerHTML = '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;display:flex;align-items:center;gap:6px;">💻 环境<span style="flex:1;height:1px;background:var(--border)"></span></div>';
    [
        ['URL', e.url],
        ['分辨率', `${e.screenResolution.width}×${e.screenResolution.height}`],
        ['视口', `${e.viewport.width}×${e.viewport.height} @${e.devicePixelRatio}x`],
        ['平台', e.platform],
        ['语言', e.language],
        ['UA', e.userAgent.length > 80 ? `${e.userAgent.slice(0, 80)}…` : e.userAgent],
    ].forEach(([l, v]) => {
        const row = document.createElement('div');
        row.className = 'info-row';
        row.innerHTML = `<span class="info-label">${l}</span><span class="info-value">${esc(String(v))}</span>`;
        envContent.appendChild(row);
    });
}

// ============================================================
// 关键帧
// ============================================================
const TOOL_ICONS: Record<string, string> = { rect: '⬜', arrow: '➡️', text: '📝', freehand: '✏️' };
function populateKeyframes(): void {
    if (!currentPackage) return;
    const annotations = currentPackage.annotations ?? [];
    if (annotations.length === 0) {
        keyframeList.innerHTML = '<div class="keyframe-empty">暂无关键帧<br><small>录制时添加的标注即为关键帧</small></div>';
        return;
    }
    const sorted = [...annotations].sort((a, b) => a.timestamp - b.timestamp);
    keyframeList.innerHTML = sorted.map((ann, i) => {
        const relTime = ann.timestamp - recordingBaseTime;
        const desc = (ann as any).data?.comment || (ann as any).data?.text || ann.type;
        return `<div class="keyframe-item" data-kf-time="${relTime}"><span class="kf-step">${ann.stepNumber ?? (i + 1)}</span><span class="kf-type">${TOOL_ICONS[ann.type] ?? '📍'}</span><span class="kf-desc">${esc(String(desc).slice(0, 24))}</span><span class="kf-time">${formatTime(relTime)}</span></div>`;
    }).join('');
    keyframeList.querySelectorAll<HTMLDivElement>('.keyframe-item').forEach((item) => {
        item.addEventListener('click', () => seekTo(Number.parseFloat(item.dataset.kfTime || '0')));
    });
}
function updateKeyframeHighlight(t: number): void {
    let last: HTMLDivElement | null = null;
    keyframeList.querySelectorAll<HTMLDivElement>('.keyframe-item').forEach((item) => {
        if (Number.parseFloat(item.dataset.kfTime || '0') <= t) {
            item.classList.add('active');
            last = item;
        }
        else {
            item.classList.remove('active');
        }
    });
    if (last)
        last.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ============================================================
// rrweb Player
// ============================================================
async function initRRWebPlayer(): Promise<void> {
    if (!currentPackage) return;
    const rrweb = await import('rrweb');
    const events = [...currentPackage.rrwebEvents].sort((a, b) => a.timestamp - b.timestamp);
    if (events.length === 0) throw new Error('录制事件为空');

    rrwebReplayer = new rrweb.Replayer(events as any, {
        root: playerContainer,
        speed: replayState.speed,
        skipInactive: true,
        showWarning: false,
        mouseTail: false,
    });
    recordingBaseTime = (events[0] as { timestamp: number }).timestamp;

    if (typeof rrwebReplayer.on === 'function') {
        rrwebReplayer.on('event-cast', (ec: number) => {
            const e = events[ec - 1] as { timestamp?: number } | undefined;
            if (e?.timestamp) {
                replayState.currentTime = e.timestamp - recordingBaseTime;
                timeline?.updateTime(replayState.currentTime);
                sidebar?.highlightTime(replayState.currentTime);
                annotationOverlay?.updateTime(replayState.currentTime);
                updateKeyframeHighlight(replayState.currentTime);
            }
        });
    }
    rrwebReplayer.on('finish', () => {
        replayState.isPlaying = false;
        stopPlaybackLoop();
        timeline?.setPlaying(false);
        btnReplay.style.display = 'inline-flex';
    });
    console.log(`[BugReplay] Replayer ready: ${events.length} events, baseTime=${recordingBaseTime}`);
}

function showFirstFrame(): void {
    if (!rrwebReplayer) return;
    (rrwebReplayer as { play?: (t: number) => void }).play?.(0);
    setTimeout(() => {
        (rrwebReplayer as { pause?: () => void }).pause?.();
        syncContentScale();
    }, 250);
}

// ============================================================
// UI 组件
// ============================================================
function initComponents(): void {
    if (!currentPackage) return;
    timeline = new Timeline(timelineContainer, {
        onPlayPause: togglePlayPause,
        onSeek: (t: number) => seekTo(t),
        onSpeedChange: (s: number) => setSpeed(s),
        onStepForward: () => stepTime(1000),
        onStepBack: () => stepTime(-1000),
    });
    timeline.setTotalTime(replayState.totalTime);
    timeline.setPlaying(false);
    timeline.updateTime(0);

    sidebar = new Sidebar(sidebarContainer);
    sidebar.setData(currentPackage.networkLogs, currentPackage.consoleLogs);

    if (currentPackage.annotations && currentPackage.annotations.length > 0) {
        const normalized = currentPackage.annotations.map(a => ({
            ...a,
            timestamp: a.timestamp - recordingBaseTime,
        }));
        console.log(`[BugReplay] 🖊 Creating overlay: ${normalized.length} annotations, first at t=${normalized[0]?.timestamp}ms, totalTime=${replayState.totalTime}ms`);
        annotationOverlay = new AnnotationOverlay();
        annotationOverlay.init(playerContainer, normalized);
        annotationOverlay.setVisible(replayState.showAnnotations);
        // 主动渲染第一帧标注
        annotationOverlay.updateTime(0);
    }
    else {
        console.log('[BugReplay] 🖊 No annotations in package');
    }

    showFirstFrame();
    populateKeyframes();
}

// ============================================================
// 播放控制
// ============================================================
function togglePlayPause(): void {
    if (!rrwebReplayer || !currentPackage) return;
    btnReplay.style.display = 'none';
    if (replayState.isPlaying) {
        (rrwebReplayer as { pause?: () => void }).pause?.();
        stopPlaybackLoop();
    }
    else {
        (rrwebReplayer as { play?: (t: number) => void }).play?.(replayState.currentTime);
        startPlaybackLoop();
    }
    replayState.isPlaying = !replayState.isPlaying;
    timeline.setPlaying(replayState.isPlaying);
}
function seekTo(time: number): void {
    if (!rrwebReplayer) return;
    btnReplay.style.display = 'none';
    replayState.currentTime = time;
    (rrwebReplayer as { play?: (t: number) => void }).play?.(time);
    (rrwebReplayer as { pause?: () => void }).pause?.();
    replayState.isPlaying = false;
    stopPlaybackLoop();
    timeline.setPlaying(false);
    timeline.updateTime(time);
    sidebar.highlightTime(time);
    annotationOverlay?.updateTime(time);
    updateKeyframeHighlight(time);
}
function stepTime(o: number): void {
    seekTo(Math.max(0, Math.min(replayState.totalTime, replayState.currentTime + o)));
}

function setSpeed(s: number): void {
    replayState.speed = s;
}

function startPlaybackLoop(): void {
    if (animationFrameId) return;
    lastFrameTime = performance.now();
    const loop = (now: number) => {
        if (!replayState.isPlaying) {
            animationFrameId = null;
            return;
        }
        const dt = (now - lastFrameTime) * replayState.speed;
        lastFrameTime = now;
        const nt = Math.min(replayState.totalTime, replayState.currentTime + dt);
        if (nt >= replayState.totalTime) {
            replayState.currentTime = replayState.totalTime;
            replayState.isPlaying = false;
            timeline.setPlaying(false);
            stopPlaybackLoop();
            btnReplay.style.display = 'inline-flex';
            return;
        }
        replayState.currentTime = nt;
        timeline.updateTime(nt);
        sidebar.highlightTime(nt);
        annotationOverlay?.updateTime(nt);
        updateKeyframeHighlight(nt);
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
function esc(s: string): string {
    const el = document.createElement('span');
    el.textContent = s;
    return el.innerHTML;
}

console.log('[BugReplay] Replayer ready');
