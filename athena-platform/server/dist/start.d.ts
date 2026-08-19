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
export {};
//# sourceMappingURL=start.d.ts.map