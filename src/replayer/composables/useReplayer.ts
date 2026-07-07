import type { Annotation, NetworkLog, RRTPackage } from '@shared/types';
import { ContentToBackgroundAction } from '@shared/types';
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import browser from 'webextension-polyfill';

export function useRePlayer() {
    const currentPackage = ref<RRTPackage | null>(null);
    const hasLoaded = ref(false);

    const showAnnotations = ref(true);
    const devtoolsVisible = ref(true);
    const currentTime = ref(0);
    const totalTime = ref(0);
    const isPlaying = ref(false);
    const speed = ref(1);

    let rrwebRePlayer: any = null;
    let animationFrameId: number | null = null;
    let stageResizeObserver: ResizeObserver | null = null;
    let bottomPanelMutationObserver: MutationObserver | null = null;
    let playStartTime = 0;
    let playStartOffset = 0;
    let recordingBaseTime = 0;

    // 自定义光标
    let cursorWrapper: HTMLDivElement | null = null;
    let cursorEl: HTMLDivElement | null = null;
    let mousePositions: { time: number; x: number; y: number }[] = [];
    let cursorPos = { x: 0, y: 0, visible: false };

    const metadataTitle = computed(() => currentPackage.value?.metadata?.title || '回放');

    // ============================================================
    // File Loading
    // ============================================================
    async function loadFile(file: File) {
        try {
            const text = await file.text();
            const pkg: RRTPackage = JSON.parse(text);

            // Validate
            if (!pkg.rrwebEvents || !Array.isArray(pkg.rrwebEvents)) {
                throw new Error('Invalid .rrt file: missing rrwebEvents');
            }

            cleanup();

            currentPackage.value = pkg;
            totalTime.value = pkg.metadata.duration;
            hasLoaded.value = true;

            // 计算录制基准时间（第一个 rrweb 事件的时间戳）
            const firstEvent = pkg.rrwebEvents[0] as { timestamp?: number } | undefined;
            recordingBaseTime = firstEvent?.timestamp ?? 0;

            // 归一化所有时间戳为相对时间
            pkg.networkLogs = normalizeNetworkLogs(pkg.networkLogs || []);
            pkg.annotations = normalizeAnnotations(pkg.annotations || []);

            // Initialize rrweb replayer
            await initRRWebRePlayer(pkg);

            // Initialize annotations
            initAnnotations(pkg.annotations);

            // 重新建立观察器（cleanup 中已销毁）
            await nextTick();
            setupObservers();
        }
        catch (err) {
            console.error('[BugReplay] Failed to load file:', err);
            // eslint-disable-next-line no-alert
            alert(`文件加载失败: ${err instanceof Error ? err.message : '未知错误'}`);
        }
    }

    // 从 Session ID 加载录制数据
    async function loadFromSessionId(sessionId: string) {
        try {
            const response = await browser.runtime.sendMessage({
                action: ContentToBackgroundAction.GET_SESSION,
                payload: { sessionId },
            });
            const session = (response as any).payload;
            if (!session || !session.events) throw new Error('Session data invalid');

            cleanup();

            const pkg: RRTPackage = {
                version: '1.0.0',
                exportedAt: Date.now(),
                metadata: {
                    title: session.title,
                    duration: session.endTime ? session.endTime - session.startTime : 0,
                    tags: session.tags || [],
                    extensionVersion: '1.0.0',
                },
                environment: session.environment || { url: '', title: '', userAgent: '', screenResolution: { width: 0, height: 0 }, viewport: { width: 0, height: 0 }, devicePixelRatio: 1, language: '', platform: '', cookies: {}, localStorage: {}, sessionStorage: {}, timestamp: 0 },
                rrwebEvents: session.events,
                networkLogs: session.networkLogs || [],
                consoleLogs: session.consoleLogs || [],
                annotations: session.annotations || [],
            };

            currentPackage.value = pkg;
            totalTime.value = pkg.metadata.duration;
            hasLoaded.value = true;

            const firstEvent = pkg.rrwebEvents[0] as { timestamp?: number } | undefined;
            recordingBaseTime = firstEvent?.timestamp ?? 0;

            pkg.networkLogs = normalizeNetworkLogs(pkg.networkLogs || []);
            pkg.annotations = normalizeAnnotations(pkg.annotations || []);

            await initRRWebRePlayer(pkg);
            initAnnotations(pkg.annotations);

            await nextTick();
            setupObservers();
        }
        catch (err) {
            console.error('[BugReplay] Failed to load session:', err);
        }
    }

    // 自动检查 URL 参数中的 sessionId，并设置观察器
    onMounted(() => {
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get('sessionId');
        if (sessionId) {
            loadFromSessionId(sessionId);
        }
        // 延迟设置观察器，确保 DOM 已渲染
        nextTick(() => {
            setupObservers();
        });
    });

    onUnmounted(() => {
        teardownObservers();
        cleanup();
    });

    // ============================================================
    // rrweb Replayer
    // ============================================================
    async function initRRWebRePlayer(pkg: RRTPackage) {
        const { Replayer } = await import('rrweb');

        const container = document.getElementById('rrweb-player') || document.querySelector('#rrweb-player');
        if (!container) return;

        // Clear previous
        while (container.firstChild) container.removeChild(container.firstChild);
        (container as HTMLElement).style.display = 'block';

        rrwebRePlayer = new Replayer(pkg.rrwebEvents, {
            root: container as HTMLElement,
            speed: speed.value,
            skipInactive: true,
            showWarning: false,
            showDebug: false,
            mouseTail: false,
            // 允许回放页面执行脚本
            UNSAFE_PLAYBACK_MODE: true,
        });

        // 自定义鼠标光标 — 比 rrweb 内置光标更显眼
        initCustomCursor(container as HTMLElement, pkg.rrwebEvents);

        // 渲染第一帧并缩放
        showFirstFrame();
        await nextTick();
        syncContentScale();
    }

    function showFirstFrame(): void {
        if (!rrwebRePlayer) return;
        rrwebRePlayer.play(0);
        setTimeout(() => {
            rrwebRePlayer?.pause();
            syncContentScale();
        }, 250);
    }

    // ============================================================
    // 自定义鼠标光标
    // ============================================================
    function initCustomCursor(container: HTMLElement, events: any[]) {
        // 创建与 iframe 同步缩放的 wrapper
        cursorWrapper = document.createElement('div');
        cursorWrapper.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:20;';
        container.appendChild(cursorWrapper);

        // 创建光标元素（在 wrapper 内，使用原始坐标）
        cursorEl = document.createElement('div');
        cursorEl.className = 'custom-cursor';
        cursorEl.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M5 3l14 6-6 3-3 6-5-15z" fill="#cba6f7" stroke="#0a0a10" stroke-width="1.5"/>
            </svg>
        `;
        cursorEl.style.cssText = `
            position: absolute;
            pointer-events: none;
            display: none;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
            transition: left 0.05s linear, top 0.05s linear;
        `;
        cursorWrapper.appendChild(cursorEl);

        // 解析所有鼠标位置（从 rrweb 事件中提取 mousemove 坐标）
        mousePositions = [];
        for (const ev of events) {
            // source: 1 = MouseMove
            if (ev.type === 3 && ev.data?.source === 1 && ev.data?.positions) {
                const baseTime = ev.timestamp - recordingBaseTime;
                const positions: { x: number; y: number; timeOffset: number }[] = ev.data.positions;
                for (const pos of positions) {
                    // 跳过明显异常的坐标（如 (0,0) 且前面有正常位置）
                    if (pos.x === 0 && pos.y === 0 && mousePositions.length > 0) continue;
                    mousePositions.push({
                        time: baseTime + pos.timeOffset,
                        x: pos.x,
                        y: pos.y,
                    });
                }
            }
            // source: 2 = MouseInteraction（点击等）——只在有有效坐标时才记录
            if (ev.type === 3 && ev.data?.source === 2) {
                const ix = ev.data.x as number | undefined;
                const iy = ev.data.y as number | undefined;
                // 如果坐标有效（非 undefined 且非全 0），记录位置
                if (typeof ix === 'number' && typeof iy === 'number' && (ix !== 0 || iy !== 0)) {
                    mousePositions.push({
                        time: ev.timestamp - recordingBaseTime,
                        x: ix,
                        y: iy,
                    });
                }
            }
        }
        // 按时间排序
        mousePositions.sort((a, b) => a.time - b.time);
    }

    /** 根据当前回放时间更新光标位置 */
    function updateCursorPosition(time: number) {
        if (!cursorEl || mousePositions.length === 0) return;

        // 二分查找 <= time 的最后一个位置
        let lo = 0;
        let hi = mousePositions.length - 1;
        let found = -1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (mousePositions[mid].time <= time) {
                found = mid;
                lo = mid + 1;
            }
            else {
                hi = mid - 1;
            }
        }

        if (found >= 0) {
            const pos = mousePositions[found];
            cursorPos = { x: pos.x, y: pos.y, visible: true };
            cursorEl.style.display = 'block';
            cursorEl.style.left = `${pos.x}px`;
            cursorEl.style.top = `${pos.y}px`;
        }
        else {
            if (cursorPos.visible) {
                cursorEl.style.display = 'none';
                cursorPos.visible = false;
            }
        }
    }

    // ============================================================
    // Playback Controls
    // ============================================================
    function togglePlayPause() {
        if (!rrwebRePlayer) return;

        if (isPlaying.value) {
            pause();
        }
        else {
            play();
        }
    }

    function play() {
        if (!rrwebRePlayer) return;
        isPlaying.value = true;
        playStartTime = performance.now();
        playStartOffset = currentTime.value;
        rrwebRePlayer.play(currentTime.value);
        startPlaybackLoop();
    }

    function pause() {
        if (!rrwebRePlayer) return;
        isPlaying.value = false;
        rrwebRePlayer.pause();
        stopPlaybackLoop();
    }

    function seekTo(time: number) {
        if (!rrwebRePlayer) return;
        const target = Math.max(0, Math.min(totalTime.value, time));
        currentTime.value = target;
        playStartOffset = target;
        rrwebRePlayer.play(target);
        rrwebRePlayer.pause();
        isPlaying.value = false;
        stopPlaybackLoop();
        updateAnnotationOverlay(currentTime.value);
        updateCursorPosition(currentTime.value);
    }

    function setSpeed(s: number) {
        speed.value = s;
        if (rrwebRePlayer) {
            rrwebRePlayer.setConfig({ speed: s });
        }
    }

    function stepForward() {
        seekTo(Math.min(totalTime.value, currentTime.value + 1000));
    }

    function stepBack() {
        seekTo(Math.max(0, currentTime.value - 1000));
    }

    function replay() {
        if (!rrwebRePlayer) return;
        stopPlaybackLoop();
        currentTime.value = 0;
        rrwebRePlayer.play(0);
        rrwebRePlayer.pause();
        isPlaying.value = false;
        updateAnnotationOverlay(0);
        updateCursorPosition(0);
        // 自动开始播放
        togglePlayPause();
    }

    // ============================================================
    // Playback Loop — 基于 performance.now() 自主计算进度，不依赖 rrweb 事件回调
    // ============================================================
    function startPlaybackLoop() {
        if (animationFrameId) return;

        function loop() {
            const elapsed = (performance.now() - playStartTime) * speed.value;
            currentTime.value = Math.min(totalTime.value, playStartOffset + elapsed);

            updateAnnotationOverlay(currentTime.value);
            updateCursorPosition(currentTime.value);

            if (currentTime.value >= totalTime.value && totalTime.value > 0) {
                isPlaying.value = false;
                stopPlaybackLoop();
                return;
            }

            animationFrameId = requestAnimationFrame(loop);
        }

        animationFrameId = requestAnimationFrame(loop);
    }

    function stopPlaybackLoop() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    // ============================================================
    // Annotations
    // ============================================================
    let annotationOverlay: any = null;
    let annotationWrapper: HTMLDivElement | null = null;

    /** 归一化标注时间戳：录制时是绝对 Unix 时间，回放需要相对时间（从 0 开始） */
    function normalizeAnnotations(annotations: Annotation[]): Annotation[] {
        if (!recordingBaseTime) return annotations;
        return annotations.map(a => ({
            ...a,
            timestamp: a.timestamp - recordingBaseTime,
        }));
    }

    function normalizeNetworkLogs(logs: NetworkLog[]): NetworkLog[] {
        if (!recordingBaseTime) return logs;
        return logs.map(l => ({
            ...l,
            startTime: l.startTime - recordingBaseTime,
        }));
    }

    function initAnnotations(annotations: Annotation[]) {
        // Dynamic import for Fabric.js (only needed in replayer)
        import('./annotation-overlay').then(({ AnnotationOverlay }) => {
            const container = document.getElementById('rrweb-player');
            if (!container) return;

            const overlay = new AnnotationOverlay();
            overlay.init(container, annotations);
            annotationOverlay = overlay;
            annotationWrapper = overlay.getWrapper();
        });
    }

    function updateAnnotationOverlay(time: number) {
        annotationOverlay?.updateTime(time);
    }

    function toggleAnnotations() {
        showAnnotations.value = annotationOverlay?.toggle() ?? !showAnnotations.value;
        return showAnnotations.value;
    }

    function toggleDevtools() {
        devtoolsVisible.value = !devtoolsVisible.value;
        nextTick(() => syncContentScale());
    }

    // ============================================================
    // Content Scaling
    // ============================================================
    function syncContentScale() {
        const container = document.querySelector('#rrweb-player') as HTMLElement | null;
        if (!container) return;
        const iframe = container.querySelector('iframe') as HTMLIFrameElement | null;
        if (!iframe || !currentPackage.value?.environment?.viewport) return;

        const vw = currentPackage.value.environment.viewport.width;
        const vh = currentPackage.value.environment.viewport.height;
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        if (!cw || !ch || !vw || !vh) return;

        const scale = Math.min(cw / vw, ch / vh, 1);
        const offsetX = (cw - vw * scale) / 2;
        const offsetY = (ch - vh * scale) / 2;

        iframe.style.width = `${vw}px`;
        iframe.style.height = `${vh}px`;
        iframe.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
        iframe.style.transformOrigin = 'top left';

        if (annotationWrapper) {
            annotationWrapper.style.width = `${vw}px`;
            annotationWrapper.style.height = `${vh}px`;
            annotationWrapper.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
            annotationWrapper.style.transformOrigin = 'top left';
            annotationOverlay?.resize(vw, vh);
        }

        // 光标 wrapper 同样同步缩放
        if (cursorWrapper) {
            cursorWrapper.style.width = `${vw}px`;
            cursorWrapper.style.height = `${vh}px`;
            cursorWrapper.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
            cursorWrapper.style.transformOrigin = 'top left';
        }
    }

    function setupObservers() {
        const stageEl = document.querySelector('.stage-wrapper') || document.querySelector('#rrweb-player')?.parentElement;
        if (stageEl) {
            stageResizeObserver = new ResizeObserver(() => syncContentScale());
            stageResizeObserver.observe(stageEl);
        }

        const bottomEl = document.querySelector('.bottom-panel');
        if (bottomEl) {
            bottomPanelMutationObserver = new MutationObserver(() => syncContentScale());
            bottomPanelMutationObserver.observe(bottomEl, {
                attributes: true,
                attributeFilter: ['class', 'style'],
            });
        }
    }

    function teardownObservers() {
        stageResizeObserver?.disconnect();
        stageResizeObserver = null;
        bottomPanelMutationObserver?.disconnect();
        bottomPanelMutationObserver = null;
    }

    // ============================================================
    // Cleanup
    // ============================================================
    function cleanup() {
        stopPlaybackLoop();
        teardownObservers();

        if (rrwebRePlayer) {
            try {
                rrwebRePlayer.destroy?.();
            }
            catch { /* */ }
            rrwebRePlayer = null;
        }

        if (annotationOverlay) {
            try {
                annotationOverlay.destroy();
            }
            catch { /* */ }
            annotationOverlay = null;
        }
        annotationWrapper = null;
        cursorEl = null;
        if (cursorWrapper) {
            cursorWrapper.remove();
            cursorWrapper = null;
        }
        mousePositions = [];
        cursorPos = { x: 0, y: 0, visible: false };

        const container = document.getElementById('rrweb-player');
        if (container) {
            while (container.firstChild) container.removeChild(container.firstChild);
            container.style.display = 'none';
        }

        currentPackage.value = null;
        hasLoaded.value = false;
        currentTime.value = 0;
        totalTime.value = 0;
        isPlaying.value = false;
        showAnnotations.value = true;
        recordingBaseTime = 0;
    }

    return {
        // State
        currentPackage,
        hasLoaded,
        currentTime,
        totalTime,
        isPlaying,
        speed,
        showAnnotations,
        devtoolsVisible,
        // Computed
        metadataTitle,
        // Actions
        loadFile,
        togglePlayPause,
        play,
        pause,
        seekTo,
        setSpeed,
        stepForward,
        stepBack,
        replay,
        toggleAnnotations,
        toggleDevtools,
        syncContentScale,
        cleanup,
    };
}
