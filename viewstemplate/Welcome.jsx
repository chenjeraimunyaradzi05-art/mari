import React from 'react';
import GuestLayout from './components/layouts/GuestLayout';

export default function Welcome() {
  return (
    <GuestLayout>
      <div className="text-center">
        <h1 className="text-3xl font-bold text-emerald-700 mb-2">Welcome to Athena</h1>
        <p className="text-gray-600 mb-4">Join our community to access tailored opportunities and resources.</p>
        <a href="/register" className="px-4 py-2 bg-emerald-600 text-white rounded">Sign up</a>
      </div>
    </GuestLayout>
  );
}
