"use client";
import React from 'react';
import Link from 'next/link';

type Post = {
  id: number | string;
  authorName: string;
  authorAvatar?: string | null;
  body: string;
  imagePath?: string | null;
  createdAt?: string;
};

export default function PostCard({ post }: { post: Post }) {
  return (
    <article className="post-card" data-post-id={post.id}>
      <div className="post-header">
        <img src={post.authorAvatar || '/img/default-avatar.png'} alt="avatar" className="avatar" />
        <div>
          <div className="author-name">{post.authorName}</div>
          <div className="post-meta">{new Date(post.createdAt || Date.now()).toLocaleString()}</div>
        </div>
      </div>

      <div className="post-body">
        <p>{post.body}</p>
        {post.imagePath && (
          <div className="post-image">
            <img src={post.imagePath} alt="post image" />
          </div>
        )}
      </div>

      <div className="post-actions">
        <button className="btn btn-link">Like</button>
        <Link href={`/social/posts/${post.id}`}><a className="btn btn-link">Comments</a></Link>
      </div>
    </article>
  );
}
