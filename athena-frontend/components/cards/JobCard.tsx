export default function JobCard({ title, company, location }: { title: string; company: string; location?: string }) {
  return (
    <div className="border rounded p-4 bg-white shadow-sm">
      <div className="text-lg font-semibold">{title}</div>
      <div className="text-sm text-gray-600">{company} {location ? `• ${location}` : ''}</div>
    </div>
  )
}
