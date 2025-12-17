'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function VerifyPage() {
  const router = useRouter()
  const [message, setMessage] = useState('')

  useEffect(() => {
    const p = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const t = p?.get('token') || ''
    if (!t) return
    ;(async () => {
      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: t }),
        })
        const json = await res.json()
        if (!res.ok) {
          setMessage(json.error || 'Verification failed')
        } else {
          setMessage('Email verified — redirecting to sign in...')
          setTimeout(() => router.push('/auth/signin'), 1500)
        }
      } catch (err) {
        console.error(err)
        setMessage('Network error')
      }
    })()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">Email verification</h1>
        <p>{message || 'Verifying...'}</p>
      </div>
    </div>
  )
}
