import React from 'react'

export const revalidate = 0

async function getReports() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/admin/reports`, { cache: 'no-store' })
  if (!res.ok) return { reports: [] }
  return res.json()
}

async function getMetrics() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/admin/provider-metrics`, { cache: 'no-store' })
  if (!res.ok) return { openai: { failures: 0, successes: 0, circuit_open: false } }
  return res.json()
}

export default async function DashboardPage() {
  const [reportsRes, metrics] = await Promise.all([getReports(), getMetrics()])
  const reports = reportsRes.reports || []

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Social Moderation</h1>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 border rounded">Open Reports<br /><strong>{reports.length}</strong></div>
        <div className="p-4 border rounded">Active Blocks<br /><strong>—</strong></div>
        <div className="p-4 border rounded">Actions (7d)<br /><strong>—</strong></div>
        <div className="p-4 border rounded">Public Logs<br /><strong>—</strong></div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold mb-2">Recent Reports</h2>
          <div className="space-y-2">
            {reports.slice(0, 10).map((r: any) => (
              <div key={r.id} className="p-3 border rounded">
                <div className="flex justify-between">
                  <div>
                    <strong>{r.category ?? 'Report'}</strong>
                    <div className="text-sm text-gray-600">{r.reason ?? 'No reason'}</div>
                  </div>
                  <a className="text-sm text-blue-600" href={`/admin/moderation/reports/${r.id}`}>Review</a>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Provider Metrics</h2>
          <pre className="p-3 bg-gray-50 rounded text-sm">{JSON.stringify(metrics, null, 2)}</pre>
        </div>
      </div>
    </div>
  )
}
