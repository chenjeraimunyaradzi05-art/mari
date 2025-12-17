import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-white border-t mt-8">
      <div className="container mx-auto px-4 py-6 text-sm text-gray-600">
        <div className="flex justify-between items-center">
          <span>© {new Date().getFullYear()} Athena</span>
          <span>Made with ❤️</span>
        </div>
      </div>
    </footer>
  );
}
