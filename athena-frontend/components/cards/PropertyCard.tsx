export default function PropertyCard({ title, price }: { title: string; price: string }) {
  return (
    <div className="border rounded p-4 bg-white shadow-sm">
      <div className="text-lg font-semibold">{title}</div>
      <div className="text-sm text-gray-600">{price}</div>
    </div>
  )
}
