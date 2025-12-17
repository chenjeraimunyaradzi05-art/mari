const fetch = require('node-fetch')

async function ensureAuthService() {
  const base = process.env.AUTH_URL || 'http://localhost:5001'
  try {
    const r = await fetch(`${base}/health`)
    if (r.ok) return { base }
  } catch (e) {}

  // spawn auth service
  const { spawn } = require('child_process')
  const child = spawn('node', [require('path').join(__dirname, '../../../auth-service/index.js')], { stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', (d) => process.stdout.write(d.toString()))
  child.stderr.on('data', (d) => process.stderr.write(d.toString()))

  // wait for health
  for (let i = 0; i < 10; i++) {
    try { const r = await fetch(`${base}/health`); if (r.ok) return { base, child } } catch (e) {}
    await new Promise((r) => setTimeout(r, 300))
  }
  if (child) child.kill()
  throw new Error('Auth service failed to start')
}

async function getAuthToken() {
  const { base, child } = await ensureAuthService()
  const email = `ci+${Date.now()}@example.com`
  await fetch(`${base}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'pass1234' }) })
  const login = await (await fetch(`${base}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'pass1234' }) })).json()
  if (!login.ok) {
    if (child) child.kill()
    throw new Error('login failed')
  }
  return { token: login.token, child }
}

module.exports = { getAuthToken }
