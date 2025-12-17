const fetch = require('node-fetch')
const fs = require('fs')

async function run() {
  const base = process.env.MOCK_API_URL || 'http://localhost:4001'
  // spawn if needed
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

  const { getAuthToken } = require('./lib/auth')
  const { token, child: childAuth } = await getAuthToken()
  const rres = await fetch(`${base}/api/report`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ type: 'harassment', reporter_id: 1, target_id: 2, details: 'Offensive message' }) })
  const jr = await rres.json()
  if (!jr.ok) { if (childAuth) childAuth.kill(); console.error('Report failed', jr); process.exit(2) }
  const list = await (await fetch(`${base}/api/reports`, { headers: { Authorization: `Bearer ${token}` } })).json()
  if (!list.reports || !list.reports.length) { if (childAuth) childAuth.kill(); console.error('Reports list empty', list); process.exit(2) }
  console.log('Reports:', list.reports)
  if (childAuth) childAuth.kill()
  if (child) child.kill()
  process.exit(0)
}

if (require.main === module) run().catch(e => { console.error(e); process.exit(1) })
