import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const DEFAULT_LIMIT = 20;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = (searchParams.get('type') || 'jobs').toLowerCase();
  const q = searchParams.get('q') || '';
  const location = searchParams.get('location') || '';
  const seniority = searchParams.get('seniority') || '';
  const tag = searchParams.get('tag') || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT, 50);

  try {
    if (type === 'companies') {
      const companies = await prisma.organization.findMany({
        where: {
          name: { contains: q, mode: 'insensitive' },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ type, results: companies, count: companies.length });
    }

    if (type === 'candidates') {
      const users = await prisma.user.findMany({
        where: {
          role: 'MEMBER',
          AND: [
            q
              ? {
                  OR: [
                    { firstName: { contains: q, mode: 'insensitive' } },
                    { lastName: { contains: q, mode: 'insensitive' } },
                    { email: { contains: q, mode: 'insensitive' } },
                  ],
                }
              : {},
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ type, results: users, count: users.length });
    }

    // jobs (default)
    const posts = await prisma.orgPost.findMany({
      where: {
        visibility: 'public',
        AND: [
          q
            ? {
                OR: [
                  { title: { contains: q, mode: 'insensitive' } },
                  { content: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {},
          location ? { content: { contains: location, mode: 'insensitive' } } : {},
          seniority ? { content: { contains: seniority, mode: 'insensitive' } } : {},
          tag ? { content: { contains: tag, mode: 'insensitive' } } : {},
        ],
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { organization: true },
    });

    return NextResponse.json({ type: 'jobs', results: posts, count: posts.length });
  } catch (error) {
    logger.error('Search API error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
