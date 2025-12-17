import { apiFetch } from './client'

export async function fetchFeed() {
  const base = process.env.NEXT_PUBLIC_MOCK_API_URL || 'http://localhost:4001'
  const res = await apiFetch(`${base}/api/feed`)
  if (!res.ok) throw new Error('Failed to fetch feed')
  return res.json()
}
