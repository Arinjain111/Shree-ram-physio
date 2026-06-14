// Set the ANALYZE env var before launching Vite so the rollup-plugin-visualizer
// emits dist/stats.html. Run with `npm run analyze`.
//
// Done as a separate ESM file because Vite and rollup-plugin-visualizer are
// both ESM-only; a shell inline `node -e "..."` falls back to `require()` on
// some Windows shells which fails to resolve ESM packages.

process.env.ANALYZE = '1';

import { spawn } from 'node:child_process';

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vite', 'build'],
  { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' }
);

child.on('exit', (code) => process.exit(code ?? 0));
