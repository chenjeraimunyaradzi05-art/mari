import { prisma } from '@/lib/prisma'
import PostCard from '@/components/social/PostCard'
import FollowButton from '@/components/FollowButton'

export const dynamic = 'force-dynamic'

type Props = { params: { id: string } }

export default async function ProfilePage({ params }: Props) {
  const { id } = params
  const profile = await prisma.profile.findUnique({ where: { id: Number(id) }, include: { user: true } })
  if (!profile) return <div className="max-w-2xl mx-auto py-8">Profile not found</div>

  const posts = await prisma.post.findMany({ where: { authorId: profile.userId }, orderBy: { createdAt: 'desc' }, take: 20 })

  return (
    <main className="max-w-2xl mx-auto py-8">
      <div className="profile-hero mb-6">
        <img src={profile.avatarPath || '/img/default-avatar.png'} alt="avatar" className="h-24 w-24 rounded-full" />
        <div className="mt-3 flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold">{profile.displayName || profile.user?.name}</h1>
            <p className="text-sm text-gray-500">{profile.summary}</p>
          </div>
          <div>
            <FollowButton target={profile.handle || profile.userId} />
          </div>
        </div>
      </div>

      <section className="posts-list space-y-6">
        {posts.map(p => (
          <PostCard key={p.id} post={{ id: p.id, authorName: profile.displayName || profile.user?.name || 'Unknown', body: p.body, imagePath: p.imagePath || null, createdAt: p.createdAt?.toISOString() }} />
        ))}
      </section>
    </main>
  )
}
