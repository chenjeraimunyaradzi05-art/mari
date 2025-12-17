import { prisma } from '@/lib/prisma'
import FeedClient from '@/components/FeedClient'

export default async function FeedPage() {
  const posts = await prisma.post.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })

  // serialize dates for client
  const serialized = posts.map((p) => ({ ...p, createdAt: p.createdAt?.toISOString() }))

  return (
    <main className="max-w-2xl mx-auto py-8">
      <h1 className="text-xl font-bold mb-4">Feed</h1>
      {/* @ts-expect-error Server -> Client passing initial posts */}
      <FeedClient initialPosts={serialized} />
    </main>
  )
}
