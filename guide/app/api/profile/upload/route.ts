import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import sharp from 'sharp'
import { uploadBuffer } from '@/lib/storage'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  let userId: string | undefined = (session.user as { id?: string; email?: string })?.id
  if (!userId && session.user?.email) {
    const u = await prisma.user.findUnique({ where: { email: session.user.email } })
    userId = u?.id
  }
  if (!userId) return NextResponse.json({ error: 'no_user' }, { status: 400 })

  const json = (await request.json().catch(() => ({} as Record<string, unknown>))) as Record<string, unknown>
  const fileName = String(json.fileName ?? 'file')
  const contentType = String(json.contentType ?? '')
  let data = String(json.data ?? '')
  const purpose = String(json.purpose ?? 'file') // e.g., 'avatar' or 'cover'

  if (!contentType.startsWith('image/')) {
    return NextResponse.json({ ok: false, error: 'invalid_content_type' }, { status: 400 })
  }

  // accept a data URL or raw base64
  if (data.startsWith('data:')) {
    const idx = data.indexOf(',')
    if (idx >= 0) data = data.slice(idx + 1)
  }

  // basic size guard: ~12MB base64 payload (~9MB binary)
  if (data.length > 12_000_000) return NextResponse.json({ ok: false, error: 'file_too_large' }, { status: 413 })

  const buffer = Buffer.from(data, 'base64')

  try {
    // Process images with sharp depending on purpose
    const base = Date.now().toString()
    const safeBase = `${base}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '-')}`

    // Always upload a standardized optimized file (webp)
    const optimized = await sharp(buffer).webp({ quality: 80 }).toBuffer()
    const optName = `${safeBase}.webp`
    const optPath = await uploadBuffer(optimized, optName, 'image/webp')

    let thumbPath: string | null = null
    if (purpose === 'avatar') {
      const thumb = await sharp(buffer).resize(200, 200, { fit: 'cover' }).webp({ quality: 75 }).toBuffer()
      const thumbName = `${safeBase}-thumb.webp`
      thumbPath = await uploadBuffer(thumb, thumbName, 'image/webp')
    }

    // Optionally store original if needed
    const origName = `${safeBase}-orig`
    const origExt = fileName.includes('.') ? fileName.split('.').pop() : 'bin'
    const origFileName = `${origName}.${origExt}`
    const origPath = await uploadBuffer(buffer, origFileName, contentType)

    return NextResponse.json({ ok: true, path: optPath, thumbnailPath: thumbPath, originalPath: origPath })
  } catch (e) {
    console.error('upload failed', e)
    return NextResponse.json({ ok: false, error: 'processing_failed' }, { status: 500 })
  }
}
