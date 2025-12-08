import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Separate config for page script that runs in MAIN world
export default defineConfig({
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
    build: {
        outDir: 'dist',
        emptyOutDir: false, // Don't clear since main build runs first
        lib: {
            entry: resolve(__dirname, 'src/content/page-script.ts'),
            name: 'IssueMakerPageScript',
            formats: ['iife'],
            fileName: () => 'page-script.js',
        },
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
            },
        },
    },
});
