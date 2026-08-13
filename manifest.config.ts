import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';
import { ZENTAO_HELPER_SCRIPT_PATH } from './src/content/constants';

export default defineManifest({
    manifest_version: 3,
    name: 'BugReplay',
    // 版本号统一来自 package.json，发布时只需改一处
    version: pkg.version,
    description: '一键录制 Bug 现场，生成 .rrt 离线回放文件，100% 还原案发现场',
    author: {
        email: ''
    },
    icons: {
        16: 'icons/icon-16.png',
        48: 'icons/icon-48.png',
        128: 'icons/icon-128.png'
    },
    action: {
        default_popup: 'src/popup/index.html',
        default_title: 'BugReplay',
        default_icon: {
            16: 'icons/icon-16.png',
            48: 'icons/icon-48.png',
            128: 'icons/icon-128.png'
        }
    },
    options_ui: {
        page: 'src/options/index.html',
        open_in_tab: true
    },
    background: {
        service_worker: 'src/background/service-worker.ts',
        type: 'module'
    },
    content_scripts: [
        {
            matches: ['<all_urls>'],
            js: ['src/content/content-script.ts'],
            run_at: 'document_start',
            all_frames: false
        }
    ],
    web_accessible_resources: [
        {
            resources: [
                'src/replayer/index.html',
                'src/upload/index.html',
                'src/content/recorder/page-interceptor.js',
                ZENTAO_HELPER_SCRIPT_PATH,
                'assets/*',
                'chunks/*'
            ],
            matches: ['<all_urls>']
        }
    ],
    permissions: [
        'storage',
        'activeTab',
        'scripting',
        'cookies',
        'downloads',
        'tabs',
        'webRequest'
    ],
    host_permissions: ['<all_urls>'],
    browser_specific_settings: {
        gecko: {
            id: 'bugreplay@example.com',
            strict_min_version: '109.0'
        }
    }
});
