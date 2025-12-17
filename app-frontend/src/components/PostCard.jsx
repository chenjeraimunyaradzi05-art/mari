import React from 'react'

export default function PostCard({ post }){
  return (
    <article style={{ border: '1px solid #eee', padding: 10, marginBottom: 10 }}>
      <div style={{ fontWeight: 600 }}>{post.authorId}</div>
      {post.videoUrl && <video controls src={post.videoUrl} style={{ maxWidth: '100%' }} />}
      {post.content && <p>{post.content}</p>}
      <div>Likes: {post.likesCount}</div>
    </article>
  )
}
