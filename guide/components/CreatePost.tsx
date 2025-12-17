'use client'

import { FormEvent, useState, useEffect } from 'react'

import type { Post } from '@/types/post'

export default function CreatePost({
  onOptimisticCreate,
  onReplace,
  onRemove,
}: {
  onOptimisticCreate?: (post: Post) => void
  onReplace?: (tempId: string, realPost: Post) => void
  onRemove?: (tempId: string) => void
}) {
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<{ displayName?: string; avatarPath?: string } | null>(null)

  const uploadFile = async (f: File) => {
    const fd = new FormData()
    fd.append('file', f)
    const res = await fetch('/api/uploads', { method: 'POST', body: fd })
    if (!res.ok) throw new Error('Upload failed')
    const json = await res.json()
    return json.url as string
  }
  // fetch profile for optimistic author display
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/profile')
        if (res.ok) {
          const j = await res.json()
          setProfile(j.profile || null)
        }
      } catch (err) {
        // ignore
      }
    })()
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!content.trim() && !file) return setError('Content or image required')
    setIsLoading(true)

    try {
      const tempId = `temp-${Date.now()}`
      // create local preview URL for image if present
      const previewUrl = file ? URL.createObjectURL(file) : undefined

      const tempPost: Post = {
        id: tempId,
        content,
        createdAt: new Date().toISOString(),
        imagePath: previewUrl ?? null,
        author: {
          id: 'me',
          name: profile?.displayName || undefined,
          profiles: profile ? [{ displayName: profile.displayName || '', handle: '', avatarPath: profile.avatarPath }] : undefined,
        },
      }

      // optimistic insert
      if (onOptimisticCreate) onOptimisticCreate(tempPost)

      let imagePath: string | undefined
      if (file) {
        imagePath = await uploadFile(file)
      }

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, imagePath }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Failed to post')
        // rollback optimistic
        if (onRemove) onRemove(tempId)
      } else {
        setContent('')
        setFile(null)
        if (onReplace) onReplace(tempId, json.post)
      }
    } catch (err) {
      console.error(err)
      setError('Network error')
      // rollback optimistic
      try {
        if (onRemove) onRemove(`temp-${Date.now()}`)
      } catch (e) {}
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-white border border-gray-200 rounded p-4 mb-4">
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Share something..."
        className="w-full border border-gray-300 rounded p-3 h-20"
      />

      <div className="mt-2">
        <input type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)} />
      </div>

      <div className="flex justify-end mt-2">
        <button type="submit" disabled={isLoading} className="px-4 py-2 bg-emerald-600 text-white rounded">
          {isLoading ? 'Posting...' : 'Post'}
        </button>
      </div>
    </form>
  )
}
