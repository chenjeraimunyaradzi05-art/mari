"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const pronounOptions = [
  'she_her', 'they_them', 'he_him', 'self_described'
];

const accountOptions = [
  { value: 'candidate', title: 'Candidate', summary: 'Looking for jobs and growth' },
  { value: 'founder', title: 'Founder', summary: 'Starting or scaling a business' },
];

const intentOptions = [
  { value: 'career_growth', title: 'Career momentum' },
  { value: 'launch_business', title: 'Launch a venture' },
  { value: 'wealth_building', title: 'Build wealth' },
];

const portalOptions = [
  { value: 'education', label: 'Education' },
  { value: 'business', label: 'Business' },
  { value: 'financial_wellbeing', label: 'Financial wellbeing' },
  { value: 'social_feed', label: 'Social feed' },
  { value: 'real_estate', label: 'Real estate' },
];

export default function RegisterForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [pronouns, setPronouns] = useState('she_her');
  const [accountType, setAccountType] = useState('candidate');
  const [intent, setIntent] = useState('career_growth');
  const [desiredPortals, setDesiredPortals] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      name, email, password, password_confirmation: passwordConfirmation,
      pronouns, account_type: accountType, intent, desired_portals: desiredPortals,
    };

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.message || 'Registration failed');
      return;
    }

    // on success, navigate to verification or welcome
    router.push('/auth/verify');
  }

  function togglePortal(val: string) {
    setDesiredPortals((prev) => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {error && <div className="auth-alert">{error}</div>}

      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="full-name">Full name *</label>
          <input id="full-name" type="text" name="name" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Your name" required />
        </div>

        <div className="form-field">
          <label htmlFor="email">Email *</label>
          <input id="email" type="email" name="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" required />
        </div>

        <div className="form-field">
          <label htmlFor="password">Password *</label>
          <input id="password" type="password" name="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Enter a secure password" required />
        </div>

        <div className="form-field">
          <label htmlFor="password_confirmation">Confirm password *</label>
          <input id="password_confirmation" type="password" name="password_confirmation" value={passwordConfirmation} onChange={(e)=>setPasswordConfirmation(e.target.value)} placeholder="Repeat your password" required />
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="pronouns">Pronouns *</label>
        <select id="pronouns" name="pronouns" value={pronouns} onChange={(e)=>setPronouns(e.target.value)} required>
          {pronounOptions.map(p=> <option key={p} value={p}>{p.replace('_',' ').toUpperCase()}</option>)}
        </select>
      </div>

      <div className="form-field">
        <span className="field-label">Create account for *</span>
        <div className="choice-grid">
          {accountOptions.map(a => (
            <label className="choice-card" key={a.value}>
              <input type="radio" name="account_type" value={a.value} checked={accountType===a.value} onChange={()=>setAccountType(a.value)} />
              <span className="choice-content"><strong>{a.title}</strong><p>{a.summary}</p></span>
            </label>
          ))}
        </div>
      </div>

      <div className="form-field">
        <span className="field-label">What brings you to Athena? *</span>
        <div className="choice-grid">
          {intentOptions.map(i => (
            <label className="choice-card" key={i.value}>
              <input type="radio" name="intent" value={i.value} checked={intent===i.value} onChange={()=>setIntent(i.value)} />
              <span className="choice-content"><strong>{i.title}</strong></span>
            </label>
          ))}
        </div>
      </div>

      <div className="form-field">
        <span className="field-label">Which portals do you want to explore first? *</span>
        <div className="choice-grid choice-grid--compact">
          {portalOptions.map(p => (
            <label className="choice-card choice-card--checkbox" key={p.value}>
              <input type="checkbox" name="desired_portals[]" value={p.value} checked={desiredPortals.includes(p.value)} onChange={()=>togglePortal(p.value)} />
              <span className="choice-content"><strong>{p.label}</strong></span>
            </label>
          ))}
        </div>
      </div>

      <button className="btn btn--full" type="submit" disabled={loading}>{loading ? 'Submitting…' : 'Submit & register'}</button>
    </form>
  );
}
