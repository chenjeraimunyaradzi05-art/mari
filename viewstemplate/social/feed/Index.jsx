import React from 'react';
import AppLayout from '../../components/layouts/AppLayout';

export default function FeedIndex() {
  const posts = [{id:1, text: 'Welcome to the feed'}, {id:2, text: 'Another update'}];
  return (
    <AppLayout title="Feed">
      <div className="space-y-4">
        {posts.map(p => (
          <div key={p.id} className="bg-white rounded p-4 shadow">{p.text}</div>
        ))}
      </div>
    </AppLayout>
  );
}
