const fs = require('fs-extra');
const path = require('path');

/**
 * electron-builder afterPack hook
 * Manually copies only the runtime dependencies needed by the app
 * This avoids the infinite recursion bug in electron-builder's node_modules scanner
 */
exports.default = async function afterPack(context) {
  const appOutDir = context.appOutDir;
  const resourcesDir = path.join(appOutDir, 'resources');
  const appDir = path.join(resourcesDir, 'app');
  
  console.log('[afterPack] Copying runtime dependencies...');
  console.log('[afterPack] appOutDir:', appOutDir);
  console.log('[afterPack] resourcesDir:', resourcesDir);
  
  // Create app directory structure
  await fs.ensureDir(appDir);
  await fs.ensureDir(path.join(appDir, 'node_modules'));
  
  // List of production dependencies to copy
  const productionDeps = [
    '@libsql/client',
    '@prisma/adapter-better-sqlite3',
    '@prisma/adapter-libsql',
    '@prisma/client',
    'axios',
    'better-sqlite3',
    'dotenv',
    'electron-updater',
    'googleapis',
    'react',
    'react-dom',
    'react-router-dom',
    'zod',
    // Include dependencies of dependencies that are required at runtime
    'follow-redirects',
    'form-data',
    'proxy-from-env',
    'scheduler',
    // Prisma client generated files
    '.prisma'
  ];
  
  const sourceNodeModules = path.join(context.projectDir, 'node_modules');
  const targetNodeModules = path.join(appDir, 'node_modules');
  
  // Copy each production dependency
  for (const dep of productionDeps) {
    const sourcePath = path.join(sourceNodeModules, dep);
    const targetPath = path.join(targetNodeModules, dep);
    
    if (await fs.pathExists(sourcePath)) {
      try {
        await fs.copy(sourcePath, targetPath, {
          filter: (src) => {
            // Skip unnecessary files
            const basename = path.basename(src);
            if (basename === '.git' || basename === 'test' || basename === 'tests' || 
                basename === 'docs' || basename === 'examples' || basename === '.github') {
              return false;
            }
            // Skip markdown and typescript definition files (except package.json)
            if (src.endsWith('.md') || src.endsWith('.d.ts') || src.endsWith('.ts.map')) {
              return false;
            }
            return true;
          }
        });
        console.log(`[afterPack] ✓ Copied: ${dep}`);
      } catch (error) {
        console.error(`[afterPack] ✗ Failed to copy ${dep}:`, error.message);
      }
    } else {
      console.warn(`[afterPack] ⚠ Not found: ${dep}`);
    }
  }
  
  // Copy package.json to app directory
  const sourcePackageJson = path.join(context.projectDir, 'package.json');
  const targetPackageJson = path.join(appDir, 'package.json');
  await fs.copy(sourcePackageJson, targetPackageJson);
  console.log('[afterPack] ✓ Copied package.json');
  
  console.log('[afterPack] Completed copying runtime dependencies');
};
