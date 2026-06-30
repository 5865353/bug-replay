import { cpSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
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

            // 清理空的 src 子目录（crxjs 嵌套输出后留下的）
            const srcDistDir = resolve(distDir, 'src');
            if (existsSync(srcDistDir)) {
                try {
                    rmSync(srcDistDir, { recursive: true, force: true });
                    console.log('✓ Cleaned up src/ directory');
                } catch {
                    // 忽略清理错误
                }
            }
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
    },
    plugins: [
        crx({ manifest }),
        publicCopyPlugin(),
    ],
});
