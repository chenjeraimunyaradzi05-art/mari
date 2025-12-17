export function Header() {
  return (
    <header className="w-full border-b border-gray-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-600 flex items-center justify-center text-white font-bold">A</div>
          <div className="text-lg font-semibold">ATHENA</div>
        </div>
        <nav className="flex gap-4">
          <a href="/" className="text-sm text-midnight-900">For You</a>
          <a href="/housing" className="text-sm text-midnight-900">Housing</a>
          <a href="/jobs" className="text-sm text-midnight-900">Jobs</a>
        </nav>
      </div>
    </header>
  )
}
