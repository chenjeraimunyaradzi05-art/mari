import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_API_URL } from '@/lib/runtime-config';
import {
  FALLBACK_JOBS,
  FALLBACK_POSTS,
  FALLBACK_VIDEOS,
  buildFallbackSearchResults,
  filterFallbackJobs,
  findFallbackJob,
  getFallbackHealthPayload,
} from '@/lib/public-fallbacks';

export const dynamic = 'force-dynamic';

function withFallbackHeaders(response: NextResponse) {
  response.headers.set('x-athena-fallback', '1');
  return response;
}

function buildFallbackResponse(pathname: string, searchParams: URLSearchParams) {
  if (pathname === '/api/health') {
    return withFallbackHeaders(NextResponse.json(getFallbackHealthPayload()));
  }

  if (pathname === '/api/jobs') {
    const page = Math.max(1, Number(searchParams.get('page') || '1'));
    const limit = Math.max(1, Number(searchParams.get('limit') || '10'));
    const filteredJobs = filterFallbackJobs(FALLBACK_JOBS, {
      search: searchParams.get('search') || '',
      location: searchParams.get('city') || '',
      type: searchParams.get('type') || '',
      isRemote: searchParams.get('remote') === 'true',
    });
    const offset = (page - 1) * limit;
    const pagedJobs = filteredJobs.slice(offset, offset + limit);

    return withFallbackHeaders(
      NextResponse.json({
        success: true,
        data: pagedJobs,
        pagination: {
          page,
          limit,
          total: filteredJobs.length,
          pages: Math.max(1, Math.ceil(filteredJobs.length / limit)),
        },
        meta: {
          fallback: true,
          source: 'frontend-fallback',
        },
      })
    );
  }

  if (pathname.startsWith('/api/jobs/')) {
    const jobId = pathname.replace('/api/jobs/', '');
    const fallbackJob = findFallbackJob(jobId);

    if (fallbackJob) {
      return withFallbackHeaders(
        NextResponse.json({
          success: true,
          data: fallbackJob,
          meta: {
            fallback: true,
            source: 'frontend-fallback',
          },
        })
      );
    }
  }

  if (pathname === '/api/posts/feed' || pathname === '/api/feed') {
    const limit = Math.max(1, Number(searchParams.get('limit') || `${FALLBACK_POSTS.length}`));
    const posts = FALLBACK_POSTS.slice(0, limit);

    return withFallbackHeaders(
      NextResponse.json({
        success: true,
        data: posts,
        pagination: {
          page: 1,
          limit,
          total: posts.length,
          pages: 1,
        },
        meta: {
          fallback: true,
          source: 'frontend-fallback',
        },
      })
    );
  }

  if (pathname === '/api/video/feed') {
    const limit = Math.max(1, Number(searchParams.get('limit') || `${FALLBACK_VIDEOS.length}`));
    const videos = FALLBACK_VIDEOS.slice(0, limit);

    return withFallbackHeaders(
      NextResponse.json({
        success: true,
        data: videos,
        nextCursor: null,
        meta: {
          fallback: true,
          source: 'frontend-fallback',
        },
      })
    );
  }

  if (pathname === '/api/search') {
    const query = searchParams.get('q') || '';
    const type = (searchParams.get('type') || 'all') as
      | 'all'
      | 'users'
      | 'posts'
      | 'jobs'
      | 'courses'
      | 'videos'
      | 'mentors';
    const limit = Math.max(1, Number(searchParams.get('limit') || '25'));
    const payload = buildFallbackSearchResults(query, type, limit);

    return withFallbackHeaders(
      NextResponse.json({
        success: true,
        data: payload,
        ...payload,
        meta: {
          fallback: true,
          source: 'frontend-fallback',
        },
      })
    );
  }

  return null;
}

/**
 * Catch-all API proxy – forwards any /api/* request that does NOT have
 * a more-specific Next.js route handler to the configured backend.
 *
 * Specific handlers (e.g. app/api/auth/login/route.ts) always take
 * priority over this catch-all in Next.js App Router routing.
 */
async function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = new URL(request.url);
  const fallbackResponse =
    request.method === 'GET' ? buildFallbackResponse(pathname, searchParams) : null;
  const targetPath = pathname === '/api/health' ? '/health' : pathname;
  const target = `${BACKEND_API_URL}${targetPath}${search}`;

  // Forward essential request headers
  const headers: Record<string, string> = {};
  const forward = ['authorization', 'content-type', 'cookie', 'accept', 'x-request-id'];
  for (const key of forward) {
    const val = request.headers.get(key);
    if (val) headers[key] = val;
  }

  const init: RequestInit = { method: request.method, headers };

  // Forward body for methods that have one
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(target, init);

    if (fallbackResponse && upstream.status >= 400) {
      return fallbackResponse;
    }

    // Stream the response body through
    const body = await upstream.arrayBuffer();
    const res = new NextResponse(body, {
      status: upstream.status,
      statusText: upstream.statusText,
    });

    // Forward response headers (skip hop-by-hop)
    const skip = new Set([
      'transfer-encoding',
      'connection',
      'keep-alive',
      'content-encoding',
    ]);
    upstream.headers.forEach((value, key) => {
      if (!skip.has(key.toLowerCase())) {
        res.headers.set(key, value);
      }
    });

    return res;
  } catch (error) {
    console.error(`[catch-all proxy] ${request.method} ${pathname} →`, error);

    if (fallbackResponse) {
      return fallbackResponse;
    }

    return NextResponse.json(
      { success: false, message: 'Backend unavailable' },
      { status: 502 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
