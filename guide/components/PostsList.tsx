'use client'

import { useEffect, useState } from 'react'
import PostCard from './PostCard'
import CreatePost from './CreatePost'
import type { Post } from '@/types/post'

export default function PostsList({ initialPosts }: { initialPosts: Post[] }) {
  const [posts, setPosts] = useState<Post[]>(initialPosts || [])

  useEffect(() => {
    setPosts(initialPosts || [])
  }, [initialPosts])

  const handleOptimisticCreate = (post: Post) => {
    setPosts((p) => [post, ...p])
  }

  const handleReplace = (tempId: string, realPost: Post) => {
    setPosts((p) => p.map((x) => (x.id === tempId ? realPost : x)))
  }

  const handleRemove = (tempId: string) => {
    setPosts((p) => p.filter((x) => x.id !== tempId))
  }

  return (
    <div>
      <CreatePost onOptimisticCreate={handleOptimisticCreate} onReplace={handleReplace} onRemove={handleRemove} />
      <div className="space-y-4 mt-4">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </div>
    </div>
  )
}
