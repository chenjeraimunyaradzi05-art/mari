import React from 'react'

export default function Footer(){
  return (
    <footer className="bg-white border-t mt-8">
      <div className="max-w-6xl mx-auto px-4 py-6 text-sm text-gray-600">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>© {new Date().getFullYear()} Athena</span>
          <div className="text-sm text-gray-500">Made with ❤️ — <a href="/about" className="underline">About Athena</a></div>
        </div>
      </div>
    </footer>
  )
}
