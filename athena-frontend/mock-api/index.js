const express = require('express')
const fs = require('fs')
const path = require('path')

const app = express()
app.use(express.json())

const DB = path.join(__dirname, 'db.json')
function readDB() {
  try { return JSON.parse(fs.readFileSync(DB)) } catch { return { users: [], onboardings: [] } }
}
function writeDB(data) { fs.writeFileSync(DB, JSON.stringify(data, null, 2)) }

app.post('/api/onboarding', (req, res) => {
  const db = readDB()
  db.onboardings.push({ id: db.onboardings.length + 1, payload: req.body, created_at: new Date().toISOString() })
  writeDB(db)
  res.json({ ok: true })
})

app.post('/api/login', (req, res) => {
  const { email } = req.body
  const db = readDB()
  let user = db.users.find((u) => u.email === email)
  if (!user) { user = { id: db.users.length + 1, email, name: 'Dev User' }; db.users.push(user); writeDB(db) }
  res.json({ user, token: 'dev-token' })
})

app.post('/api/subscribe', (req, res) => {
  const { plan } = req.body
  const db = readDB()
  db.subscriptions = db.subscriptions || []
  const sub = { id: db.subscriptions.length + 1, plan, created_at: new Date().toISOString() }
  db.subscriptions.push(sub)
  writeDB(db)
  res.json({ ok: true, subscription: sub })
})

// Mock Stripe: create a checkout session and return redirect URL
app.post('/api/stripe/create-session', (req, res) => {
  const { plan, user_id } = req.body
  const db = readDB()
  const sessionId = `sess_${Math.random().toString(36).slice(2, 9)}`
  const session = { id: sessionId, plan, user_id, status: 'open', created_at: new Date().toISOString() }
  db.sessions = db.sessions || []
  db.sessions.push(session)
  writeDB(db)
  // For dev, redirect to a local success page that simulates Stripe's hosted checkout
  const successUrl = `${process.env.MOCK_CHECKOUT_HOST || 'http://localhost:3000'}/(dashboard)/payments/success?session_id=${sessionId}`
  res.json({ id: sessionId, url: successUrl })
})

// Webhook simulation endpoint — called to notify of a successful payment
app.post('/api/stripe/webhook', (req, res) => {
  const event = req.body
  // event should contain { type: 'checkout.session.completed', data: { object: { id, plan, user_id } } }
  const db = readDB()
  if (event?.type === 'checkout.session.completed') {
    const obj = event.data.object
    db.subscriptions = db.subscriptions || []
    const subscription = { id: db.subscriptions.length + 1, plan: obj.plan, user_id: obj.user_id, created_at: new Date().toISOString() }
    db.subscriptions.push(subscription)
    // Mark session as complete
    db.sessions = db.sessions || []
    const s = db.sessions.find((x) => x.id === obj.id)
    if (s) s.status = 'complete'
    writeDB(db)
    return res.json({ received: true })
  }
  res.status(400).json({ error: 'unknown event' })
})

// Reports and verification (trust & safety stubs)
app.post('/api/report', (req, res) => {
  const { type, reporter_id, target_id, details } = req.body || {}
  const db = readDB()
  db.reports = db.reports || []
  const report = { id: db.reports.length + 1, type, reporter_id, target_id, details, created_at: new Date().toISOString(), status: 'open' }
  db.reports.push(report)
  writeDB(db)
  res.json({ ok: true, report })
})

app.post('/api/verify/request', (req, res) => {
  const { user_id, doc_type } = req.body || {}
  const db = readDB()
  db.verifications = db.verifications || []
  const v = { id: db.verifications.length + 1, user_id, doc_type, status: 'queued', created_at: new Date().toISOString() }
  db.verifications.push(v)
  writeDB(db)
  res.json({ ok: true, verification: v })
})

app.get('/api/reports', (req, res) => {
  const db = readDB()
  res.json({ reports: db.reports || [] })
})

app.get('/api/verifications', (req, res) => {
  const db = readDB()
  res.json({ verifications: db.verifications || [] })
})

// Simple AI mock endpoint with safety checks
app.post('/api/ai/ask', (req, res) => {
  const { question } = req.body || {}
  // Very small safety check: reject PII requests
  if (question && /ssn|password|credit card/i.test(question)) {
    return res.json({ ok: false, error: 'PII request blocked' })
  }
  const reply = `Mock AI says: I can help with "${question}" — here's a stub response.`
  res.json({ ok: true, reply, safety: { flagged: false } })
})

app.get('/api/ping', (req, res) => res.json({ ok: true }))

// Jobs and housing sample endpoints
app.get('/api/jobs', (req, res) => {
  const jobs = [
    { id: 1, title: 'Junior Developer', skills: 'javascript react node express', location: 'Melbourne', seniority: 'junior', age_days: 2, applied_by: [] },
    { id: 2, title: 'Senior Backend Engineer', skills: 'go sql docker', location: 'Sydney', seniority: 'senior', age_days: 20, applied_by: [] },
    { id: 3, title: 'Frontend Engineer', skills: 'react typescript css', location: 'Melbourne', seniority: 'mid', age_days: 5, applied_by: [] },
  ]
  res.json({ jobs })
})

app.get('/api/feed', (req, res) => {
  const posts = [
    { id: 1, author: 'Ava', content: 'Just completed my apprenticeship!' },
    { id: 2, author: 'Maya', content: 'How to negotiate return-to-work flexibility?' },
  ]
  res.json({ posts })
})

app.get('/api/housing', (req, res) => {
  const properties = [
    { id: 1, title: 'Sunny 2BR near CBD', price: '$420/wk', location: 'Melbourne' },
    { id: 2, title: 'Quiet 1BR with garden', price: '$350/wk', location: 'Sydney' },
  ]
  res.json({ properties })
})

// Match scoring endpoint (MVP implementation)
app.post('/api/match/score', (req, res) => {
  const { profile_id, job_ids } = req.body || {}
  const db = readDB()
  // For demo, use jobs from sample array above
  const jobs = [
    { id: 1, title: 'Junior Developer', skills: 'javascript react node express', location: 'Melbourne', seniority: 'junior', age_days: 2 },
    { id: 2, title: 'Senior Backend Engineer', skills: 'go sql docker', location: 'Sydney', seniority: 'senior', age_days: 20 },
    { id: 3, title: 'Frontend Engineer', skills: 'react typescript css', location: 'Melbourne', seniority: 'mid', age_days: 5 },
    { id: 4, title: 'Apprentice Electrician', skills: 'wiring tools', location: 'Melbourne', seniority: 'junior', age_days: 10 }
  ]

  // find profile in DB or use a synthetic one when missing
  const profile = (db.users || []).find((u) => u.id === profile_id) || { id: profile_id || 1, skills: 'javascript react node express', intent: 'developer', location: 'Melbourne', seniority: 'junior' }

  function tfidfVector(text) {
    const tokens = (text || '').toLowerCase().split(/\W+/).filter(Boolean)
    const counts = {}
    tokens.forEach((t) => counts[t] = (counts[t] || 0) + 1)
    return counts
  }
  function overlapScore(profileVec, jobVec) {
    const shared = Object.keys(profileVec).filter(k => jobVec[k])
    const sharedSum = shared.reduce((s, k) => s + Math.min(profileVec[k], jobVec[k]), 0)
    const profileSum = Object.values(profileVec).reduce((s, v) => s + v, 0) || 1
    return sharedSum / profileSum
  }

  const scores = jobs.filter(j => !job_ids || job_ids.includes(j.id)).map((job) => {
    const skill = overlapScore(tfidfVector(profile.skills), tfidfVector(job.skills))
    const intent = (profile.intent && job.title.toLowerCase().includes(profile.intent.toLowerCase())) ? 1 : 0
    const location = (!profile.location || !job.location) ? 1 : (profile.location.toLowerCase() === job.location.toLowerCase() ? 1 : 0)
    const seniority = (profile.seniority === job.seniority) ? 1 : 0
    const recency = job.age_days && job.age_days < 30 ? 1 : 0
    const final = (skill * 0.5 + location * 0.2 + intent * 0.1 + seniority * 0.1 + recency * 0.1)
    return { job_id: job.id, score: Math.round(final * 100) }
  })

  res.json({ scores })
})

const port = process.env.PORT || 4001
app.listen(port, () => console.log(`Mock API running on http://localhost:${port}`))
