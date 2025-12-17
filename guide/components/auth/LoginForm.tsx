"use client";
import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [timezone, setTimezone] = useState('');
  const [offsetMinutes, setOffsetMinutes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimezone(tz || '');
    } catch (e) {
      setTimezone('');
    }
    setOffsetMinutes((new Date().getTimezoneOffset() * -1).toString());
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn('credentials', {
      redirect: false,
      email,
      password,
      remember,
      callbackUrl: '/',
    } as any);

    setLoading(false);

    if (res?.error) {
      setError(res.error);
    } else {
      // On success, navigate to callback URL
      window.location.href = (res as any)?.url || '/';
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {error && <div className="auth-alert">{error}</div>}

      <input type="hidden" name="timezone" value={timezone} />
      <input type="hidden" name="offset_minutes" value={offsetMinutes} />

      <div className="form-field">
        <label htmlFor="login-email">Email address</label>
        <input
          id="login-email"
          type="email"
          name="email"
          value={email}
          placeholder="you@example.com"
          required
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          className="auth-input"
        />
      </div>

      <div className="form-field">
        <div className="field-label-row">
          <label htmlFor="login-password">Password</label>
          <a className="auth-link" href="/auth/password/forgot">Forgot password?</a>
        </div>
        <input
          id="login-password"
          type="password"
          name="password"
          placeholder="••••••••"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="auth-input"
        />
      </div>

      <label className="auth-checkbox">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        <span>Remember this device</span>
      </label>

      <button className="auth-submit" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in to Athena'}</button>

      <p className="auth-switch">
        New to Athena? <a className="auth-link" href="/auth/register">Create your membership</a>
      </p>
    </form>
  );
}
