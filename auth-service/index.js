const express = require('express')
const bodyParser = require('body-parser')
const fs = require('fs')
const path = require('path')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')

const DB = path.join(__dirname, 'auth-db.json')
function readDB(){ try { return JSON.parse(fs.readFileSync(DB)) } catch { return { users: [] } } }
function writeDB(d){ fs.writeFileSync(DB, JSON.stringify(d, null, 2)) }

const app = express()
app.use(bodyParser.json())

const JWT_SECRET = process.env.AUTH_JWT_SECRET || 'dev-secret'
const PORT = process.env.PORT || 5001

app.get('/health', (req, res) => res.json({ ok: true }))

app.post('/register', async (req, res) => {
  const { email, password, name } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'email,password required' })
  const db = readDB()
  if (db.users.find(u => u.email === email)) return res.status(409).json({ error: 'exists' })
  const hash = await bcrypt.hash(password, 10)
  const user = { id: db.users.length + 1, email, name: name || '', password_hash: hash, created_at: new Date().toISOString() }
  db.users.push(user)
  writeDB(db)
  res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } })
})

app.post('/login', async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'email,password required' })
  const db = readDB()
  const u = db.users.find(x => x.email === email)
  if (!u) return res.status(401).json({ error: 'invalid' })
  const ok = await bcrypt.compare(password, u.password_hash)
  if (!ok) return res.status(401).json({ error: 'invalid' })
  const token = jwt.sign({ sub: u.id, email: u.email }, JWT_SECRET, { expiresIn: '7d' })
  res.json({ ok: true, token, user: { id: u.id, email: u.email, name: u.name } })
})

function authMiddleware(req, res, next){
  const a = req.headers.authorization
  if (!a || !a.startsWith('Bearer ')) return res.status(401).json({ error: 'no token' })
  const token = a.slice(7)
  try { const p = jwt.verify(token, JWT_SECRET); req.user = p; next() } catch(e) { return res.status(401).json({ error: 'invalid token' }) }
}

app.get('/me', authMiddleware, (req, res) => {
  const db = readDB()
  const u = db.users.find(x => x.id === req.user.sub)
  if (!u) return res.status(404).json({ error: 'not found' })
  res.json({ user: { id: u.id, email: u.email, name: u.name } })
})

// Simple refresh: accept current Bearer token, verify and return a new token
app.post('/refresh', (req, res) => {
  const a = req.headers.authorization
  if (!a || !a.startsWith('Bearer ')) return res.status(401).json({ error: 'no token' })
  const token = a.slice(7)
  try {
    const p = jwt.verify(token, JWT_SECRET)
    // re-issue new token
    const newToken = jwt.sign({ sub: p.sub, email: p.email }, JWT_SECRET, { expiresIn: '7d' })
    return res.json({ ok: true, token: newToken })
  } catch (e) {
    return res.status(401).json({ error: 'invalid' })
  }
})

app.listen(PORT, () => console.log(`Auth service running on http://localhost:${PORT}`))
