export default function NotFound(){
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-xl text-center">
        <h1 className="text-3xl font-bold text-slate-900">404 — Page not found</h1>
        <p className="mt-4 text-slate-600">Sorry, we couldn't find the page you're looking for. Try the navigation above or return home.</p>
        <div className="mt-6"><a href="/" className="text-rose-600 font-bold">Back to Home →</a></div>
      </div>
    </div>
  )
}
