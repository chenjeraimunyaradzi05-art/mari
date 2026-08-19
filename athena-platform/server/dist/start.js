"use strict";
/**
 * Crash-safe entry point for ATHENA server.
 *
 * TypeScript `import` statements compile to `require()` at the TOP of the
 * compiled JS, so any import-time crash in index.ts kills the process before
 * our startup code (dotenv, console.log, etc.) ever runs.
 *
 * This wrapper catches those crashes and logs them visibly.
 *
 * It also runs Prisma migrations before starting the server, eliminating
 * the need for shell-level command chaining (which can fail silently on
 * some container runtimes).
 */
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_child_process_1 = require("node:child_process");
const http = __importStar(require("node:http"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_url_1 = require("./utils/database-url");
dotenv_1.default.config();
const databaseUrls = (0, database_url_1.applyDatabaseUrlDefaults)();
console.log('[ATHENA] start.ts — bootstrapping server...');
console.log(`[ATHENA] NODE_ENV=${process.env.NODE_ENV}, PORT=${process.env.PORT}`);
console.log(`[ATHENA] node ${process.version}, pid ${process.pid}`);
if (databaseUrls.directDatabaseUrlWasDerived) {
    console.warn('[ATHENA] DIRECT_DATABASE_URL was derived from DATABASE_URL for Prisma tooling.');
}
// ── Run Prisma migrations ──────────────────────────────────────────────
// This replaces the shell `prisma migrate deploy && node dist/start.js`
// pattern, which can silently fail on some container runtimes.
try {
    const migrationDatabaseUrl = databaseUrls.directDatabaseUrl ||
        process.env.DIRECT_DATABASE_URL ||
        process.env.DATABASE_DIRECT_URL ||
        process.env.DIRECT_URL;
    const migrationEnv = migrationDatabaseUrl
        ? { ...process.env, DATABASE_URL: migrationDatabaseUrl, DIRECT_DATABASE_URL: migrationDatabaseUrl }
        : process.env;
    console.log('[ATHENA] Running prisma migrate deploy...');
    (0, node_child_process_1.execSync)('npx prisma migrate deploy', {
        env: migrationEnv,
        stdio: 'inherit',
        timeout: 180_000,
    });
    console.log('[ATHENA] Prisma migrations complete.');
}
catch (migrationErr) {
    // Log but do NOT exit — the server should still start so /health can
    // report status and we can diagnose via deploy logs.
    console.error('[ATHENA] Prisma migration failed (server will still start):', migrationErr.message);
}
// Catch anything that blows up during require/import
process.on('uncaughtException', (err) => {
    console.error('[ATHENA] UNCAUGHT EXCEPTION:', err);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    console.error('[ATHENA] UNHANDLED REJECTION:', reason);
});
async function bootstrap() {
    try {
        console.log('[ATHENA] Loading index module...');
        const indexModule = await Promise.resolve().then(() => __importStar(require('./index')));
        console.log('[ATHENA] index module loaded successfully');
        // index.ts exports startServer() — call it to actually boot the server.
        // (require.main !== module inside index.ts, so it won't auto-start)
        if (typeof indexModule.startServer === 'function') {
            console.log('[ATHENA] Calling startServer()...');
            indexModule.startServer().catch((err) => {
                console.error('[ATHENA] startServer() rejected:', err);
            });
        }
        else {
            console.error('[ATHENA] WARNING: index module has no startServer export!');
        }
    }
    catch (err) {
        console.error('[ATHENA] FATAL — index.js crashed during load:');
        console.error(err);
        // Start a minimal health server so deploy health checks can surface
        // the startup error instead of leaving the container silent.
        const PORT = process.env.PORT || 5000;
        const errorMessage = err instanceof Error ? err.message : String(err);
        http
            .createServer((_req, res) => {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'error',
                message: 'Server failed to start',
                error: errorMessage,
            }));
        })
            .listen(PORT, () => {
            console.log(`[ATHENA] Emergency health server on port ${PORT}`);
            console.log('[ATHENA] Fix the error above and redeploy.');
        });
    }
}
void bootstrap();
//# sourceMappingURL=start.js.map