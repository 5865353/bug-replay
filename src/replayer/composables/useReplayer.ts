import { ref, computed, onUnmounted } from 'vue'
import type { RRTPackage, ReplayState, Annotation, NetworkLog, ConsoleLog } from '@shared/types'
import { formatTime } from '@shared/utils'

export function useReplayer() {
    // ============================================================
    // State
    // ============================================================
    const currentPackage = ref<RRTPackage | null>(null)
    const hasLoaded = ref(false)
    const replayState = ref<ReplayState>({
        isPlaying: false,
        currentTime: 0,
        totalTime: 0,
        speed: 1,
        showAnnotations: true,
        activeTab: 'console',
    })

    const showAnnotations = ref(true)
    const devtoolsVisible = ref(true)
    const currentTime = ref(0)
    const totalTime = ref(0)
    const isPlaying = ref(false)
    const speed = ref(1)

    let rrwebReplayer: any = null
    let animationFrameId: number | null = null
    let lastFrameTime = 0
    let recordingBaseTime = 0

    // ============================================================
    // Computed
    // ============================================================
    const metadataTitle = computed(() => currentPackage.value?.metadata?.title || '回放')

    // ============================================================
    // File Loading
    // ============================================================
    async function loadFile(file: File) {
        try {
            const text = await file.text()
            const pkg: RRTPackage = JSON.parse(text)

            // Validate
            if (!pkg.rrwebEvents || !Array.isArray(pkg.rrwebEvents)) {
                throw new Error('Invalid .rrt file: missing rrwebEvents')
            }

            cleanup()

            currentPackage.value = pkg
            totalTime.value = pkg.metadata.duration
            hasLoaded.value = true

            // Initialize rrweb replayer
            await initRRWebReplayer(pkg)

            // Initialize annotations
            initAnnotations(pkg.annotations || [])

        } catch (err) {
            console.error('[BugReplay] Failed to load file:', err)
            alert(`文件加载失败: ${err instanceof Error ? err.message : '未知错误'}`)
        }
    }

    // ============================================================
    // rrweb Replayer
    // ============================================================
    async function initRRWebReplayer(pkg: RRTPackage) {
        const { Replayer } = await import('rrweb')

        const container = document.getElementById('rrweb-player') || document.querySelector('#rrweb-player')
        if (!container) return

        // Clear previous
        while (container.firstChild) container.removeChild(container.firstChild)
            ; (container as HTMLElement).style.display = 'block'

        rrwebReplayer = new Replayer(pkg.rrwebEvents, {
            root: container as HTMLElement,
            speed: speed.value,
            skipInactive: true,
            showWarning: false,
            showDebug: false,
        })

        // Get base time from first event
        if (pkg.rrwebEvents.length > 0) {
            recordingBaseTime = pkg.rrwebEvents[0].timestamp
        }
    }

    // ============================================================
    // Playback Controls
    // ============================================================
    function togglePlayPause() {
        if (!rrwebReplayer) return

        if (isPlaying.value) {
            pause()
        } else {
            play()
        }
    }

    function play() {
        if (!rrwebReplayer) return
        isPlaying.value = true
        rrwebReplayer.play(currentTime.value)
        lastFrameTime = performance.now()
        startPlaybackLoop()
    }

    function pause() {
        if (!rrwebReplayer) return
        isPlaying.value = false
        rrwebReplayer.pause()
        stopPlaybackLoop()
    }

    function seekTo(time: number) {
        if (!rrwebReplayer) return
        currentTime.value = Math.max(0, Math.min(totalTime.value, time))
        rrwebReplayer.play(currentTime.value)
        rrwebReplayer.pause()
        isPlaying.value = false
        stopPlaybackLoop()
        updateAnnotationOverlay(currentTime.value)
    }

    function setSpeed(s: number) {
        speed.value = s
        if (rrwebReplayer) {
            rrwebReplayer.setConfig({ speed: s })
        }
    }

    function stepForward() {
        seekTo(Math.min(totalTime.value, currentTime.value + 1000))
    }

    function stepBack() {
        seekTo(Math.max(0, currentTime.value - 1000))
    }

    function replay() {
        seekTo(0)
        isPlaying.value = false
        togglePlayPause()
    }

    // ============================================================
    // Playback Loop
    // ============================================================
    function startPlaybackLoop() {
        if (animationFrameId) return

        function loop() {
            if (!rrwebReplayer) return

            const metadata = rrwebReplayer.getMetaData?.() as { startTime: number; totalTime: number } | undefined
            if (metadata) {
                currentTime.value = metadata.totalTime
                totalTime.value = metadata.totalTime || currentPackage.value?.metadata.duration || 0

                if (currentTime.value >= totalTime.value && totalTime.value > 0) {
                    isPlaying.value = false
                    stopPlaybackLoop()
                }
            }

            updateAnnotationOverlay(currentTime.value)
            animationFrameId = requestAnimationFrame(loop)
        }

        animationFrameId = requestAnimationFrame(loop)
    }

    function stopPlaybackLoop() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId)
            animationFrameId = null
        }
    }

    // ============================================================
    // Annotations
    // ============================================================
    let annotationOverlay: any = null
    let annotationWrapper: HTMLDivElement | null = null

    function initAnnotations(annotations: Annotation[]) {
        // Dynamic import for Fabric.js (only needed in replayer)
        import('./annotation-overlay').then(({ AnnotationOverlay }) => {
            const container = document.getElementById('rrweb-player')?.parentElement
            if (!container) return

            const overlay = new AnnotationOverlay()
            overlay.init(container, annotations)
            annotationOverlay = overlay
            annotationWrapper = overlay.getWrapper()
        })
    }

    function updateAnnotationOverlay(time: number) {
        annotationOverlay?.updateTime(time)
    }

    function toggleAnnotations() {
        showAnnotations.value = annotationOverlay?.toggle() ?? !showAnnotations.value
        return showAnnotations.value
    }

    function toggleDevtools() {
        devtoolsVisible.value = !devtoolsVisible.value
    }

    // ============================================================
    // Content Scaling
    // ============================================================
    function syncContentScale() {
        const iframe = document.querySelector('#rrweb-player iframe') as HTMLIFrameElement | null
        if (!iframe || !currentPackage.value?.environment?.viewport) return

        const vw = currentPackage.value.environment.viewport.width
        const vh = currentPackage.value.environment.viewport.height
        const container = iframe.parentElement
        if (!container) return

        const cw = container.clientWidth
        const ch = container.clientHeight
        if (!cw || !ch || !vw || !vh) return

        const scale = Math.min(cw / vw, ch / vh, 1)
        const offsetX = (cw - vw * scale) / 2
        const offsetY = (ch - vh * scale) / 2

        iframe.style.width = `${vw}px`
        iframe.style.height = `${vh}px`
        iframe.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`
        iframe.style.transformOrigin = 'top left'

        if (annotationWrapper) {
            annotationWrapper.style.width = `${vw}px`
            annotationWrapper.style.height = `${vh}px`
            annotationWrapper.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`
            annotationWrapper.style.transformOrigin = 'top left'
            annotationOverlay?.resize(vw, vh)
        }
    }

    // ============================================================
    // Cleanup
    // ============================================================
    function cleanup() {
        stopPlaybackLoop()

        if (rrwebReplayer) {
            try { rrwebReplayer.destroy?.() } catch { /* */ }
            rrwebReplayer = null
        }

        if (annotationOverlay) {
            try { annotationOverlay.destroy() } catch { /* */ }
            annotationOverlay = null
        }

        const container = document.getElementById('rrweb-player') || document.querySelector('#rrweb-player')
        if (container) {
            while (container.firstChild) container.removeChild(container.firstChild)
                ; (container as HTMLElement).style.display = 'none'
        }

        hasLoaded.value = false
        currentPackage.value = null
    }

    onUnmounted(() => {
        cleanup()
    })

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
    }
}
