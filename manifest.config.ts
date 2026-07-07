import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
    manifest_version: 3,
    name: 'BugReplay',
    version: '1.0.0',
    description: '一键录制 Bug 现场，生成 .rrt 离线回放文件，100% 还原案发现场',
    author: {
        email: '',
    },
    icons: {
        16: 'icons/icon-16.png',
        48: 'icons/icon-48.png',
        128: 'icons/icon-128.png',
    },
    action: {
        default_popup: 'src/popup/index.html',
        default_title: 'BugReplay',
        default_icon: {
            16: 'icons/icon-16.png',
            48: 'icons/icon-48.png',
            128: 'icons/icon-128.png',
        },
    },
    background: {
        service_worker: 'src/background/service-worker.ts',
        type: 'module',
    },
    content_scripts: [
        {
            matches: ['<all_urls>'],
            js: ['src/content/content-script.ts'],
            run_at: 'document_start',
            all_frames: false,
        },
    ],
    web_accessible_resources: [
        {
            resources: [
                'src/replayer/index.html',
                'src/content/recorder/page-interceptor.js',
                'assets/*',
                'chunks/*',
            ],
            matches: ['<all_urls>'],
        },
    ],
    permissions: [
        'storage',
        'activeTab',
        'scripting',
        'cookies',
        'downloads',
        'tabs',
    ],
    host_permissions: ['<all_urls>'],
    browser_specific_settings: {
        gecko: {
            id: 'bugreplay@example.com',
            strict_min_version: '109.0',
        },
    },
});
