export async function apiFetch(input: RequestInfo, init?: RequestInit) {
  // Attach auth token from localStorage (set by authStore)
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const headers = new Headers(init?.headers as HeadersInit)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(input, { ...init, headers })

  if (res.status === 401 && token) {
    // Try refresh
    try {
      const authBase = (process.env.NEXT_PUBLIC_AUTH_URL) || 'http://localhost:5001'
      const r = await fetch(`${authBase}/refresh`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } })
      if (r.ok) {
        const j = await r.json()
        if (j.token) {
          localStorage.setItem('token', j.token)
          // retry original request with new token
          headers.set('Authorization', `Bearer ${j.token}`)
          return fetch(input, { ...init, headers })
        }
      }
    } catch (e) {
      // ignore and fallthrough
    }
  }

  return res
}
