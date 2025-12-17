"use client"
import React, { useState } from 'react'

export default function TriageControls({ reportId, currentStatus }: { reportId: string; currentStatus: string }) {
  const [status, setStatus] = useState(currentStatus)
  const [decision, setDecision] = useState('approved')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  async function assign() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/reports/${reportId}/assign`, { method: 'POST' })
      if (res.ok) {
        const j = await res.json()
        setStatus(j.report?.status ?? 'under_review')
      }
    } finally {
      setLoading(false)
    }
  }

  async function decide(e?: React.FormEvent) {
    e?.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/reports/${reportId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason, notes }),
      })
      if (res.ok) {
        const j = await res.json()
        setStatus(j.report?.status ?? status)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-3">
        <strong className="block">Current: {status}</strong>
      </div>

      <div className="mb-3">
        <button className="btn btn-primary" onClick={assign} disabled={loading}>Assign to me</button>
      </div>

      <form onSubmit={decide}>
        <div className="mb-2">
          <label className="block text-sm">Decision</label>
          <select value={decision} onChange={(e) => setDecision(e.target.value)} className="w-full">
            <option value="approved">Approve</option>
            <option value="rejected">Reject</option>
            <option value="dismissed">Dismiss</option>
          </select>
        </div>

        <div className="mb-2">
          <label className="block text-sm">Reason (optional)</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full" />
        </div>

        <div className="mb-2">
          <label className="block text-sm">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full" rows={3} />
        </div>

        <div>
          <button className="btn btn-success" type="submit" disabled={loading}>Record decision</button>
        </div>
      </form>
    </div>
  )
}
