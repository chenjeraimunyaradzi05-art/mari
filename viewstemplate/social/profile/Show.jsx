import React from 'react';
import AppLayout from '../../components/layouts/AppLayout';

export default function ProfileShow() {
  const profile = { name: 'User Name', bio: 'Short bio here' };
  return (
    <AppLayout title={profile.name}>
      <div className="bg-white rounded p-4 shadow">
        <h2 className="text-xl font-bold">{profile.name}</h2>
        <p className="text-gray-600 mt-2">{profile.bio}</p>
      </div>
    </AppLayout>
  );
}
