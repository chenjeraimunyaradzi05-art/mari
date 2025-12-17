import React from 'react';

export default function Navigation() {
  return (
    <header className="bg-white border-b shadow-sm">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Athena" className="w-8 h-8" />
          <span className="font-bold text-lg">Athena</span>
        </div>
        <nav>
          <ul className="flex items-center gap-4 text-sm">
            <li><a href="/" className="text-gray-700 hover:text-emerald-600">Home</a></li>
            <li><a href="/posts" className="text-gray-700 hover:text-emerald-600">Posts</a></li>
            <li><a href="/women" className="text-gray-700 hover:text-emerald-600">Women</a></li>
            <li><a href="/profile" className="text-gray-700 hover:text-emerald-600">Profile</a></li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
