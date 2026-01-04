import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let isPatched = false;

function getPackagedNodeModulesPaths(): string[] {
    // Electron Builder layout:
    //   resources/app.asar
    //   resources/app.asar.unpacked
    // Native modules are typically placed under app.asar.unpacked/node_modules
    const resources = process.resourcesPath;
    return [
        path.join(resources, 'app.asar.unpacked', 'node_modules'),
        path.join(resources, 'app.asar', 'node_modules'),
        path.join(resources, 'node_modules'),
        resources,
    ];
}

function requireFirst(candidates: string[]) {
    let lastError: any;
    for (const id of candidates) {
        try {
            log(`Attempting require: ${id}`);
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            return require(id);
        } catch (e: any) {
            lastError = e;
            log(`Require failed for ${id}: ${e?.message ?? e}`);
        }
    }
    throw lastError;
}

function log(message: string) {
    try {
        const logPath = path.join(app.getPath('userData'), 'native_loader.log');
        const timestamp = new Date().toISOString();
        fs.appendFileSync(logPath, `${timestamp} ${message}\n`);
    } catch (e) {
        // ignore
    }
}

export function patchModuleLoading() {
    if (isPatched) return;

    if (app.isPackaged) {
        log('Patching module loading...');
        const Module = require('module');
        // @ts-ignore
        const originalNodeModulePaths = Module._nodeModulePaths;

        const extra = getPackagedNodeModulesPaths();

        // @ts-ignore
        Module._nodeModulePaths = function (from: string) {
            const paths = originalNodeModulePaths.call(this, from);
            // Ensure Electron Builder packaged module locations are searched.
            for (const p of extra) {
                if (!paths.includes(p)) {
                    paths.unshift(p);
                }
            }
            return paths;
        };

        // Also patch globalPaths as backup
        try {
            if (Module.globalPaths) {
                for (const p of extra) {
                    if (!Module.globalPaths.includes(p)) {
                        Module.globalPaths.push(p);
                    }
                }
            }
        } catch (e) {
            // ignore
        }

        isPatched = true;
        log(`[NativeLoader] Patched module paths to include: ${extra.join(', ')}`);
    }
}

export function loadBetterSqlite3() {
    patchModuleLoading();
    try {
        const candidates = app.isPackaged
            ? [
                // Normal resolution first (works when node_modules is in app.asar)
                'better-sqlite3',
                // Electron Builder unpacked native module location
                path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'better-sqlite3'),
                // Fallbacks (older/alternative layouts)
                path.join(process.resourcesPath, 'app.asar', 'node_modules', 'better-sqlite3'),
                path.join(process.resourcesPath, 'node_modules', 'better-sqlite3'),
                path.join(process.resourcesPath, 'better-sqlite3'),
            ]
            : ['better-sqlite3'];

        log(`Loading better-sqlite3 (candidates): ${candidates.join(' | ')}`);
        const db = requireFirst(candidates);
        log('better-sqlite3 loaded successfully.');
        return db;
    } catch (e: any) {
        log(`FAILED to load better-sqlite3: ${e.message}\nStack: ${e.stack}`);
        throw e;
    }
}

export function loadPrismaAdapter() {
    patchModuleLoading();
    try {
        const candidates = app.isPackaged
            ? [
                '@prisma/adapter-better-sqlite3',
                path.join(process.resourcesPath, 'app.asar', 'node_modules', '@prisma', 'adapter-better-sqlite3'),
                path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@prisma', 'adapter-better-sqlite3'),
                path.join(process.resourcesPath, 'node_modules', '@prisma', 'adapter-better-sqlite3'),
                path.join(process.resourcesPath, '@prisma', 'adapter-better-sqlite3'),
            ]
            : ['@prisma/adapter-better-sqlite3'];

        log(`Loading adapter (candidates): ${candidates.join(' | ')}`);
        const adapter = requireFirst(candidates);
        log('Adapter loaded successfully.');
        return adapter.PrismaBetterSqlite3;
    } catch (e: any) {
        log(`FAILED to load adapter: ${e.message}\nStack: ${e.stack}`);
        throw e;
    }
}
