/**
 * Closes the connection pool each worker opened.
 *
 * The integration project uses the real `src/utils/prisma` singleton — the
 * whole point being that the code under test talks to Postgres exactly as it
 * does in production — and that client holds sockets open. Without this, Jest
 * finishes the suite and then hangs waiting on handles it cannot name, which
 * reads as a stuck test rather than as an unclosed pool.
 *
 * It is safe when the suite skipped: the client is constructed lazily and
 * disconnecting one that never connected does nothing.
 */

import { prisma } from '../../../src/utils/prisma';

jest.setTimeout(60_000);

afterAll(async () => {
  await prisma.$disconnect();
});
