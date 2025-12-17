import React from 'react'

async function getLogs() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/admin/transparency`, { cache: 'no-store' })
  if (!res.ok) return { logs: [] }
  return res.json()
}

export default async function TransparencyPage() {
  const data = await getLogs()
  const logs = data.logs || []

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Transparency Logs</h1>
        <a className="text-sm text-blue-600" href="/admin/moderation/dashboard">Back to dashboard</a>
      </div>

      <div className="bg-white shadow rounded p-4">
        <ul className="space-y-3">
          {logs.map((l: any) => (
            <li key={l.id} className="p-3 border rounded">
              <div className="flex justify-between">
                <div>
                  <strong>{l.action}</strong>
                  <div className="text-sm text-gray-600">{l.decision ?? '—'}</div>
                </div>
                <div className="text-sm text-gray-500">{new Date(l.createdAt).toLocaleString()}</div>
              </div>
              <p className="mt-2 text-sm text-gray-700">{l.rationale ?? ''}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
