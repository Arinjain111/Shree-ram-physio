import type { PrismaClient as PrismaClientType } from '@prisma/client';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

import { loadBetterSqlite3, loadPrismaAdapter } from '../lib/nativeLoader';

// Dynamic imports for native modules
let Database: any;
let PrismaBetterSqlite3: any;

function loadNativeModules() {
    if (Database && PrismaBetterSqlite3) return; // Already loaded

    try {
        logToFile(`Loading native modules via loader...`);
        Database = loadBetterSqlite3();
        PrismaBetterSqlite3 = loadPrismaAdapter();
        logToFile('Native modules loaded.');
    } catch (e: any) {
        logToFile(`Fatal error loading modules: ${e.message}`);
        throw e;
    }
}

// Simple file logger for startup debugging
function logToFile(message: string) {
    try {
        const logPath = path.join(app.getPath('userData'), 'startup_debug.log');
        const timestamp = new Date().toISOString();
        fs.appendFileSync(logPath, `${timestamp} [PrismaLoader] ${message}\n`);
    } catch (e) {
        // ignore logging errors
    }
}

// Create Prisma Client with dynamic SQLite path
let prismaClient: PrismaClientType | null = null;
let sqliteDb: any | null = null;

/**
 * For Electron packaged apps with Prisma, we need to use the driver adapter approach
 * which bypasses the normal Prisma client loading mechanism entirely.
 * Since we're using better-sqlite3 + adapter, we don't actually need the generated
 * Prisma client's query engine - we just need the schema types and client wrapper.
 */
function getPrismaClientConstructor() {
    logToFile('getPrismaClientConstructor called');
    const possiblePaths: string[] = [];

    try {
        if (app.isPackaged) {
            logToFile(`Running in PACKAGED mode. resourcesPath: ${process.resourcesPath}`);

            // Prefer normal Node resolution first (Electron Builder packs node_modules into app.asar)
            try {
                const m = require('@prisma/client');
                if (m?.PrismaClient) {
                    logToFile('Loaded PrismaClient via require(@prisma/client)');
                    return m.PrismaClient;
                }
                logToFile('require(@prisma/client) succeeded but PrismaClient export missing');
            } catch (e: any) {
                logToFile(`require(@prisma/client) failed: ${e.message}`);
            }

            // We expect the client to be at resources/.prisma/client/index.js
            // This is because we manually copy '.prisma' folder to 'resources/.prisma'
            possiblePaths.push(path.join(process.resourcesPath, '.prisma', 'client', 'index.js'));

            // Electron Builder common locations
            possiblePaths.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '.prisma', 'client', 'index.js'));
            possiblePaths.push(path.join(process.resourcesPath, 'app.asar', 'node_modules', '.prisma', 'client', 'index.js'));
            possiblePaths.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@prisma', 'client', 'index.js'));
            possiblePaths.push(path.join(process.resourcesPath, 'app.asar', 'node_modules', '@prisma', 'client', 'index.js'));

            // Fallback: standard node_modules location if structure differs
            possiblePaths.push(path.join(process.resourcesPath, 'node_modules', '.prisma', 'client', 'index.js'));
            possiblePaths.push(path.join(process.resourcesPath, '@prisma', 'client', 'index.js')); // Stub?

            for (const p of possiblePaths) {
                logToFile(`Checking path: ${p}`);
                if (fs.existsSync(p)) {
                    logToFile(`Found file at ${p}`);
                    try {
                        const m = require(p);
                        if (m.PrismaClient) {
                            logToFile('Successfully loaded PrismaClient');
                            return m.PrismaClient;
                        } else {
                            logToFile(`Loaded module at ${p} but PrismaClient export is missing`);
                        }
                    } catch (e: any) {
                        logToFile(`Failed to require ${p}: ${e.message}`);
                    }
                }
            }

            // If we are here, we failed.
            const resourcesContent = fs.existsSync(process.resourcesPath)
                ? fs.readdirSync(process.resourcesPath).join(', ')
                : 'Resources folder not found';

            throw new Error(`PrismaClient not found.\nChecked paths:\n${possiblePaths.join('\n')}\nResources content: ${resourcesContent}`);

        } else {
            // Development mode
            logToFile('Running in DEVELOPMENT mode');
            return require('@prisma/client').PrismaClient;
        }

    } catch (error: any) {
        logToFile(`getPrismaClientConstructor FATAL ERROR: ${error.message}\n${error.stack}`);
        throw error;
    }
}

export function getPrismaClient(): PrismaClientType {
    if (!prismaClient) {
        logToFile('getPrismaClient: initializing new instance');

        // Load native modules (better-sqlite3, adapter, etc)
        loadNativeModules();

        try {
            const PrismaClient = getPrismaClientConstructor();

            const dbPath = path.join(app.getPath('userData'), 'shri-ram-physio.db');
            logToFile(`Database path: ${dbPath}`);

            // Ensure DB directory exists
            const dbDir = path.dirname(dbPath);
            if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

            logToFile('Initializing adapter with URL...');
            const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
            logToFile('Adapter created.');

            logToFile('Initializing PrismaClient...');
            prismaClient = new PrismaClient({
                adapter,
                log: ['info', 'warn', 'error'],
            }) as PrismaClientType;

            logToFile('PrismaClient created successfully!');

        } catch (error: any) {
            logToFile(`getPrismaClient ERROR: ${error.message}\n${error.stack}`);
            throw error;
        }
    }

    return prismaClient;
}

export async function disconnectPrisma() {
    if (prismaClient) {
        await prismaClient.$disconnect();
        prismaClient = null;
    }
    if (sqliteDb) {
        sqliteDb.close();
        sqliteDb = null;
    }
}

export default getPrismaClient;
