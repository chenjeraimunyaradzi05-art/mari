const fetch = require('node-fetch')

async function run() {
  const base = process.env.MOCK_API_URL || 'http://localhost:4001'
  // ensure mock API running like other tests
  for (let i=0;i<6;i++){
    try { const r = await fetch(`${base}/api/ping`); if (r.ok) break } catch(e){}
    if (i===0) require('child_process').spawn('node', [require('path').join(__dirname, '../mock-api/index.js')], { stdio: 'inherit' })
    await new Promise(r=>setTimeout(r, 600))
  }
  const { getAuthToken } = require('./lib/auth')
  const { token, child: childAuth } = await getAuthToken()
  const res = await fetch(`${base}/api/ai/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ question: 'How can I negotiate salary?' }) })
  const json = await res.json()
  if (!json.ok) { if (childAuth) childAuth.kill(); console.error('AI mock failed', json); process.exit(2) }
  console.log('AI reply:', json.reply)
  if (childAuth) childAuth.kill()
  process.exit(0)
}

if (require.main === module) run().catch(e=>{ console.error(e); process.exit(1) })
