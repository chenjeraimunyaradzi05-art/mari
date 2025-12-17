import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props { params: { token: string } }

export default function ResetPage({ params }: Props){
  const { token } = params
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent){
    e.preventDefault()
    setError(''); setMessage('')
    if (password !== passwordConfirmation) { setError('Passwords do not match'); return }
    try {
      const res = await fetch('/api/auth/password/reset', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ token, password, password_confirmation: passwordConfirmation })
      })
      const json = await res.json()
      if (!res.ok) setError(json?.message || 'Reset failed')
      else { setMessage('Password reset. You may sign in now.'); setTimeout(()=>router.push('/auth/login'), 1500) }
    } catch (err) {
      setError('Reset failed')
    }
  }

  return (
    <section className="auth-shell">
      <div className="auth-panel">
        <div className="auth-panel__header">
          <p className="auth-panel__eyebrow">Reset password</p>
          <h2>Enter a new password</h2>
        </div>

        {error && <div className="auth-alert">{error}</div>}
        {message && <div className="auth-alert success">{message}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required />
          </div>
          <div className="form-field">
            <label htmlFor="password_confirmation">Confirm password</label>
            <input id="password_confirmation" type="password" value={passwordConfirmation} onChange={(e)=>setPasswordConfirmation(e.target.value)} required />
          </div>

          <button className="auth-submit" type="submit">Reset password</button>
        </form>
      </div>
    </section>
  )
}
