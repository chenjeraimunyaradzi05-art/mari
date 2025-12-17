/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function resolveUserId(idOrHandle: string) {
  // try to find by id first
  const u = await prisma.user.findUnique({ where: { id: idOrHandle } })
  if (u) return u.id
  const profile = await prisma.profile.findUnique({ where: { handle: idOrHandle } })
  return profile?.userId || null
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as unknown as { id?: string })?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { followUser } = await import('../../../../lib/profileHandlers')
    try {
      const result = await followUser(userId, params.id)
      return NextResponse.json(result)
    } catch (e: any) {
      if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status })
      console.error(e)
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as unknown as { id?: string })?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { unfollowUser } = await import('../../../../lib/profileHandlers')
    try {
      const result = await unfollowUser(userId, params.id)
      return NextResponse.json(result)
    } catch (e: any) {
      if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status })
      console.error(e)
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
