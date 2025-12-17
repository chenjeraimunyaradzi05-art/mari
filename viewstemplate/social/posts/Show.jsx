import React from 'react';

export default function PostShow({ post }) {
  post = post || { id:1, text: 'Detailed post content here' };
  return (
    <div className="bg-white rounded p-4 shadow">
      <h2 className="font-bold">Post by {post.author || 'Anonymous'}</h2>
      <p className="text-gray-700 mt-2">{post.text}</p>
    </div>
  );
}
