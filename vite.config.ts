import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { crx } from '@crxjs/vite-plugin';
import { defineConfig } from 'vite';
import manifest from './src/manifest.json';

// ============================================================
// Vite 插件：构建后将 public/ 目录内容复制到 dist/
// crxjs 已自动处理 manifest 和 HTML 入口，这里只需处理 public 静态资源
// ============================================================
function publicCopyPlugin() {
    return {
        name: 'public-copy',
        closeBundle() {
            const distDir = resolve(__dirname, 'dist');
            const publicDir = resolve(__dirname, 'public');

            // 复制 public/ 目录内容到 dist/（icons 等静态资源）
            if (existsSync(publicDir)) {
                cpSync(publicDir, distDir, { recursive: true });
                console.log('✓ Copied public/ to dist/');
            }

            // 注意：不要删除 dist/src/ 目录！
            // @crxjs/vite-plugin 将 popup.html / replayer/index.html 输出到
            // dist/src/popup/popup.html 和 dist/src/replayer/index.html，
            // manifest.json 中的路径引用也指向这些位置。
        },
    };
}

// ============================================================
// Vite 配置
// ============================================================
export default defineConfig({
    resolve: {
        alias: {
            '@shared': resolve(__dirname, 'src/shared'),
            '@content': resolve(__dirname, 'src/content'),
            '@background': resolve(__dirname, 'src/background'),
            '@replayer': resolve(__dirname, 'src/replayer'),
        },
    },
    publicDir: resolve(__dirname, 'public'),
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: false,
        target: 'es2020',
        rollupOptions: {
            input: {
                replayer: resolve(__dirname, 'src/replayer/index.html'),
            },
        },
    },
    plugins: [crx({ manifest }), publicCopyPlugin()],
});
