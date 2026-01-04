import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Renderer process Vite config
export default defineConfig(async () => {
    const tailwindcss = await import('@tailwindcss/vite').then((m) => m.default);

    return {
        plugins: [
            react(),
            tailwindcss(),
        ],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        base: './',
        build: {
            outDir: '.vite/renderer/main_window',
            emptyOutDir: true,
            target: 'esnext',
        },
    };
});
