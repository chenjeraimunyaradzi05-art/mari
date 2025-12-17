import React from 'react';

export default function ProfileSidebar({ agent }) {
  return (
    <aside className="hidden lg:block w-64 bg-white rounded-lg shadow p-6 sticky top-8 h-fit">
      <div className="flex flex-col items-center mb-6">
        <img
          src={agent.avatarUrl || '/default-avatar.png'}
          alt={agent.name}
          className="w-20 h-20 rounded-full border-2 border-emerald-400 object-cover mb-2"
        />
        <h2 className="text-lg font-bold text-gray-900">{agent.name}</h2>
        <p className="text-gray-600 text-sm">{agent.title}</p>
      </div>
      <div className="mb-4">
        <span className="block text-gray-500 text-xs mb-1">Location</span>
        <span className="text-gray-700 text-sm">{agent.location}</span>
      </div>
      <div>
        <span className="block text-gray-500 text-xs mb-1">Contact</span>
        <span className="text-gray-700 text-sm">{agent.email}</span>
      </div>
    </aside>
  );
}
