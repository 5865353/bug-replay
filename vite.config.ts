import path from 'node:path'
import { crx } from '@crxjs/vite-plugin'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'
import manifest from './manifest.config'

const __dirname = path.resolve()

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
            '@shared': path.resolve(__dirname, 'src/shared'),
            '@content': path.resolve(__dirname, 'src/content'),
            '@background': path.resolve(__dirname, 'src/background'),
            '@replayer': path.resolve(__dirname, 'src/replayer'),
        },
    },
    plugins: [
        vue(),
        UnoCSS(),
        crx({ manifest }),
    ],
    publicDir: path.resolve(__dirname, 'public'),
    server: {
        cors: {
            origin: [
                /chrome-extension:\/\//,
            ],
        },
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: false,
        target: 'es2020',
        rollupOptions: {
            input: {
                replayer: path.resolve(__dirname, 'src/replayer/index.html'),
            },
        },
    },
})
