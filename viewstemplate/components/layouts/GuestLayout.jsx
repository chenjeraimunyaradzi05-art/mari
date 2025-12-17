import React from 'react';

export default function GuestLayout({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-3xl p-6">{children}</div>
    </div>
  );
}
