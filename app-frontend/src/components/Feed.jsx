import React, { useEffect, useState } from 'react'
import Composer from './Composer'
import PostCard from './PostCard'

export default function Feed(){
  const [posts, setPosts] = useState([])

  async function fetchPosts(){
    const API_BASE = (typeof window !== 'undefined' && window.__VITE_API_URL__) || (typeof process !== 'undefined' && process.env.VITE_API_URL) || ''
    const res = await fetch(API_BASE + '/api/frontend/social/posts')
    if (!res.ok) return
    const data = await res.json()
    setPosts(data)
  }

  useEffect(()=>{ fetchPosts() }, [])

  return (
    <div>
      <Composer onPosted={() => fetchPosts()} />
      <section>
        {posts.map(p => <PostCard key={p.id} post={p} />)}
      </section>
    </div>
  )
}
