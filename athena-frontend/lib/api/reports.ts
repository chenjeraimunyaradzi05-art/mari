import { apiFetch } from './client'

export async function submitReport(payload: { type: string; reporter_id: number; target_id: number; details: string }) {
  const base = process.env.NEXT_PUBLIC_MOCK_API_URL || 'http://localhost:4001'
  const res = await apiFetch(`${base}/api/report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error('Failed to submit report')
  return res.json()
}

export async function fetchReports() {
  const base = process.env.NEXT_PUBLIC_MOCK_API_URL || 'http://localhost:4001'
  const res = await apiFetch(`${base}/api/reports`)
  if (!res.ok) throw new Error('Failed to fetch reports')
  return res.json()
}
