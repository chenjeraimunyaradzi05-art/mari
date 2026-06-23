import { neonConfig } from '@neondatabase/serverless';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';
import { applyDatabaseUrlDefaults, isNeonConnectionString } from './database-url';

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
      // eslint-disable-next-line no-console
      console.warn(`Prisma connection attempt ${attempt} failed. Retrying in ${delay}ms...`);
      if (attempt >= maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
