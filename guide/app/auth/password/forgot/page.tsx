'use client'
import { useState } from 'react'

export default function ForgotPasswordPage(){
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent){
    e.preventDefault()
    setLoading(true); setError(''); setMessage('')
    try {
      const res = await fetch('/api/auth/password/forgot', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email })
      })
      const json = await res.json()
      if (!res.ok) setError(json?.message || 'Request failed')
      else setMessage('If an account exists we sent password reset instructions.')
    } catch (err) {
      setError('Could not send reset. Try again later.')
    } finally { setLoading(false) }
  }

  return (
    <section className="auth-shell">
      <div className="auth-panel">
        <div className="auth-panel__header">
          <p className="auth-panel__eyebrow">Forgot password</p>
          <h2>Request a password reset</h2>
          <p>Enter your email and we will send instructions to reset your password.</p>
        </div>

        {error && <div className="auth-alert">{error}</div>}
        {message && <div className="auth-alert success">{message}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required placeholder="you@example.com"/>
          </div>
          <button className="auth-submit" type="submit" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</button>
        </form>
      </div>
    </section>
  )
}
