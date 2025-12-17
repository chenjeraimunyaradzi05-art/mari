'use client'

import { useEffect, useState } from 'react'

export default function FollowButton({ target }: { target: string }) {
  const [following, setFollowing] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch(`/api/profiles/${encodeURIComponent(target)}/follow/status`, { credentials: 'include' })
        if (!mounted) return
        if (res.ok) {
          const j = await res.json()
          setFollowing(!!j.following)
        } else {
          setFollowing(false)
        }
      } catch (err) {
        console.error(err)
        setFollowing(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [target])

  const toggle = async () => {
    if (following === null) return
    setLoading(true)
    const prev = following
    setFollowing(!prev) // optimistic
    try {
      const method = prev ? 'DELETE' : 'POST'
      const res = await fetch(`/api/profiles/${encodeURIComponent(target)}/follow`, { method, credentials: 'include' })
      if (!res.ok) {
        setFollowing(prev)
      }
    } catch (err) {
      console.error(err)
      setFollowing(prev)
    } finally {
      setLoading(false)
    }
  }

  if (following === null) return <button className="btn btn-ghost" disabled>...</button>

  return (
    <button onClick={toggle} disabled={loading} className={`px-3 py-1 rounded ${following ? 'bg-emerald-600 text-white' : 'bg-gray-100'}`}>
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
