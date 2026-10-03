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
import dotenv from 'dotenv';
import { applyDatabaseUrlDefaults } from './utils/database-url';

dotenv.config();
const databaseUrls = applyDatabaseUrlDefaults();

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
  const migrationDatabaseUrl =
    databaseUrls.directDatabaseUrl ||
    process.env.DIRECT_DATABASE_URL ||
    process.env.DATABASE_DIRECT_URL ||
    process.env.DIRECT_URL;
  const migrationEnv = migrationDatabaseUrl
    ? { ...process.env, DATABASE_URL: migrationDatabaseUrl, DIRECT_DATABASE_URL: migrationDatabaseUrl }
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
  // Sentry before index.ts, not after. Its tracing attaches to express and
  // http as they are first required, and index.ts requires both on its first
  // line, so an init from inside startServer (where it used to be the only
  // one) reported errors but never traced a request. Loaded here rather than
  // imported at the top so that a failure in it is caught below like any
  // other, and a missing DSN is the ordinary "skipping" line.
  try {
    const { initSentry } = await import('./utils/sentry');
    initSentry('before-app');
  } catch (sentryErr) {
    console.error('[ATHENA] Sentry could not be started before the app loaded:', sentryErr);
  }

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
        // A start that failed has to look like one. This used to log and
        // return, so a production environment that validateEnvironmentOrExit
        // refused (it throws) left a process that never listened: the host saw
        // an exit code 0 or a container that hung until its health check timed
        // out, with the reason a few lines up in a log nobody was watching.
        // Exiting non-zero is what makes the deploy fail, say so, and keep the
        // previous release serving.
        process.exit(1);
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

    http
      .createServer((_req: any, res: any) => {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        // The error is in the log above. An import failure's text names file
        // paths and modules, and this server answers anyone who can reach the
        // port, so what the caller gets is only that the start failed.
        res.end(
          JSON.stringify({
            status: 'error',
            message: 'Server failed to start',
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
