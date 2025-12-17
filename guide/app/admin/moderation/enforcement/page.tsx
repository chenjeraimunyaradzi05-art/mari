import React from 'react'

async function getActions() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/admin/enforcement-actions`, { cache: 'no-store' })
  if (!res.ok) return { actions: [] }
  return res.json()
}

export default async function EnforcementPage() {
  const data = await getActions()
  const actions = data.actions || []

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Enforcement Actions</h1>
        <a className="text-sm text-blue-600" href="/admin/moderation/dashboard">Back to dashboard</a>
      </div>

      <div className="bg-white shadow rounded p-4">
        <table className="w-full table-auto text-sm">
          <thead>
            <tr className="text-left">
              <th className="p-2">ID</th>
              <th className="p-2">Subject</th>
              <th className="p-2">Action</th>
              <th className="p-2">Status</th>
              <th className="p-2">Issued By</th>
              <th className="p-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a: any) => (
              <tr key={a.id} className="border-t">
                <td className="p-2">{a.id}</td>
                <td className="p-2">{a.subjectType} #{a.subjectId}</td>
                <td className="p-2">{a.actionType}</td>
                <td className="p-2">{a.status}</td>
                <td className="p-2">{a.issuedByType} #{a.issuedBy}</td>
                <td className="p-2">{new Date(a.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
