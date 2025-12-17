import { create } from 'zustand'

interface User {
  id: number
  name: string
  email: string
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  init: async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token) return
    set({ isLoading: true })
    try {
      const authBase = process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:5001'
      const res = await fetch(`${authBase}/me`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const j = await res.json()
        set({ user: j.user, token, isLoading: false })
      } else {
        // try refreshing
        const r = await fetch(`${authBase}/refresh`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
        if (r.ok) {
          const jr = await r.json()
          localStorage.setItem('token', jr.token)
          const me = await fetch(`${authBase}/me`, { headers: { Authorization: `Bearer ${jr.token}` } })
          if (me.ok) { const m = await me.json(); set({ user: m.user, token: jr.token, isLoading: false }) }
        }
      }
    } catch (e) {
      set({ isLoading: false })
    }
  },
  login: async (email, password) => {
    set({ isLoading: true })
    try {
      // Prefer dedicated auth service when available
      const authBase = process.env.NEXT_PUBLIC_AUTH_URL || process.env.NEXT_PUBLIC_MOCK_API_URL || 'http://localhost:5001'
      const res = await fetch(`${authBase}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        // fallback to legacy mock-api login
        const fallback = await fetch(process.env.NEXT_PUBLIC_MOCK_API_URL ? `${process.env.NEXT_PUBLIC_MOCK_API_URL}/api/login` : 'http://localhost:4001/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
        const fj = await fallback.json()
        set({ user: fj.user, token: fj.token ?? 'dev-token', isLoading: false })
        localStorage.setItem('token', fj.token ?? 'dev-token')
        return
      }
      const json = await res.json()
      set({ user: json.user, token: json.token, isLoading: false })
      localStorage.setItem('token', json.token)
    } catch (err) {
      set({ isLoading: false })
      console.error('login error', err)
    }
  },
  logout: () => {
    set({ user: null, token: null })
    localStorage.removeItem('token')
  },
}))
