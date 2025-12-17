import { prisma } from '@/lib/prisma'
import PostsList from '@/components/PostsList'

export const dynamic = 'force-dynamic'

export default async function FeedPage() {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: 'desc' },
    include: { author: { include: { profiles: true } } },
    take: 30,
  })

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Social feed</h1>
      <PostsList initialPosts={posts} />

      <div className="mt-8 text-sm text-gray-500">This is an initial feed conversion — more features (replies, shares, media uploads) coming next.</div>
    </div>
  )
}
