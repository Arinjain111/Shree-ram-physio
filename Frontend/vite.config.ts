import { defineConfig, UserConfig, PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import path from 'path';

export default defineConfig(async (): Promise<UserConfig> => {
  const tailwindcss = await import('@tailwindcss/vite').then((m) => m.default);
  // ESM-only — must be dynamically imported inside the async config fn,
  // otherwise Vite's CJS plugin loader tries to require() it.
  const { visualizer } = await import('rollup-plugin-visualizer');

  return {
    plugins: [
      react(),
      tailwindcss(),
      visualizer({
        // Filename output. Toggled via the ANALYZE env var so dev builds
        // don't pay the visualizer cost. Open dist/stats.html in a browser.
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
        template: 'treemap',
        enabled: !!process.env.ANALYZE,
      }) as PluginOption,
      electron([
        {
          entry: 'electron/main.ts',
          vite: {
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                external: [
                  'electron',
                  '@prisma/client',
                  '.prisma/client',
                  'better-sqlite3',
                  '@libsql/win32-x64-msvc',
                  '@libsql/*'
                ]
              }
            }
          }
        },
        {
          entry: 'electron/preload.ts',
          vite: {
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron']
              }
            }
          }
        }
      ])
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    server: {
      port: 8080,         // Dev server port used by Electron mainPrisma.ts
      strictPort: true    // Fail fast if 8080 is taken instead of switching ports
    },
    base: './',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: 'esnext',
    },
    logLevel: 'warn',
    clearScreen: false
  };
});
