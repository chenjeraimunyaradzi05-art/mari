"use client"

import { useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { submitReport, fetchReports } from '@/lib/api/reports'

export default function ReportsPage() {
  const user = useAuthStore((s) => s.user)
  const [details, setDetails] = useState('')
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const j = await fetchReports()
      setReports(j.reports || [])
    } catch (e) {
      console.error(e)
    } finally { setLoading(false) }
  }

  const handle = async () => {
    if (!user) return alert('Please sign in to submit a report')
    try {
      await submitReport({ type: 'harassment', reporter_id: user.id, target_id: 2, details })
      setDetails('')
      load()
    } catch (e) { console.error(e); alert('Failed to submit') }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Reports</h1>
      {!user && <p className="mb-4 text-sm text-gray-600">You must <a href="/auth/login" className="text-rose-600">sign in</a> to submit reports.</p>}

      <div className="mb-6">
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Describe the issue" className="w-full p-3 border rounded mb-2" />
        <div className="flex gap-2">
          <button onClick={handle} className="px-3 py-2 bg-rose-600 text-white rounded">Submit Report</button>
          <button onClick={load} className="px-3 py-2 border rounded">Refresh</button>
        </div>
      </div>

      {loading && <p className="text-gray-600">Loading…</p>}
      <div className="space-y-3">
        {reports.map(r => (
          <div key={r.id} className="p-3 border rounded bg-white">
            <div className="text-sm text-gray-600">{r.type} — {new Date(r.created_at).toLocaleString()}</div>
            <div className="mt-1">{r.details}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
