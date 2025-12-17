import { prisma } from '@/lib/prisma'
import PostCard from '@/components/social/PostCard'

export const dynamic = 'force-dynamic'

type Props = { params: { id: string } }

export default async function PostPage({ params }: Props) {
  const { id } = params
  const post = await prisma.post.findUnique({
    where: { id: Number(id) },
    include: { author: { include: { profiles: true } } },
  })

  if (!post) return <div className="max-w-2xl mx-auto py-8">Post not found</div>

  const shape = {
    id: post.id,
    authorName: post.author?.name || 'Unknown',
    authorAvatar: post.author?.profiles?.[0]?.avatarPath || null,
    body: post.body,
    imagePath: post.imagePath || null,
    createdAt: post.createdAt?.toISOString(),
  }

  return (
    <main className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Post</h1>
      <PostCard post={shape} />

      {/* Comments and actions will be added in later conversions */}
    </main>
  )
}
