import { apiFetch } from './client'

export async function fetchProperties() {
  const base = process.env.NEXT_PUBLIC_MOCK_API_URL || 'http://localhost:4001'
  const res = await apiFetch(`${base}/api/housing`)
  if (!res.ok) throw new Error('Failed to fetch properties')
  return res.json()
}
