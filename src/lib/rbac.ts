import { NextResponse } from 'next/server'

export type Role = 'admin' | 'creator' | 'business' | 'member' | 'franchise'

// mapping of protected path prefixes to required role
const ROLE_MAP: Array<{ prefix: string; role: Role }> = [
  { prefix: '/dashboard/admin', role: 'admin' },
  { prefix: '/admin', role: 'admin' },
  { prefix: '/api/admin', role: 'admin' },
  { prefix: '/franchise', role: 'franchise' },
]

export function hasRole(token: any, required: Role | Role[]) {
  if (!token) return false
  const requiredRoles = Array.isArray(required) ? required : [required]
  const tokenRoles: string[] = []
  if (Array.isArray(token.roles)) tokenRoles.push(...token.roles)
  if (typeof token.role === 'string') tokenRoles.push(token.role)
  // allow case-insensitive match
  const normalized = tokenRoles.map((r) => String(r).toLowerCase())
  return requiredRoles.some((rr) => normalized.includes(String(rr).toLowerCase()))
}

export function roleForPath(pathname: string): Role | null {
  const p = ROLE_MAP.find((m) => pathname === m.prefix || pathname.startsWith(m.prefix + '/'))
  return p ? p.role : null
}

export function authorizeByRole(token: any, pathname: string) {
  const required = roleForPath(pathname)
  if (!required) return null
  if (hasRole(token, required)) return null

  // unauthorized: decide response type based on API vs HTML path
  if (pathname.startsWith('/api/')) {
    const res = NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    res.headers.set('x-unauthorized-path', pathname)
    return res
  }

  const url = new URL('/unauthorized', 'https://example.com')
  url.searchParams.set('from', pathname)
  const res = NextResponse.redirect(url)
  res.headers.set('x-unauthorized-path', pathname)
  return res
}

export default { hasRole, roleForPath, authorizeByRole }
