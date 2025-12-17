import LoginForm from '../../../components/auth/LoginForm';

export const metadata = {
  title: 'Sign in',
  description: 'Sign in to Athena to pick up where you left off across jobs, money, housing and wellbeing.',
};

export default function LoginPage() {
  return (
    <section className="auth-shell">
      <div className="auth-hero">
        <div className="auth-hero__copy">
          <p className="auth-eyebrow">Member access</p>
          <h1>Welcome back to your Athena dashboard</h1>
          <p>
            Keep every job lead, financial insight, housing path and wellbeing ritual in one calm surface. Athena
            remembers your progress, honours your boundaries, and keeps AI Concierge tuned to your goals.
          </p>

          <div className="auth-highlights" role="list">
            <div className="auth-highlight" role="listitem">
              <div className="auth-highlight__icon" aria-hidden>⚡</div>
              <div>
                <p className="auth-highlight__title">Unified updates</p>
                <p className="auth-highlight__copy">Latest status across jobs, grants, safe housing and AI Concierge briefs.</p>
              </div>
            </div>
            <div className="auth-highlight" role="listitem">
              <div className="auth-highlight__icon" aria-hidden>🔐</div>
              <div>
                <p className="auth-highlight__title">Respectful security</p>
                <p className="auth-highlight__copy">Session health, device alerts and multi-factor ready when you are.</p>
              </div>
            </div>
            <div className="auth-highlight" role="listitem">
              <div className="auth-highlight__icon" aria-hidden>🤝</div>
              <div>
                <p className="auth-highlight__title">Athena Lounge</p>
                <p className="auth-highlight__copy">Drop back into moderated discussions, referrals and AI co-drafts.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-panel" aria-labelledby="auth-heading">
          <div className="auth-panel__header">
            <p className="auth-panel__eyebrow">Sign in</p>
            <h2 id="auth-heading">Continue with your member credentials</h2>
            <p>Grounded, distraction-free login that mirrors the dashboard surface.</p>
          </div>

          <LoginForm />
        </div>
      </div>
    </section>
  );
}
