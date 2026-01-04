import { defineConfig, UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

export default defineConfig(async (): Promise<UserConfig> => {
  const tailwindcss = await import('@tailwindcss/vite').then((m) => m.default);

  return {
    plugins: [
      react(),
      tailwindcss(),
      electron([
        {
          entry: 'electron/main.ts',
          vite: {
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                // Do NOT bundle native/db clients; let Electron/Node load them at runtime
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
        }
      ]),
      renderer()
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
