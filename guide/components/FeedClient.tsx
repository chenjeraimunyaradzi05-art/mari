"use client"

import { useEffect, useState } from 'react'
import ComposePost from './ComposePost'

export default function FeedClient({ initialPosts = [] }: { initialPosts?: any[] }) {
  const [posts, setPosts] = useState<any[]>(initialPosts)

  useEffect(() => {
    // hydrate if initial posts missing
    if (!initialPosts || initialPosts.length === 0) {
      fetch('/api/posts').then((r) => r.json()).then((j) => setPosts(j.posts || []))
    }
  }, [])

  function handleCreate(p: any) {
    // optimistic insertion
    if (p.temp) {
      setPosts((prev) => [p, ...prev])
      return
    }

    // final server response: replace optimistic entry with persisted one
    if (p.tempId) {
      setPosts((prev) => prev.map((x) => (x.id === p.tempId ? { ...p, temp: undefined } : x)))
      return
    }

    // failure of optimistic post
    if (p.failed && p.tempId) {
      setPosts((prev) => prev.filter((x) => x.id !== p.tempId))
      return
    }
  }
+
+  async function postComment(postId: string, text: string) {
+    // optimistic comment id
+    const tempId = `c-temp-${Date.now()}`
+    const optimistic = { id: tempId, content: text, createdAt: new Date().toISOString(), temp: true }
+    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: [...(p.comments || []), optimistic] } : p)))
+
+    try {
+      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/comments`, { method: 'POST', body: JSON.stringify({ body: text }), headers: { 'Content-Type': 'application/json' } })
+      const j = await res.json()
+      if (!res.ok) {
+        // remove optimistic
+        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: (p.comments || []).filter((c: any) => c.id !== tempId) } : p)))
+      } else {
+        // replace optimistic with server comment
+        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: (p.comments || []).map((c: any) => (c.id === tempId ? j.comment : c)) } : p)))
+      }
+    } catch (err) {
+      console.error(err)
+      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: (p.comments || []).filter((c: any) => c.id !== tempId) } : p)))
+    }
+  }
+
+  async function toggleLike(postId: string, currentlyLiked: boolean) {
+    // optimistic
+    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, likes_count: (p.likes_count || 0) + (currentlyLiked ? -1 : 1), liked: !currentlyLiked } : p))
+    try {
+      const method = currentlyLiked ? 'DELETE' : 'POST'
+      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/likes`, { method })
+      const j = await res.json()
+      if (!res.ok) {
+        // revert
+        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, likes_count: (p.likes_count || 0) + (currentlyLiked ? 1 : -1), liked: currentlyLiked } : p))
+      } else {
+        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, likes_count: j.likes_count, liked: !currentlyLiked } : p))
+      }
+    } catch (err) {
+      console.error(err)
+      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, likes_count: (p.likes_count || 0) + (currentlyLiked ? 1 : -1), liked: currentlyLiked } : p))
+    }
+  }

  return (
    <div>
      <ComposePost
        onCreate={(p: any) => handleCreate(p)}
      />

      <div className="space-y-4 mt-6">
        {posts.map((p) => (
          <article key={p.id} className={`p-4 border rounded bg-white ${p.temp ? 'opacity-80' : ''}`} data-post-id={p.id}>
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">{new Date(p.createdAt || Date.now()).toLocaleString()}</div>
              <div>
                <button onClick={() => toggleLike(p.id, !!p.liked)} className="px-2 py-1 rounded bg-gray-100 mr-2">{p.liked ? 'Unlike' : 'Like'}</button>
                <span className="text-sm text-gray-600">{p.likes_count || 0}</span>
              </div>
            </div>
            {p.imagePath && <img src={p.imagePath} alt="post media" className="mt-2 max-h-60 object-cover" />}
            <p className="mt-2">{p.content}</p>
            {p.temp && <div className="text-xs text-gray-500">Posting…</div>}

            <div className="mt-3">
              <div className="space-y-2">
                {(p.comments || []).map((c: any) => (
                  <div key={c.id} className={`text-sm p-2 rounded ${c.temp ? 'opacity-70' : ''}`}>
                    <div className="text-gray-700">{c.content}</div>
                    <div className="text-xs text-gray-500">{new Date(c.createdAt || Date.now()).toLocaleString()}</div>
                  </div>
                ))}
              </div>

              <form onSubmit={(e) => { e.preventDefault(); const v = (e.target as any).elements['comment'].value; (e.target as any).elements['comment'].value = ''; postComment(p.id, v) }} className="mt-2">
                <input name="comment" placeholder="Write a comment..." className="w-full p-2 border rounded" />
              </form>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
