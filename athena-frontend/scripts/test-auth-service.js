const fetch = require('node-fetch')

async function run() {
  const base = process.env.AUTH_URL || 'http://localhost:5001'
  // try to ensure auth service is running by spawning if needed
  let child = null
  let ok = false
  for (let i = 0; i < 6; i++) {
    try { const r = await fetch(`${base}/health`); if (r.ok) { ok = true; break } } catch (e) {}
    if (i === 0) {
      const { spawn } = require('child_process')
      child = spawn('node', [require('path').join(__dirname, '../../auth-service/index.js')], { stdio: ['ignore', 'pipe', 'pipe'] })
      child.stdout.on('data', (d) => { const s = d.toString(); if (s.includes('Auth service running')) ok = true; process.stdout.write(s) })
      child.stderr.on('data', (d) => process.stderr.write(d.toString()))
    }
    await new Promise(r => setTimeout(r, 600))
  }
  if (!ok) { if (child) child.kill(); throw new Error('Auth service not available') }

  // Register
  const email = `dev+${Date.now()}@example.com`
  const reg = await fetch(`${base}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'pass1234', name: 'Dev User' }) })
  const jr = await reg.json()
  if (!jr.ok) { console.error('register failed', jr); process.exit(2) }
  console.log('Registered:', jr.user.email)

  // Login
  const login = await fetch(`${base}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'pass1234' }) })
  const jl = await login.json()
  if (!jl.ok || !jl.token) { console.error('login failed', jl); process.exit(2) }
  console.log('Logged in, token length:', jl.token.length)

  // Me
  const me = await fetch(`${base}/me`, { headers: { Authorization: `Bearer ${jl.token}` } })
  const jm = await me.json()
  if (!jm.user) { console.error('me failed', jm); process.exit(2) }
  console.log('Me user id:', jm.user.id)

  if (child) child.kill()
  process.exit(0)
}

if (require.main === module) run().catch(e => { console.error(e); process.exit(1) })
