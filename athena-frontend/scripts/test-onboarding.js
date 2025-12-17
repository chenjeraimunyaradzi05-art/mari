const fetch = require('node-fetch')
const fs = require('fs')

async function run() {
  const base = process.env.MOCK_API_URL || 'http://localhost:4001'
  // spawn mock API if needed
  let child = null
  let ok = false
  for (let i = 0; i < 6; i++) {
    try { const r = await fetch(`${base}/api/ping`); if (r.ok) { ok = true; break } } catch (e) {}
    if (i === 0) {
      const { spawn } = require('child_process')
      child = spawn('node', [require('path').join(__dirname, '../mock-api/index.js')], { stdio: ['ignore', 'pipe', 'pipe'] })
      child.stdout.on('data', (d) => { const s = d.toString(); if (s.includes('Mock API running')) ok = true; process.stdout.write(s) })
      child.stderr.on('data', (d) => process.stderr.write(d.toString()))
    }
    await new Promise(r => setTimeout(r, 600))
  }
  if (!ok) { if (child) child.kill(); throw new Error('Mock API not available') }

  const payload = { user_id: 1, role: 'member', pronouns: 'she/her', location: 'Melbourne', bio: 'Test bio' }
  const { getAuthToken } = require('./lib/auth')
  const { token, child: childAuth } = await getAuthToken()
  const res = await fetch(`${base}/api/onboarding`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
  const json = await res.json()
  if (!json.ok) { if (childAuth) childAuth.kill(); console.error('Onboarding failed', json); process.exit(2) }
  if (childAuth) childAuth.kill()
  // verify saved
  const db = JSON.parse(fs.readFileSync(require('path').join(__dirname, '../mock-api/db.json')))
  const rec = (db.onboardings || []).find(o => o.payload && o.payload.user_id === payload.user_id)
  if (!rec) { console.error('Onboarding record not found', db.onboardings); process.exit(2) }
  console.log('Onboarding recorded:', rec.id)
  if (child) child.kill()
  process.exit(0)
}

if (require.main === module) run().catch(e => { console.error(e); process.exit(1) })
