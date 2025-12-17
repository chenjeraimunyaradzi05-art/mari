import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const id = url.pathname.split('/').filter(Boolean).pop()

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const post = await prisma.post.findUnique({ where: { id } })
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const content = (post.content || post.caption || '').toString()
    const summary = content.length > 240 ? content.slice(0, 237) + '...' : content

    return NextResponse.json({ data: { post, preview: { id: post.id, summary } } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
