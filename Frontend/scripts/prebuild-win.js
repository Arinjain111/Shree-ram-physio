const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function readBuilderConfig(projectRoot) {
  try {
    const builderPath = path.join(projectRoot, 'electron-builder.json');
    return JSON.parse(fs.readFileSync(builderPath, 'utf8'));
  } catch {
    // ignore
  }
  return {};
}

function tryExec(command) {
  try {
    execSync(command, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
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

// electron-builder fails if previous win-unpacked contents are locked.
// The most common lock is the running app process itself.
const projectRoot = path.resolve(__dirname, '..');
const builderConfig = readBuilderConfig(projectRoot);
const outputDir = builderConfig?.directories?.output || 'release';
const winUnpacked = path.join(projectRoot, outputDir, 'win-unpacked');
const productName = builderConfig?.productName;
const exeName = typeof productName === 'string' && productName.trim() ? `${productName}.exe` : null;

if (exeName) {
  // Kill the full process tree for the app.
  tryExec(`taskkill /F /T /IM "${exeName}"`);
}

// Retry-delete in case Defender/indexers are briefly holding a handle.
// 90s total: 180 * 500ms.
for (let attempt = 1; attempt <= 180; attempt++) {
  if (!fs.existsSync(winUnpacked)) break;

  const removed = tryRemoveDir(winUnpacked);
  if (!fs.existsSync(winUnpacked)) break;
  if (!removed) sleep(500);
}

if (fs.existsSync(winUnpacked)) {
  const nameHint = exeName ? ` (process: ${exeName})` : '';
  console.error(`prebuild:win failed to clean ${winUnpacked}${nameHint}.`);
  console.error('Close any running unpacked/installed app, and close Explorer windows pointing at release_v6.');
  console.error('If it persists, Defender/AV may be scanning app.asar; wait ~1 minute and retry.');
  process.exit(1);
}
