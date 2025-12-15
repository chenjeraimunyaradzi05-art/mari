import { hasRole, authorizeByRole, roleForPath } from '../../src/lib/rbac'
import { NextResponse } from 'next/server'

describe('RBAC helpers', () => {
  test('hasRole handles string and array roles', () => {
    expect(hasRole({ role: 'admin' }, 'admin')).toBe(true)
    expect(hasRole({ roles: ['creator', 'admin'] }, 'admin')).toBe(true)
    expect(hasRole({ roles: ['creator'] }, ['admin', 'creator'])).toBe(true)
    expect(hasRole({}, 'admin')).toBe(false)
  })

  test('roleForPath returns expected role or null', () => {
    expect(roleForPath('/dashboard/admin')).toBe('admin')
    expect(roleForPath('/dashboard/admin/settings')).toBe('admin')
    expect(roleForPath('/franchise')).toBe('franchise')
    expect(roleForPath('/public')).toBeNull()
  })

  test('authorizeByRole returns null when allowed', () => {
    const token = { role: 'admin' }
    const res = authorizeByRole(token, '/dashboard/admin')
    expect(res).toBeNull()
  })

  test('authorizeByRole returns 403 JSON for API path when unauthorized', () => {
    const token = { role: 'member' }
    const res = authorizeByRole(token, '/api/admin/reports')
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
  })

  test('authorizeByRole redirects for UI path when unauthorized', () => {
    const token = { role: 'member' }
    const res = authorizeByRole(token, '/dashboard/admin')
    expect(res).not.toBeNull()
    // NextResponse.redirect uses status 307 by default for redirects
    expect([301, 302, 303, 307, 308]).toContain(res!.status)
    // ensure the helper added an internal header with the unauthorized path
    const unauthPath = res!.headers.get('x-unauthorized-path') || ''
    expect(unauthPath).toBe('/dashboard/admin')
  })
})
