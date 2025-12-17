import React from 'react'
import TriageControls from '@/components/admin/TriageControls'

async function getReport(id: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/admin/reports`, { cache: 'no-store' })
  if (!res.ok) return null
  const json = await res.json()
  return (json.reports || []).find((r: any) => r.id === id) || null
}

export default async function ReportPage({ params }: { params: { id: string } }) {
  const report = await getReport(params.id)

  if (!report) {
    return <div className="container p-6">Report not found.</div>
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Report #{report.id}</h1>
        <a className="text-sm text-blue-600" href="/admin/moderation/reports">Back to list</a>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="p-4 border rounded mb-4">
            <h3 className="font-semibold">Report Details</h3>
            <dl className="mt-2 text-sm text-gray-700">
              <div className="mb-2"><strong>Reporter:</strong> {report.reporterId || 'Anonymous'}</div>
              <div className="mb-2"><strong>Status:</strong> {report.status}</div>
              <div className="mb-2"><strong>Description:</strong> {report.reason ?? 'No details'}</div>
            </dl>
          </div>

          <div className="p-4 border rounded">
            <h3 className="font-semibold">Enforcement Actions</h3>
            <p className="text-sm text-gray-600">No enforcement actions yet.</p>
          </div>
        </div>

        <div>
          <div className="p-4 border rounded">
            <h3 className="font-semibold mb-2">Triage</h3>
            <TriageControls reportId={report.id} currentStatus={report.status} />
          </div>
        </div>
      </div>
    </div>
  )
}
