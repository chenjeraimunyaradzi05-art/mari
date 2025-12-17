export default function CreatePost() {
  return (
    <div className="min-h-screen bg-blush-50 py-8">
      <div className="container">
        <h1 className="text-2xl font-semibold mb-4">Create Post</h1>
        <textarea className="w-full p-3 border rounded mb-3" rows={6} placeholder="Share something..." />
        <div className="flex justify-end">
          <button className="px-4 py-2 bg-rose-600 text-white rounded">Post</button>
        </div>
      </div>
    </div>
  )
}
