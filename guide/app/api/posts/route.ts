import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'

const MAX_MEDIA = Number(process.env.MAX_POST_MEDIA || 5)
const MAX_FILE_SIZE = Number(process.env.MAX_POST_FILE_SIZE_BYTES || 12 * 1024 * 1024) // 12 MB
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm'])

function mimeFromFilename(filename) {
  if (!filename) return null
  const ext = (path.extname(filename) || '').toLowerCase()
  if (['.jpg', '.jpeg'].includes(ext)) return 'image/jpeg'
  if (['.png'].includes(ext)) return 'image/png'
  if (['.gif'].includes(ext)) return 'image/gif'
  if (['.mp4'].includes(ext)) return 'video/mp4'
  if (['.webm'].includes(ext)) return 'video/webm'
  return null
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session && session.user && session.user.id ? session.user.id : null
    const { handlePost } = await import('../../../lib/postHandlers')

    const result = await handlePost(req, userId)
    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(req) {
  try {
    const url = new URL(req.url)

    // Support legacy `page` / `per_page` pagination used by the Laravel controller's
    // `loadMore` action. If `page` is provided, return a paginated response with
    // meta + data similar to the original implementation.
    const pageParam = url.searchParams.get('page')
    if (pageParam !== null) {
      const page = Math.max(1, Number(pageParam) || 1)
      const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get('per_page') || '20')))
      const filter = url.searchParams.get('filter') || 'all'

      // Basic filter: currently only 'all' is supported. Keep this extensible.
      const where = filter === 'all' ? {} : { visibility: filter }

      const total = await prisma.post.count({ where })
      const posts = await prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      })

      return NextResponse.json({
        meta: {
          page,
          per_page: perPage,
          total,
          filter,
          has_more: page * perPage < total,
        },
        data: posts,
      })
    }

    const limit = Number(url.searchParams.get('limit') || '20')
    const cursor = url.searchParams.get('cursor')

    const posts = await prisma.post.findMany({
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      include: { author: { include: { profiles: true } } },
    })

    return NextResponse.json({ posts })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
