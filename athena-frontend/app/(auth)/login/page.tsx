'use client'

import { useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('test@example.com')
  const [password, setPassword] = useState('password')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((s) => s.login)
  const router = useRouter()

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await login(email, password)
    setLoading(false)
    router.push('/feed')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-blush-50">
      <form onSubmit={handle} className="w-full max-w-md bg-white p-6 rounded shadow">
        <h1 className="text-xl font-semibold mb-4">Sign in to ATHENA</h1>
        <label className="block mb-2 text-sm">Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-2 border rounded mb-3" />
        <label className="block mb-2 text-sm">Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="w-full p-2 border rounded mb-4" />
        <button className="w-full py-2 bg-rose-600 text-white rounded">{loading ? 'Signing in…' : 'Sign In'}</button>
      </form>
    </div>
  )
}
