'use client'

import { useEffect, useState } from 'react'

type Comment = {
  id: string
  content: string
  author?: {
    name?: string | null
    email?: string | null
    profiles?: { displayName?: string }[]
  }
}

export default function PostComments({ postId }: { postId: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    ;(async () => {
      const res = await fetch(`/api/posts/${postId}/comments`)
      const json = await res.json()
      if (res.ok) setComments(json.comments)
    })()
  }, [postId])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) })
      const json = await res.json()
      if (res.ok) {
        setComments((c) => [...c, json.comment])
        setContent('')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3">
      <div className="space-y-3">
        {comments.map((c) => (
          <div key={c.id} className="text-sm border border-gray-100 rounded p-2">
            <div className="text-xs text-gray-600">{c.author?.profiles?.[0]?.displayName || c.author?.name || c.author?.email}</div>
            <div className="mt-1 text-gray-800 whitespace-pre-wrap">{c.content}</div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="mt-3">
        <textarea value={content} onChange={(e) => setContent(e.target.value)} className="w-full border border-gray-200 rounded p-2 h-20" />
        <div className="flex justify-end mt-2">
          <button type="submit" disabled={loading} className="px-3 py-1 bg-emerald-600 text-white rounded text-sm">
            {loading ? 'Posting...' : 'Comment'}
          </button>
        </div>
      </form>
    </div>
  )
}
