const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');
const fs = require('fs');

module.exports = {
  packagerConfig: {
    asar: {
      unpack: '**/*.node',
    },
    name: 'Shri Ram Physio',
    executableName: 'shri-ram-physio',
    appBundleId: 'com.shreeRampPhysio.invoicing',
    extraResource: [
      './prisma',
      './node_modules/.prisma',
    ],
    prune: true,
  },
  rebuildConfig: {},
  hooks: {
    packageAfterCopy: async (config, buildPath, electronVersion, platform, arch) => {
      // Manual copy of native modules to resources folder to ensure complete copy
      const modulesToCopy = [
        'better-sqlite3',
        'bindings',
        'file-uri-to-path',
        '@prisma/adapter-better-sqlite3',
        '@prisma/driver-adapter-utils',
        '@prisma/debug',
        '@prisma/client', // Copy the stub package
        '@prisma/client-runtime-utils', // Required by @prisma/client
        '.prisma' // Copy generated client code folder
      ];

      // buildPath is .../resources/app (before asar)
      const resourcesDir = path.resolve(buildPath, '..');

      console.log('[Hook] Copying native modules to resources...');

      for (const mod of modulesToCopy) {
        // Handle .prisma specially as it's not in node_modules usually? 
        // Wait, it IS in node_modules/.prisma
        const source = path.resolve(__dirname, 'node_modules', mod);
        const dest = path.join(resourcesDir, mod);

        if (fs.existsSync(source)) {
          // Ensure parent dir exists
          const destParent = path.dirname(dest);
          if (!fs.existsSync(destParent)) fs.mkdirSync(destParent, { recursive: true });

          console.log(`[Hook] Copying ${mod} to ${dest}`);
          // Copy recursively, following symlinks if needed
          fs.cpSync(source, dest, { recursive: true, force: true, dereference: true });
        } else {
          console.error(`[Hook] SOURCE NOT FOUND: ${source}`);
        }
      }

      // Rebuild better-sqlite3 for Electron
      // This is crucial because we copied the Node.js compiled version
      const betterSqliteDest = path.join(resourcesDir, 'better-sqlite3');
      if (fs.existsSync(betterSqliteDest)) {
        console.log(`[Hook] Rebuilding better-sqlite3 at ${betterSqliteDest} for Electron ${electronVersion}...`);
        try {
          // Use execSync to run electron-rebuild
          // We use 'npx' to access local node_modules binaries
          const { execSync } = require('child_process');
          execSync(`npx electron-rebuild -f -m "${betterSqliteDest}" -v ${electronVersion}`, {
            stdio: 'inherit',
            cwd: __dirname // Run from project root so npx finds local electron-rebuild
          });
          console.log('[Hook] Rebuild complete.');
        } catch (e) {
          console.error('[Hook] Rebuild FAILED:', e);
          // Don't throw, let's see if it works anyway (unlikely but safe)
        }
      }
    }
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'shri-ram-physio',
        setupExe: 'Shri-Ram-Physio-Setup.exe',
        setupIcon: './assets/icon.ico', // Optional: Add your icon
        loadingGif: './assets/install-spinner.gif', // Optional: Custom loading animation
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32'],
    },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'Arinjain111',
          name: 'Shree-ram-physio',
        },
        prerelease: false,
        draft: false, // Changed to false so releases are public for update.electronjs.org
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        // `build` configures the main process and preload scripts
        build: [
          {
            entry: 'electron/main.ts',
            config: 'vite.main.config.mjs',
          },
        ],
        // `renderer` configures all renderer windows
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.mjs',
          },
        ],
      },
    },
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: false,
    }),
  ],
};
