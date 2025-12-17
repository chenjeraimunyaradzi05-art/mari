const fetch = require('node-fetch')

async function run() {
  const authBase = process.env.AUTH_URL || 'http://localhost:5001'
  // spawn auth-service if needed
  let child = null
  let ok = false
  for (let i=0;i<6;i++){
    try { const r = await fetch(`${authBase}/health`); if (r.ok) { ok = true; break } } catch(e) {}
    if (i===0) { const { spawn } = require('child_process'); child = spawn('node', [require('path').join(__dirname, '../../auth-service/index.js')], { stdio: ['ignore','pipe','pipe'] }); child.stdout.on('data', d => { const s = d.toString(); if (s.includes('Auth service running')) ok = true; process.stdout.write(s) }); }
    await new Promise(r=>setTimeout(r, 600))
  }
  if (!ok) { if (child) child.kill(); throw new Error('Auth service unavailable') }

  // Register/login
  const email = `refresh+${Date.now()}@example.com`
  await fetch(`${authBase}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'pass1234' }) })
  const login = await (await fetch(`${authBase}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'pass1234' }) })).json()
  if (!login.ok) { console.error('login failed', login); process.exit(2) }
  const token = login.token

  // Simulate token expiry by calling refresh (should succeed)
  const r = await fetch(`${authBase}/refresh`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) { console.error('refresh failed', await r.text()); process.exit(2) }
  const jr = await r.json()
  if (!jr.token) { console.error('no new token', jr); process.exit(2) }
  console.log('Refresh returned new token length', jr.token.length)

  // Use new token to call /me
  const me = await (await fetch(`${authBase}/me`, { headers: { Authorization: `Bearer ${jr.token}` } })).json()
  if (!me.user) { console.error('me failed', me); process.exit(2) }
  console.log('me ok user id', me.user.id)
  if (child) child.kill()
  process.exit(0)
}

if (require.main === module) run().catch(e=>{ console.error(e); process.exit(1) })
