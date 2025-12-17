import React from 'react';

export default function ProfileBio({ bio }) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-2 text-emerald-700">About</h2>
      <p className="text-gray-700 leading-relaxed">{bio}</p>
    </div>
  );
}
