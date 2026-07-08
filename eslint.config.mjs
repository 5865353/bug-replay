import antfu from '@antfu/eslint-config';

export default antfu(
    {
        typescript: true,
        stylistic: {
            indent: 4,
            quotes: 'single',
            semi: true,
        },
        ignores: [
            'dist',
            'node_modules',
            '.vscode',
            '**/*.d.ts',
            './src/content/recorder/page-interceptor.js',
        ],
        globals: {
            browser: 'readonly',
        },
    },

    {
        files: ['**/*.ts', '**/*.js'],
        languageOptions: {
            globals: {
                window: 'readonly',
                document: 'readonly',
                navigator: 'readonly',
                console: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                indexedDB: 'readonly',
                screen: 'readonly',
                fetch: 'readonly',
                Request: 'readonly',
                Response: 'readonly',
                Headers: 'readonly',
                FormData: 'readonly',
                URLSearchParams: 'readonly',
                Blob: 'readonly',
                File: 'readonly',
                XMLHttpRequest: 'readonly',
                HTMLElement: 'readonly',
                HTMLDivElement: 'readonly',
                HTMLButtonElement: 'readonly',
                HTMLSpanElement: 'readonly',
                HTMLInputElement: 'readonly',
                HTMLCanvasElement: 'readonly',
                CanvasRenderingContext2D: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                MouseEvent: 'readonly',
                Event: 'readonly',
            },
        },
        rules: {
            'no-console': 'off',
            'ts/no-explicit-any': 'warn',
            'unused-imports/no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
            }],
            'ts/no-non-null-assertion': 'off',
            'antfu/if-newline': 'off',
        },
    },
);
