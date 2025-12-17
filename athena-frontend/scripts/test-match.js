const fetch = require('node-fetch')

async function run() {
  const base = process.env.MOCK_API_URL || 'http://localhost:4001'
  // If mock API not reachable, spawn it for this test
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
  if (!ok) {
    if (child) child.kill()
    throw new Error('Mock API not available at ' + base)
  }

  const { getAuthToken } = require('./lib/auth')
  const { token, child: childAuth } = await getAuthToken()
  const res = await fetch(`${base}/api/match/score`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ profile_id: 1 }) })
  const json = await res.json()
  if (!json.scores || !json.scores.length) {
    console.error('No scores returned', json)
    process.exit(2)
  }
  console.log('Match scores:', json.scores)
  if (child) child.kill()
  process.exit(0)
}

if (require.main === module) run().catch(e=>{ console.error(e); process.exit(1) })
