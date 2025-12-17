"use client"
import React, { useState } from 'react'

export default function TermForm({ initial }: { initial?: any }) {
  const [term, setTerm] = useState(initial?.term ?? '')
  const [severity, setSeverity] = useState(initial?.severity ?? 'low')
  const [replacement, setReplacement] = useState(initial?.replacement ?? '')
  const [isActive, setIsActive] = useState(initial?.isActive ?? true)
  const [loading, setLoading] = useState(false)

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    setLoading(true)
    try {
      if (initial?.id) {
        await fetch(`/api/admin/moderation/terms/${initial.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ term, severity, replacement, is_active: isActive }),
        })
      } else {
        await fetch('/api/admin/moderation/terms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ term, severity, replacement, is_active: isActive }),
        })
      }

      window.location.reload()
    } finally {
      setLoading(false)
    }
  }

  async function remove() {
    if (!initial?.id) return
    if (!confirm('Remove this term?')) return
    setLoading(true)
    try {
      await fetch(`/api/admin/moderation/terms/${initial.id}`, { method: 'DELETE' })
      window.location.reload()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="block text-sm">Term</label>
        <input value={term} onChange={(e) => setTerm(e.target.value)} className="w-full" required />
      </div>
      <div>
        <label className="block text-sm">Severity</label>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <div>
        <label className="block text-sm">Replacement (optional)</label>
        <input value={replacement} onChange={(e) => setReplacement(e.target.value)} className="w-full" />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} id="isActive" />
        <label htmlFor="isActive" className="text-sm">Active</label>
      </div>

      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={loading} type="submit">{initial?.id ? 'Save' : 'Save'}</button>
        {initial?.id && <button className="btn btn-outline-danger" type="button" onClick={remove} disabled={loading}>Delete</button>}
      </div>
    </form>
  )
}
