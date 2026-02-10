/**
 * Crash-safe entry point for ATHENA server.
 *
 * TypeScript `import` statements compile to `require()` at the TOP of the
 * compiled JS, so any import-time crash in index.ts kills the process before
 * our startup code (dotenv, console.log, etc.) ever runs.
 *
 * This wrapper catches those crashes and logs them visibly.
 */

// Immediately log so Railway always sees output
console.log('[ATHENA] start.ts — bootstrapping server...');
console.log(`[ATHENA] NODE_ENV=${process.env.NODE_ENV}, PORT=${process.env.PORT}`);
console.log(`[ATHENA] node ${process.version}, pid ${process.pid}`);

// Catch anything that blows up during require/import
process.on('uncaughtException', (err) => {
  console.error('[ATHENA] UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[ATHENA] UNHANDLED REJECTION:', reason);
});

try {
  console.log('[ATHENA] Loading index module...');
  const indexModule = require('./index');
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

  // Start a minimal health server so Railway healthcheck passes
  // and we can see the error in the deploy logs
  const http = require('http');
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
