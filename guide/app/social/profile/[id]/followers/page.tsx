import { prisma } from '@/lib/prisma'
import FollowButton from '@/components/FollowButton'

export const dynamic = 'force-dynamic'

export default async function FollowersPage({ params }: { params: { id: string } }) {
  const { id } = params
  // resolve profile by id or handle
  let profile = await prisma.profile.findUnique({ where: { id: Number(id) } })
  if (!profile) profile = await prisma.profile.findUnique({ where: { handle: id } })
  if (!profile) return <div className="max-w-2xl mx-auto py-8">Profile not found</div>

  const followers = await prisma.follow.findMany({ where: { targetId: profile.userId }, include: { follower: { include: { profiles: true } } }, orderBy: { createdAt: 'desc' }, take: 200 })

  return (
    <main className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Followers</h1>
      <div className="space-y-4">
        {followers.map((f) => {
          const p = f.follower.profiles?.[0]
          return (
            <div key={f.id} className="flex items-center justify-between p-3 border rounded">
              <div className="flex items-center gap-3">
                <img src={p?.avatarPath || '/img/default-avatar.png'} alt="avatar" className="w-10 h-10 rounded-full" />
                <div>
                  <div className="font-semibold">{p?.displayName || f.follower.name}</div>
                  <div className="text-sm text-gray-500">@{p?.handle || f.follower.id}</div>
                </div>
              </div>
              <FollowButton target={p?.handle || f.follower.id} />
            </div>
          )
        })}
      </div>
    </main>
  )
}
