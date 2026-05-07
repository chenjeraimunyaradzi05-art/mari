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

import { execSync } from 'node:child_process';
import * as http from 'node:http';

console.log('[ATHENA] start.ts — bootstrapping server...');
console.log(`[ATHENA] NODE_ENV=${process.env.NODE_ENV}, PORT=${process.env.PORT}`);
console.log(`[ATHENA] node ${process.version}, pid ${process.pid}`);

// ── Run Prisma migrations ──────────────────────────────────────────────
// This replaces the shell `prisma migrate deploy && node dist/start.js`
// pattern, which can silently fail on some container runtimes.
try {
  const migrationDatabaseUrl =
    process.env.DIRECT_DATABASE_URL || process.env.DATABASE_DIRECT_URL || process.env.DIRECT_URL;
  const migrationEnv = migrationDatabaseUrl
    ? { ...process.env, DATABASE_URL: migrationDatabaseUrl }
    : process.env;

  console.log('[ATHENA] Running prisma migrate deploy...');
  execSync('npx prisma migrate deploy', {
    env: migrationEnv,
    stdio: 'inherit',
    timeout: 180_000,
  });
  console.log('[ATHENA] Prisma migrations complete.');
} catch (migrationErr: any) {
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
    const indexModule = await import('./index');
    console.log('[ATHENA] index module loaded successfully');

    // index.ts exports startServer() — call it to actually boot the server.
    // (require.main !== module inside index.ts, so it won't auto-start)
    if (typeof indexModule.startServer === 'function') {
      console.log('[ATHENA] Calling startServer()...');
      indexModule.startServer().catch((err: Error) => {
        console.error('[ATHENA] startServer() rejected:', err);
      });
    } else {
      console.error('[ATHENA] WARNING: index module has no startServer export!');
    }
  } catch (err) {
    console.error('[ATHENA] FATAL — index.js crashed during load:');
    console.error(err);

    // Start a minimal health server so deploy health checks can surface
    // the startup error instead of leaving the container silent.
    const PORT = process.env.PORT || 5000;
    const errorMessage = err instanceof Error ? err.message : String(err);

    http
      .createServer((_req: any, res: any) => {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'error',
            message: 'Server failed to start',
            error: errorMessage,
          })
        );
      })
      .listen(PORT, () => {
        console.log(`[ATHENA] Emergency health server on port ${PORT}`);
        console.log('[ATHENA] Fix the error above and redeploy.');
      });
  }
}

void bootstrap();
