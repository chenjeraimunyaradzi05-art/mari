const fs = require('fs')
const fetch = global.fetch || require('node-fetch')
const DB = require('path').join(__dirname, '../mock-api/db.json')

async function run() {
  try {
    const base = process.env.MOCK_API_URL || 'http://localhost:4001'
    // If mock API not available, spawn it as a child process for this test
    let child = null
    let ok = false
    for (let i = 0; i < 3; i++) {
      try {
        const ping = await fetch(`${base}/api/ping`)
        if (ping.ok) { ok = true; break }
      } catch (e) {}
      // try starting mock API once
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

    console.log('Creating checkout session...')
    const { getAuthToken } = require('./lib/auth')
    const { token, child: childAuth } = await getAuthToken()
    const res = await fetch(`${base}/api/stripe/create-session`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ plan: 'starter', user_id: 1 })
    })
    const json = await res.json()
    if (!json?.id) throw new Error('No session id returned')
    console.log('Session created:', json.id)

    console.log('Simulating webhook...')
    const hook = await fetch(process.env.MOCK_API_URL || 'http://localhost:4001/api/stripe/webhook', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: json.id, plan: 'starter', user_id: 1 } } })
    })
    if (hook.status !== 200) throw new Error('Webhook simulation failed')

    const db = JSON.parse(fs.readFileSync(DB, 'utf8'))
    const sub = (db.subscriptions || []).find((s) => s.plan === 'starter' && s.user_id === 1)
    if (!sub) {
      console.error('Subscription not found in mock DB', db.subscriptions)
      process.exit(2)
    }
    console.log('Subscription created successfully:', sub)
    if (childAuth) childAuth.kill()
    if (child) {
      child.kill()
      await new Promise((r) => setTimeout(r, 250))
    }
    process.exit(0)
  } catch (err) {
    if (childAuth) childAuth.kill()
    if (child) {
      child.kill()
      await new Promise((r) => setTimeout(r, 250))
    }
    console.error('Test failed:', err)
    process.exit(1)
  }
}

if (require.main === module) run()
