import { Redis } from "ioredis";

// Singleton Redis instance
// In a real app, this would connect to process.env.REDIS_URL
// For this environment, we'll use a mock if REDIS_URL is not set
const redisUrl = process.env.REDIS_URL;

class MockRedis {
  private store = new Map<string, string>();

  async get(key: string) {
    return this.store.get(key) || null;
  }

  async set(key: string, value: string, mode?: string, duration?: number) {
    this.store.set(key, value);
    if (mode === "EX" && duration) {
      setTimeout(() => this.store.delete(key), duration * 1000);
    }
    return "OK";
  }

  async del(key: string) {
    return this.store.delete(key) ? 1 : 0;
  }
}

export const redis = redisUrl ? new Redis(redisUrl) : (new MockRedis() as unknown as Redis);

export async function getCached<T>(key: string, fetcher: () => Promise<T>, ttlSeconds = 60): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn(`Redis get error for key ${key}`, e);
  }

  const fresh = await fetcher();

  try {
    if (fresh) {
      await redis.set(key, JSON.stringify(fresh), "EX", ttlSeconds);
    }
  } catch (e) {
    console.warn(`Redis set error for key ${key}`, e);
  }

  return fresh;
}
