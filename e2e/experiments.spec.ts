import { test, expect } from '@playwright/test'

test('experiment and funnel capture', async ({ request }) => {
  // Create experiment
  await request.post('/api/experiments', { data: { id: 'exp-e2e', name: 'E2E Exp', buckets: ['control','variant'] } })

  // Expose 10 users, convert conditionally
  for (let i=0;i<10;i++){
    const user = `u${i}`
    const bucket = i < 5 ? 'control' : 'variant'
    await request.post('/api/experiments/exp-e2e/expose', { data: { userId: user, bucket } })
    if ((bucket === 'control' && i % 4 === 0) || (bucket === 'variant' && i % 2 === 0)) {
      await request.post('/api/experiments/exp-e2e/convert', { data: { userId: user } })
    }
  }

  const res = await request.get('/api/experiments/exp-e2e/results')
  const json = await res.json()
  expect(json.ok).toBe(true)

  // Funnels
  await request.post('/api/analytics/funnel', { data: { userId: 'a', funnel: 'signup', step: 'start', ts: '2025-01-01T00:00:00Z' } })
  await request.post('/api/analytics/funnel', { data: { userId: 'a', funnel: 'signup', step: 'verify', ts: '2025-01-01T00:01:00Z' } })

  const cohort = await request.get('/api/analytics/cohort?funnel=signup')
  const cj = await cohort.json()
  expect(cj.ok).toBe(true)
})
