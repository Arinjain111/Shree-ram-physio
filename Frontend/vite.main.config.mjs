import { defineConfig } from 'vite';
import path from 'path';

// Main process Vite config
export default defineConfig({
    build: {
        outDir: '.vite/build',
        lib: {
            entry: 'electron/main.ts',
            formats: ['cjs'],
            fileName: () => 'main.js',
        },
        rollupOptions: {
            external: [
                // Only native modules and Electron-specific modules should be external
                'electron',
                // Native modules that can't be bundled
                'better-sqlite3',
                '@prisma/adapter-better-sqlite3',
                // Node.js built-in modules
                /^node:/,
            ],
        },
        sourcemap: true,
        minify: false,
    },
    optimizeDeps: {
        include: ['axios']
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
