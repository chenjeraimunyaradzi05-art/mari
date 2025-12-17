'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ChangePasswordPage() {
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    if (password !== confirm) return setError('Passwords do not match')
    if (password.length < 8) return setError('Password must be at least 8 characters')
    setLoading(true)
    try {
      const res = await fetch('/api/profile/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: password }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Failed to change password')
      } else {
        setMessage('Password changed successfully — redirecting to sign in...')
        setTimeout(() => router.push('/auth/signin'), 1500)
      }
    } catch (err) {
      console.error(err)
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4">Change password</h1>
        {error && <div className="text-red-600 mb-4">{error}</div>}
        {message && <div className="text-green-700 mb-4">{message}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Current password</label>
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2" required />
          </div>

          <div>
            <label className="block text-sm font-medium">New password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2" required />
          </div>

          <div>
            <label className="block text-sm font-medium">Confirm new password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2" required />
          </div>

          <div>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-emerald-600 text-white rounded">
              {loading ? 'Saving...' : 'Change password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}