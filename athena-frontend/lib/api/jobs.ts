import { apiFetch } from './client'

export async function fetchJobs() {
  const base = process.env.NEXT_PUBLIC_MOCK_API_URL || 'http://localhost:4001'
  const res = await apiFetch(`${base}/api/jobs`)
  if (!res.ok) throw new Error('Failed to fetch jobs')
  return res.json()
}

export async function scoreJobs(profile_id: number, job_ids?: number[]) {
  const base = process.env.NEXT_PUBLIC_MOCK_API_URL || 'http://localhost:4001'
  const res = await apiFetch(`${base}/api/match/score`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile_id, job_ids }) })
  if (!res.ok) throw new Error('Failed to score jobs')
  return res.json()
}
