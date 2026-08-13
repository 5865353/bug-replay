import { presetRemToPx } from '@unocss/preset-rem-to-px';
import transformerDirectives from '@unocss/transformer-directives';
import { defineConfig, presetUno } from 'unocss';

export default defineConfig({
    presets: [
        presetUno(),
        presetRemToPx({
            baseFontSize: 4
        })
    ],
    shortcuts: {
        'flex-col': 'flex flex-col',
        'flex-center': 'flex justify-center items-center',
        'flex-col-center': 'flex-center flex-col',
        'flex-x-center': 'flex justify-center',
        'flex-y-center': 'flex items-center'
    },
    transformers: [transformerDirectives()]
});
