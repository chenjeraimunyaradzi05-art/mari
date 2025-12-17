import React from 'react';
import AppLayout from '../components/layouts/AppLayout';

export default function PostsIndex() {
  const posts = [
    { id: 1, title: 'How to build a career network', excerpt: 'Tips for reaching out to mentors.' },
    { id: 2, title: 'Negotiating your first salary', excerpt: 'Advice from HR professionals.' }
  ];

  return (
    <AppLayout title="Posts">
      <div className="space-y-4">
        {posts.map((post) => (
          <article key={post.id} className="bg-white rounded p-4 shadow">
            <h2 className="text-lg font-bold text-emerald-700">{post.title}</h2>
            <p className="text-gray-600">{post.excerpt}</p>
            <a href={`/posts/${post.id}`} className="text-emerald-600 text-sm">Read more</a>
          </article>
        ))}
      </div>
    </AppLayout>
  );
}
