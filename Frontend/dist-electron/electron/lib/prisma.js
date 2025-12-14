"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrismaClient = getPrismaClient;
exports.disconnectPrisma = disconnectPrisma;
const client_1 = require("@prisma/client");
const adapter_libsql_1 = require("@prisma/adapter-libsql");
const electron_1 = require("electron");
const path = __importStar(require("path"));
// Create Prisma Client with dynamic SQLite path
let prismaClient = null;
function getPrismaClient() {
    if (!prismaClient) {
        // Set database path dynamically
        const dbPath = path.join(electron_1.app.getPath('userData'), 'shri-ram-physio.db');
        const url = `file:${dbPath}`;
        // Create Prisma adapter for libSQL (Prisma 7)
        const adapter = new adapter_libsql_1.PrismaLibSql({ url });
        prismaClient = new client_1.PrismaClient({
            adapter,
            // Minimal logging - only errors
            log: ['error'],
        });
    }
    return prismaClient;
}
async function disconnectPrisma() {
    if (prismaClient) {
        await prismaClient.$disconnect();
        prismaClient = null;
    }
}
exports.default = getPrismaClient;
