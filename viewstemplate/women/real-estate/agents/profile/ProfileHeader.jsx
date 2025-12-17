import React from 'react';

export default function ProfileHeader({ agent }) {
  return (
    <div className="flex items-center gap-6 mb-8">
      <img
        src={agent.avatarUrl || '/default-avatar.png'}
        alt={agent.name}
        className="w-24 h-24 rounded-full border-2 border-emerald-400 object-cover"
      />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{agent.name}</h1>
        <p className="text-gray-600">{agent.title}</p>
        <p className="text-gray-500 text-sm">{agent.location}</p>
      </div>
    </div>
  );
}
