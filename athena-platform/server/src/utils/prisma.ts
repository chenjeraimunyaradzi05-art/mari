import { neonConfig } from '@neondatabase/serverless';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';
import { applyDatabaseUrlDefaults, isNeonConnectionString } from './database-url';
import { logger } from './logger';

const resolvedDatabaseUrls = applyDatabaseUrlDefaults();
const prismaLog: Prisma.PrismaClientOptions['log'] =
  process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'];

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  if (resolvedDatabaseUrls.databaseUrl && isNeonConnectionString(resolvedDatabaseUrls.databaseUrl)) {
    neonConfig.webSocketConstructor = ws;
    const adapter = new PrismaNeon({ connectionString: resolvedDatabaseUrls.databaseUrl });
    return new PrismaClient({
      adapter,
      log: prismaLog,
    });
  }

  return new PrismaClient({
    log: prismaLog,
  });
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function connectWithRetry(maxAttempts = 5, baseDelay = 500) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      await prisma.$connect();
      return;
    } catch (err) {
      attempt++;
      const delay = baseDelay * Math.pow(2, attempt - 1);
      // A retry that may still succeed, so this is a warning and not an error;
      // the rethrow below is what actually reports the failure. It went to
      // console.warn, which meant the one line explaining a slow start was the
      // one line missing from the log file and from production's JSON output.
      logger.warn('Prisma connection attempt failed; retrying', { attempt, delayMs: delay });
      if (attempt >= maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
