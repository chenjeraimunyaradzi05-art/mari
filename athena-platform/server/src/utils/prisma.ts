import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

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
