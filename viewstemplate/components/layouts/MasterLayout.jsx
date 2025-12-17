import React from 'react';
import Footer from '../Footer';
import Navigation from '../Navigation';

export default function MasterLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
      <Navigation />
      <main className="flex-1 container mx-auto px-4 py-8">{children}</main>
      <Footer />
    </div>
  );
}
