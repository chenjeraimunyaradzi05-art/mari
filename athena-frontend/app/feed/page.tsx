"use client"

import { useEffect, useState } from 'react'
import { fetchFeed } from '@/lib/api/feed'
import FeedPostCard from '@/components/cards/FeedPostCard'

export default function FeedPage() {
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    fetchFeed().then((j) => { if (mounted) setPosts(j.posts || []) }).catch(() => {}).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <div className="min-h-screen bg-cream-50 py-8">
      <div className="container">
        <h1 className="text-2xl font-semibold mb-4">For You</h1>
        {loading && <p className="text-gray-600">Loading…</p>}
        {!loading && posts.length === 0 && <p className="text-gray-600">No posts yet.</p>}
        <div className="grid gap-4">
          {posts.map((p) => <FeedPostCard key={p.id} author={p.author || 'Unknown'} content={p.content || p.title || ''} />)}
        </div>
      </div>
    </div>
  )
}
