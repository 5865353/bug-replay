import type { Annotation, RRTPackage } from '@shared/types';
import { computed, onMounted, onUnmounted, ref } from 'vue';
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

            // Initialize rrweb replayer
            await initRRWebRePlayer(pkg);

            // Initialize annotations
            initAnnotations(pkg.annotations || []);
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
                action: 'GET_SESSION',
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

            await initRRWebRePlayer(pkg);
            initAnnotations(pkg.annotations || []);
        }
        catch (err) {
            console.error('[BugReplay] Failed to load session:', err);
        }
    }

    // 自动检查 URL 参数中的 sessionId
    onMounted(() => {
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get('sessionId');
        if (sessionId) {
            loadFromSessionId(sessionId);
        }
    });

    // ============================================================
    // rrweb Replayer
    // ============================================================
    async function initRRWebRePlayer(pkg: RRTPackage) {
        const { Replayer } = await import('rrweb');

        const container = document.getElementById('rrweb-player') || document.querySelector('#rrweb-player');
        if (!container) return;

        // Clear previous
        while (container.firstChild) container.removeChild(container.firstChild)
        ; (container as HTMLElement).style.display = 'block';

        rrwebRePlayer = new Replayer(pkg.rrwebEvents, {
            root: container as HTMLElement,
            speed: speed.value,
            skipInactive: true,
            showWarning: false,
            showDebug: false,
        });
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
        currentTime.value = Math.max(0, Math.min(totalTime.value, time));
        rrwebRePlayer.play(currentTime.value);
        rrwebRePlayer.pause();
        isPlaying.value = false;
        stopPlaybackLoop();
        updateAnnotationOverlay(currentTime.value);
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
        seekTo(0);
        isPlaying.value = false;
        togglePlayPause();
    }

    // ============================================================
    // Playback Loop
    // ============================================================
    function startPlaybackLoop() {
        if (animationFrameId) return;

        function loop() {
            if (!rrwebRePlayer) return;

            const metadata = rrwebRePlayer.getMetaData?.() as { startTime: number; totalTime: number } | undefined;
            if (metadata) {
                currentTime.value = metadata.totalTime;
                totalTime.value = metadata.totalTime || currentPackage.value?.metadata.duration || 0;

                if (currentTime.value >= totalTime.value && totalTime.value > 0) {
                    isPlaying.value = false;
                    stopPlaybackLoop();
                }
            }

            updateAnnotationOverlay(currentTime.value);
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

    function initAnnotations(annotations: Annotation[]) {
        // Dynamic import for Fabric.js (only needed in replayer)
        import('./annotation-overlay').then(({ AnnotationOverlay }) => {
            const container = document.getElementById('rrweb-player')?.parentElement;
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
    }

    // ============================================================
    // Content Scaling
    // ============================================================
    function syncContentScale() {
        const iframe = document.querySelector('#rrweb-player iframe') as HTMLIFrameElement | null;
        if (!iframe || !currentPackage.value?.environment?.viewport) return;

        const vw = currentPackage.value.environment.viewport.width;
        const vh = currentPackage.value.environment.viewport.height;
        const container = iframe.parentElement;
        if (!container) return;

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
    }

    // ============================================================
    // Cleanup
    // ============================================================
    function cleanup() {
        stopPlaybackLoop();

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

        const container = document.getElementById('rrweb-player') || document.querySelector('#rrweb-player');
        if (container) {
            while (container.firstChild) container.removeChild(container.firstChild)
            ; (container as HTMLElement).style.display = 'none';
        }

        hasLoaded.value = false;
        currentPackage.value = null;
    }

    onUnmounted(() => {
        cleanup();
    });

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
