const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opts,
  });
  if (result.error) {
    console.error(`[build:win] Failed to run: ${command} ${args.join(' ')}`);
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function tryRemoveDir(dirPath) {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true, maxRetries: 10 });
    return true;
  } catch {
    return false;
  }
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

const projectRoot = path.resolve(__dirname, '..');
const builderConfigPath = path.join(projectRoot, 'electron-builder.json');
let builderConfig = {};
try {
  builderConfig = JSON.parse(fs.readFileSync(builderConfigPath, 'utf8'));
} catch {
  // ignore
}

const baseOut = builderConfig?.directories?.output || 'release';
const winUnpacked = path.join(projectRoot, baseOut, 'win-unpacked');

// Try to clean the default output dir first; if it's locked (often by AV scanning app.asar),
// fall back to a fresh output dir so local builds remain unblocked.
let outDirArg = null;
if (fs.existsSync(winUnpacked)) {
  const cleaned = tryRemoveDir(winUnpacked);
  if (!cleaned && fs.existsSync(winUnpacked)) {
    const fallbackOut = `${baseOut}-local-${timestamp()}`;
    outDirArg = `--config.directories.output=${fallbackOut}`;
    console.warn(`[build:win] Could not clean ${winUnpacked} (likely locked).`);
    console.warn(`[build:win] Falling back to output directory: ${fallbackOut}`);
  }
}

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const builderCmd = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder'
);

run(npmCmd, ['run', 'build'], { cwd: projectRoot });

const builderArgs = ['--win'];
if (outDirArg) builderArgs.push(outDirArg);
run(builderCmd, builderArgs, { cwd: projectRoot });
