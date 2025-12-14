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
      port: 8080,         // Use common port that's less restricted
      strictPort: false   // Try next port if busy
    },
    base: './',
    build: {
      outDir: 'dist',
      emptyOutDir: true
    },
    // Reduce error verbosity
    logLevel: 'warn',
    clearScreen: false
  };
});
