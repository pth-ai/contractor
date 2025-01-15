import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import wasm from '@rollup/plugin-wasm';

export default [
    // Browser build
    {
        input: 'src/index.ts',
        output: {
            file: 'dist/browser/bundle.js',
            format: 'iife',
            name: 'contractor' // Replace with your library's name
        },
        plugins: [
            typescript({tsconfig: './tsconfig.browser.json'}),
            resolve(),
            commonjs(),
            json(),
            wasm(),
        ]
    },
    // Node.js build
    {
        input: 'src/index.ts',
        output: {
            file: 'dist/node/index.js',
            format: 'cjs'
        },
        plugins: [
            typescript({tsconfig: './tsconfig.node.json'}),
            resolve(),
            commonjs(),
            json(),
            wasm(),
        ]
    }
];
