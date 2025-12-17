import React from 'react'

async function getReports() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/admin/reports`, { cache: 'no-store' })
  if (!res.ok) return { reports: [] }
  return res.json()
}

export default async function ReportsPage() {
  const data = await getReports()
  const reports = data.reports || []

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Content Reports</h1>
        <a className="text-sm text-blue-600" href="/admin/moderation/dashboard">Back to dashboard</a>
      </div>

      <div className="bg-white shadow rounded">
        <table className="w-full table-auto">
          <thead>
            <tr className="text-left">
              <th className="p-3">ID</th>
              <th className="p-3">Category</th>
              <th className="p-3">Severity</th>
              <th className="p-3">Status</th>
              <th className="p-3">Reporter</th>
              <th className="p-3">Created</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r: any) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">#{r.id}</td>
                <td className="p-3">{r.category ?? '-'}</td>
                <td className="p-3">{r.severity ?? '-'}</td>
                <td className="p-3">{r.status}</td>
                <td className="p-3">{r.reporterId}</td>
                <td className="p-3">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="p-3 text-right"><a className="text-blue-600" href={`/admin/moderation/reports/${r.id}`}>Review</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
