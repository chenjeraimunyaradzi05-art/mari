import type { JobOptions } from 'bull'

export async function enqueueEmail(payload: { to: string; subject: string; text?: string; html?: string }, opts?: JobOptions) {
  // dynamic import to avoid hard dependency at module eval time
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const BullModule = (await import('bull')) as any
  const BullClass = BullModule?.default ?? BullModule
  const redisUrl = process.env.REDIS_URL
  const queueOptions = redisUrl ? { redis: { url: redisUrl } } : undefined

  const queue = new BullClass('email', queueOptions)

  try {
    await queue.add(payload, { attempts: 5, backoff: { type: 'exponential', delay: 1000 }, ...opts })
  } finally {
    // gracefully close producer connection
    try {
      await queue.close()
    } catch {
      // ignore close errors
    }
  }
}
