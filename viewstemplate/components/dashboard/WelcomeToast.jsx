import React from 'react';

export default function WelcomeToast({ user }) {
  if (!user) return null;
  return (
    <div className="rounded-lg bg-emerald-50 p-4 shadow mb-4">
      <div className="font-semibold">Welcome back, {user.name}!</div>
      <div className="text-sm text-gray-600">Check your dashboard for updates.</div>
    </div>
  );
}
