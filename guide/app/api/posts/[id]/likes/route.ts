import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as unknown as { id?: string })?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = params.id
    // create like, ignore duplicates via upsert
    await prisma.like.create({ data: { postId: id, userId } })
    const count = await prisma.like.count({ where: { postId: id } })
    return NextResponse.json({ liked: true, likes_count: count })
  } catch (err: any) {
    // Unique constraint duplicate (if Prisma returns it) — still succeed
    if (err?.code === 'P2002') {
      const count = await prisma.like.count({ where: { postId: params.id } })
      return NextResponse.json({ liked: true, likes_count: count })
    }
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as unknown as { id?: string })?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = params.id
    await prisma.like.deleteMany({ where: { postId: id, userId } })
    const count = await prisma.like.count({ where: { postId: id } })
    return NextResponse.json({ liked: false, likes_count: count })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { id } = params
  const count = await prisma.like.count({ where: { postId: id } })
  const users = await prisma.like.findMany({ where: { postId: id }, include: { user: { include: { profiles: true } } }, take: 10 })
  return NextResponse.json({ count, users })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as unknown as { id?: string })?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = params
    // create unique like (prisma unique constrains will prevent duplicates)
    const like = await prisma.like.create({ data: { postId: id, userId } })
    return NextResponse.json({ like })
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

    const { id } = params
    await prisma.like.deleteMany({ where: { postId: id, userId } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
