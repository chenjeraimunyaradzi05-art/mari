/**
 * What _prisma_migrations holds for a database that has every migration this
 * build ships with. The implementation is in src/__tests__/applied-migrations.ts,
 * because suites under src/ use it too and the build (rootDir src) cannot reach
 * into tests/; the suites here import it from this path as they always did.
 */

export * from '../../src/__tests__/applied-migrations';
