const fetch = require('node-fetch')

async function run() {
  const base = process.env.MOCK_API_URL || 'http://localhost:4001'
  // spawn mock API if not available
  let child = null
  let ok = false
  for (let i=0;i<6;i++){
    try{ const r = await fetch(`${base}/api/ping`); if (r.ok) { ok = true; break } }catch(e){}
    if (i===0) {
      const { spawn } = require('child_process')
      child = spawn('node', [require('path').join(__dirname, '../mock-api/index.js')], { stdio: ['ignore','pipe','pipe'] })
      child.stdout.on('data', d => { const s = d.toString(); if (s.includes('Mock API running')) ok = true; process.stdout.write(s) })
      child.stderr.on('data', d => process.stderr.write(d.toString()))
    }
    await new Promise(r=>setTimeout(r,300))
  }
  if (!ok) { if (child) child.kill(); console.error('Mock API not available'); process.exit(2) }
  const { getAuthToken } = require('./lib/auth')
  const { token, child: childAuth } = await getAuthToken()
  const res = await fetch(`${base}/api/feed`, { headers: { Authorization: `Bearer ${token}` } })
  const j = await res.json()
  if (!j.posts || !j.posts.length) { console.error('No posts', j); if (child) child.kill(); process.exit(2) }
  console.log('Feed posts:', j.posts.length)
  if (childAuth) childAuth.kill()
  if (child) child.kill()
  process.exit(0)
}

if (require.main === module) run()
