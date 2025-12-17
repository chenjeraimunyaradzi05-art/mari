import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as unknown as { id?: string })?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const postId = params.id
    const body = await req.json()
    const text = typeof body.body === 'string' ? body.body.trim() : null
    if (!text) return NextResponse.json({ error: 'Body is required' }, { status: 400 })

    const comment = await prisma.comment.create({ data: { postId, authorId: userId, content: text } })
    return NextResponse.json({ comment })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const postId = params.id
    const comments = await prisma.comment.findMany({ where: { postId }, orderBy: { createdAt: 'asc' } })
    return NextResponse.json({ comments })
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
  const comments = await prisma.comment.findMany({ where: { postId: id }, orderBy: { createdAt: 'asc' }, include: { author: { include: { profiles: true } } } })
  return NextResponse.json({ comments })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as unknown as { id?: string })?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = params
    const body = await req.json()
    const { content } = body
    if (!content || typeof content !== 'string' || !content.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 })

    const comment = await prisma.comment.create({ data: { postId: id, authorId: userId, content: content.trim() }, include: { author: { include: { profiles: true } } } })
    return NextResponse.json({ comment })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
