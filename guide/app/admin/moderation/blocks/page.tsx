import React from 'react'

async function getBlocks() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/admin/blocks`, { cache: 'no-store' })
  if (!res.ok) return { blocks: [] }
  return res.json()
}

export default async function BlocksPage() {
  const data = await getBlocks()
  const blocks = data.blocks || []

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Blocks</h1>
        <a className="text-sm text-blue-600" href="/admin/moderation/dashboard">Back to dashboard</a>
      </div>

      <div className="bg-white shadow rounded p-4">
        <table className="w-full table-auto text-sm">
          <thead>
            <tr className="text-left">
              <th className="p-2">Block ID</th>
              <th className="p-2">Blocker</th>
              <th className="p-2">Blocked</th>
              <th className="p-2">Status</th>
              <th className="p-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((b: any) => (
              <tr key={b.id} className="border-t">
                <td className="p-2">{b.id}</td>
                <td className="p-2">{b.blocker?.name ?? b.blocker?.id}</td>
                <td className="p-2">{b.blocked?.name ?? b.blocked?.id}</td>
                <td className="p-2">{b.status}</td>
                <td className="p-2">{new Date(b.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
