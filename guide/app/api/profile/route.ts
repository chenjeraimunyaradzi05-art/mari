import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  let userId: string | undefined = (session.user as { id?: string; email?: string })?.id
  if (!userId && session.user?.email) {
    const u = await prisma.user.findUnique({ where: { email: session.user.email } })
    userId = u?.id
  }
  if (!userId) return NextResponse.json({ error: 'no_user' }, { status: 400 })

  const profile = await prisma.profile.findFirst({ where: { userId } })
  return NextResponse.json({ ok: true, profile })
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  let userId: string | undefined = (session.user as { id?: string; email?: string })?.id
  if (!userId && session.user?.email) {
    const u = await prisma.user.findUnique({ where: { email: session.user.email } })
    userId = u?.id
  }
  if (!userId) return NextResponse.json({ error: 'no_user' }, { status: 400 })

  const body = (await request.json().catch(() => ({} as Record<string, unknown>))) as Record<string, unknown>
  const data: Record<string, unknown> = {}
  const allowed = [
    'displayName',
    'handle',
    'bio',
    'pronouns',
    'location',
    'gender',
    'ageBracket',
    'privacyLevel',
    'privacySettings',
    'womenSafetyMode',
    'goals',
    'interests',
    'skills',
    'avatarPath',
    'coverPath',
  ]
  for (const k of allowed) {
    const v = body[k]
    if (v !== undefined) data[k] = v
  }

  // Coerce comma-separated strings into arrays for JSON fields when appropriate
  function coerceArrayField(val: unknown) {
    if (val == null) return val
    if (Array.isArray(val)) return val
    if (typeof val === 'string') {
      return val.split(',').map((s) => s.trim()).filter(Boolean)
    }
    return val
  }

  if (data.skills) data.skills = coerceArrayField(data.skills)
  if (data.interests) data.interests = coerceArrayField(data.interests)
  if (data.goals) data.goals = coerceArrayField(data.goals)

  // accept privacySettings as object or JSON string
  if (body.privacySettings !== undefined) {
    try {
      data.privacySettings = typeof body.privacySettings === 'string' ? JSON.parse(body.privacySettings) : body.privacySettings
    } catch (e) {
      data.privacySettings = body.privacySettings
    }
  }

  // ensure handle uniqueness
  if (data.handle) {
    const clash = await prisma.profile.findUnique({ where: { handle: String(data.handle) } })
    if (clash && clash.userId !== userId) {
      return NextResponse.json({ ok: false, error: 'handle_taken' }, { status: 409 })
    }
  }

  const existing = await prisma.profile.findFirst({ where: { userId } })
  let profile
  if (existing) {
    profile = await prisma.profile.update({ where: { id: existing.id }, data: data as unknown as Prisma.ProfileUpdateInput })
  } else {
    const createData: Prisma.ProfileUncheckedCreateInput = { ...(data as unknown as Prisma.ProfileUncheckedCreateInput) }
    createData.userId = userId
    profile = await prisma.profile.create({ data: createData })
  }

  return NextResponse.json({ ok: true, profile })
}
