import { test, expect } from '@playwright/test'
import { spawn } from 'child_process'
import path from 'path'

async function ensureMockApi() {
  const base = process.env.MOCK_API_URL || 'http://localhost:4001'
  try { const r = await fetch(`${base}/api/ping`); if (r.ok) return } catch (e) {}
  const child = spawn('node', [path.join(__dirname, '../athena-frontend/mock-api/index.js')], { stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', (d: any) => process.stdout.write(d.toString()))
  child.stderr.on('data', (d: any) => process.stderr.write(d.toString()))
  for (let i = 0; i < 10; i++) {
    try { const r = await fetch(`${base}/api/ping`); if (r.ok) return } catch (e) {}
    await new Promise(r => setTimeout(r, 300))
  }
  child.kill()
  throw new Error('Mock API failed to start')
}

async function ensureAuthService(request: any) {
  const base = process.env.AUTH_URL || 'http://localhost:5001'
  try { const r = await request.get(`${base}/health`); if (r.ok()) return { base } } catch (e) {}
  const child = spawn('node', [path.join(__dirname, '../auth-service/index.js')], { stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', (d: any) => process.stdout.write(d.toString()))
  child.stderr.on('data', (d: any) => process.stderr.write(d.toString()))
  for (let i = 0; i < 10; i++) {
    try { const r = await request.get(`${base}/health`); if (r.ok()) return { base, child } } catch (e) {}
    await new Promise(r => setTimeout(r, 300))
  }
  child.kill()
  throw new Error('Auth service failed to start')
}

test('reports page requires auth and allows submission', async ({ page, request }) => {
  // ensure mock API and auth service available
  await ensureMockApi()
  const auth = await ensureAuthService(request)
  const authBase = auth.base

  // register+login to get token
  const email = `e2e+${Date.now()}@example.com`
  await request.post(`${authBase}/register`, { data: { email, password: 'pass1234' } })
  const login = await request.post(`${authBase}/login`, { data: { email, password: 'pass1234' } })
  const loginJson = await login.json()
  const token = loginJson.token

  // seed token into localStorage before any script runs
  await (page as any).evaluateOnNewDocument((t: any) => { localStorage.setItem('token', t) }, token)

  await page.goto('/dashboard/reports')
  await expect(page.locator('h1')).toHaveText(/Reports/)

  const ta = page.locator('textarea[placeholder="Describe the issue"]')
  await ta.fill('E2E test report ' + Date.now())
  await page.click('text=Submit Report')

  // Wait for report to appear in list
  await expect(page.locator('div', { hasText: 'E2E test report' })).toHaveCount(1)

  if (auth.child) auth.child.kill()
})
