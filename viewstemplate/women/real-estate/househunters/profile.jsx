import React from 'react';

export default function HousehunterProfile() {
  // TODO: Replace with real data or props
  const profile = {
    name: 'Sarah Lee',
    avatarUrl: '/default-avatar.png',
    preferences: '2+ bedrooms, pet-friendly, near subway',
    email: 'sarah.lee@example.com',
    phone: '(555) 987-6543',
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-6 mb-6">
        <img
          src={profile.avatarUrl}
          alt={profile.name}
          className="w-20 h-20 rounded-full border-2 border-emerald-400 object-cover"
        />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{profile.name}</h1>
          <p className="text-gray-600">Preferences: {profile.preferences}</p>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-2 text-emerald-700">Contact Info</h2>
        <ul className="text-gray-700">
          <li><span className="font-medium">Email:</span> {profile.email}</li>
          <li><span className="font-medium">Phone:</span> {profile.phone}</li>
        </ul>
      </div>
    </div>
  );
}
