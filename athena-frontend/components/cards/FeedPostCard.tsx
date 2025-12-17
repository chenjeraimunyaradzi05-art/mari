export default function FeedPostCard({ author, content }: { author: string; content: string }) {
  return (
    <div className="border rounded p-4 bg-white">
      <div className="font-medium">{author}</div>
      <div className="mt-2 text-gray-700">{content}</div>
    </div>
  )
}
