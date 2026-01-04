import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let isPatched = false;

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

        // @ts-ignore
        Module._nodeModulePaths = function (from: string) {
            const paths = originalNodeModulePaths.call(this, from);
            // Add resources path to search for modules like better-sqlite3 flat in resources
            if (!paths.includes(process.resourcesPath)) {
                paths.unshift(process.resourcesPath);
            }
            return paths;
        };

        // Also patch globalPaths as backup
        try {
            if (Module.globalPaths && !Module.globalPaths.includes(process.resourcesPath)) {
                Module.globalPaths.push(process.resourcesPath);
            }
        } catch (e) {
            // ignore
        }

        isPatched = true;
        log(`[NativeLoader] Patched module paths to include: ${process.resourcesPath}`);
    }
}

export function loadBetterSqlite3() {
    patchModuleLoading();
    try {
        const modulePath = app.isPackaged
            ? path.join(process.resourcesPath, 'better-sqlite3')
            : 'better-sqlite3';

        log(`Loading better-sqlite3 from: ${modulePath}`);
        const db = require(modulePath);
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
        const modulePath = app.isPackaged
            ? path.join(process.resourcesPath, '@prisma', 'adapter-better-sqlite3')
            : '@prisma/adapter-better-sqlite3';

        log(`Loading adapter from: ${modulePath}`);
        const adapter = require(modulePath);
        log('Adapter loaded successfully.');
        return adapter.PrismaBetterSqlite3;
    } catch (e: any) {
        log(`FAILED to load adapter: ${e.message}\nStack: ${e.stack}`);
        throw e;
    }
}
