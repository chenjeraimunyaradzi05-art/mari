'use client'

import { useState } from 'react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/auth/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error || 'Something went wrong')
      } else {
        setMessage('If an account exists, a reset email was sent.')
      }
    } catch (err) {
      console.error(err)
      setError('Network error')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6">Reset password</h1>
        {error && <div className="text-red-600 mb-4">{error}</div>}
        {message && <div className="text-green-700 mb-4">{message}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded"
            />
          </div>

          <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded">
            Send reset email
          </button>
        </form>
      </div>
    </div>
  )
}
