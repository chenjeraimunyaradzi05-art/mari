import React from 'react'
import PostComments from '@/components/PostComments'
import type { Post } from '@/types/post'

export default function PostCard({ post }: { post: Post }) {
  const profile = post.author.profiles && post.author.profiles[0]
  const postId = String(post.id)
  const display = profile?.displayName || post.author.name || post.author.email || 'Unknown'

  const [likesCount, setLikesCount] = React.useState<number | null>(null)
  const [liked, setLiked] = React.useState(false)

  React.useEffect(() => {
    ;(async () => {
      try {
        const [likesRes, sessionRes] = await Promise.all([
          fetch(`/api/posts/${post.id}/likes`),
          fetch('/api/auth/session'),
        ])
        const likesJson = await likesRes.json()
        const sessionJson = await sessionRes.json()
        const userId = (sessionJson?.user as { id?: string } | undefined)?.id

        if (likesRes.ok) {
          setLikesCount(likesJson.count)
          const users: Array<{ user?: { id?: string } }> = likesJson.users || []
          setLiked(!!userId && users.some((u) => u.user?.id === userId))
        }
      } catch (err) {
        console.error(err)
      }
    })()
  }, [post.id])

  const toggleLike = async () => {
    try {
      if (liked) {
        await fetch(`/api/posts/${post.id}/likes`, { method: 'DELETE' })
        setLiked(false)
        setLikesCount((c) => (c || 0) - 1)
      } else {
        await fetch(`/api/posts/${post.id}/likes`, { method: 'POST' })
        setLiked(true)
        setLikesCount((c) => (c || 0) + 1)
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <article data-post-id={postId} className="bg-white border border-gray-200 rounded p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-700">
          {profile?.displayName ? profile.displayName[0] : (post.author.name || 'U')[0]}
        </div>
        <div className="flex-1">
          {post.imagePath && (
            <div className="mb-3">
              <img src={post.imagePath} alt="post media" className="w-full rounded" />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">{display}</div>
            <div className="text-xs text-gray-500">{new Date(post.createdAt).toLocaleString()}</div>
            {String(post.id).startsWith('temp-') && (
              <div className="ml-2 text-xs text-amber-600 font-semibold">Posting…</div>
            )}
          </div>
          <p className="mt-2 text-gray-800 whitespace-pre-wrap">{post.content}</p>

          <div className="flex items-center gap-3 mt-3 text-sm">
            <button onClick={toggleLike} className={`px-2 py-1 rounded ${liked ? 'bg-rose-500 text-white' : 'bg-gray-100'}`}>
              {liked ? '♥️ Liked' : '♡ Like'} {likesCount !== null ? `· ${likesCount}` : ''}
            </button>
          </div>

          {/* comments */}
          <div className="mt-2">
            <PostComments postId={post.id} />
          </div>
        </div>
      </div>
    </article>
  )
}
