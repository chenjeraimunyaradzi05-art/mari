'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function ResetPassword() {
  const router = useRouter()
  const [token, setToken] = useState('')
  useEffect(() => {
    const p = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    setToken(p?.get('token') || '')
  }, [])
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Invalid token')
      } else {
        setMessage('Password reset successful — redirecting to sign in...')
        setTimeout(() => router.push('/auth/signin'), 1500)
      }
    } catch (err) {
      console.error(err)
      setError('Network error')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6">Set new password</h1>
        {error && <div className="text-red-600 mb-4">{error}</div>}
        {message && <div className="text-green-700 mb-4">{message}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded"
            />
          </div>

          <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded">
            Set password
          </button>
        </form>
      </div>
    </div>
  )
}
