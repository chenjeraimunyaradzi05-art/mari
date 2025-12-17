"use client"

import { useState } from 'react'

export default function ComposePost({ onCreate }: { onCreate?: (p: any) => void }) {
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError(null)
    if (!body.trim() && !file) return setError('Post cannot be empty')

    const tempId = `temp-${Date.now()}`
    const previewUrl = file ? URL.createObjectURL(file) : null
    const optimistic = { id: tempId, content: body, createdAt: new Date().toISOString(), imagePath: previewUrl, temp: true }
    onCreate?.(optimistic)

    setLoading(true)
    try {
      let res
      if (file) {
        const fd = new FormData()
        fd.append('body', body)
        fd.append('media', file, file.name)
        res = await fetch('/api/posts', { method: 'POST', body: fd })
      } else {
        res = await fetch('/api/posts', { method: 'POST', body: JSON.stringify({ body }), headers: { 'Content-Type': 'application/json' } })
      }

      const j = await res.json()
      if (!res.ok) {
        onCreate?.({ failed: true, tempId })
        setError(j?.error || 'Failed')
      } else {
        // notify parent of confirmed post, include tempId so it can replace optimistic
        onCreate?.({ ...j.post, tempId })
        setBody('')
        setFile(null)
      }
    } catch (err) {
      console.error(err)
      onCreate?.({ failed: true, tempId })
      setError('Network error')
    } finally {
      setLoading(false)
      if (file) URL.revokeObjectURL(file as any)
    }
  }

  return (
    <form onSubmit={submit} className="mb-4">
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share something..." className="w-full p-3 border rounded" rows={4} />
      <div className="mt-2">
        <input type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </div>
      {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
      <div className="mt-2 flex justify-end">
        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
          {loading ? 'Posting...' : 'Post'}
        </button>
      </div>
    </form>
  )
}
