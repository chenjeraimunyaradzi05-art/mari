import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function resolveUserId(idOrHandle: string) {
  const u = await prisma.user.findUnique({ where: { id: idOrHandle } })
  if (u) return u.id
  const profile = await prisma.profile.findUnique({ where: { handle: idOrHandle } })
  return profile?.userId || null
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const viewerId = (session?.user as unknown as { id?: string })?.id || null

    const targetIdentifier = params.id
    const targetId = await resolveUserId(targetIdentifier)
    if (!targetId) return NextResponse.json({ error: 'Target not found' }, { status: 404 })

    const followers_count = await prisma.follow.count({ where: { targetId } })
    let following = false
    if (viewerId) {
      const found = await prisma.follow.findFirst({ where: { followerId: viewerId, targetId } })
      following = !!found
    }

    return NextResponse.json({ following, followers_count })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
} 
