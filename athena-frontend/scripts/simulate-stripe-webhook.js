const fetch = require('node-fetch')

async function simulate(sessionId, plan, user_id = 1) {
  const event = {
    type: 'checkout.session.completed',
    data: { object: { id: sessionId, plan, user_id } }
  }
  const url = process.env.MOCK_API_URL || 'http://localhost:4001/api/stripe/webhook'
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) })
  console.log('webhook status', res.status)
  console.log(await res.text())
}

if (require.main === module) {
  const [,, sessionId = 'sess_test', plan = 'starter'] = process.argv
  simulate(sessionId, plan).catch((e) => { console.error(e); process.exit(1) })
}
