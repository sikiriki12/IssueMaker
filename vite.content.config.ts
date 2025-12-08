import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Separate config for content script - must be IIFE format
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
            entry: resolve(__dirname, 'src/content/index.ts'),
            name: 'IssueMakerContent',
            formats: ['iife'],
            fileName: () => 'content.js',
        },
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
            },
        },
    },
});
