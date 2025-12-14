"use client";

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Snackbar } from '@/components/ui/Snackbar';
import '../dashboard/shared-dashboard.css';

type GatingState = { status: string; canAppeal: boolean } | null;

function IdentityAppealContent() {
  const { data: session } = useSession();
  const [appealText, setAppealText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [gating, setGating] = useState<GatingState>(null);
  const [loadingGating, setLoadingGating] = useState(true);
  const searchParams = useSearchParams();

  const canSubmit = useMemo(
    () => appealText.trim().length >= 20 && !submitting && !success && (gating?.canAppeal ?? true),
    [appealText, submitting, success, gating]
  );

  useEffect(() => {
    // seed gating from session to avoid an extra fetch when available
    if (session?.user?.identityFlagStatus) {
      const status = session.user.identityFlagStatus.toUpperCase();
      setGating({ status, canAppeal: status !== 'APPEAL_SUBMITTED' && status !== 'VERIFIED' });
      setLoadingGating(false);
      return;
    }

    let mounted = true;
    async function loadGating() {
      try {
        const res = await fetch('/api/identity/appeal');
        const payload = await res.json();
        if (!mounted) return;
        if (res.ok) {
          setGating(payload.gating ?? null);
        } else {
          setError(payload?.error ?? 'Unable to load enforcement state.');
        }
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Unable to load enforcement state.');
      } finally {
        if (mounted) setLoadingGating(false);
      }
    }

    loadGating();
    return () => {
      mounted = false;
    };
  }, [session?.user?.identityFlagStatus]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/identity/appeal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appealText: appealText.trim(), enforcementState: 'flagged' }),
      });

      const payload = await res.json();
      setGating(payload.gating ?? null);

      if (!res.ok) {
        setError(payload?.error ?? 'Unable to submit your appeal. Please try again.');
        return;
      }

      setSuccess(payload?.message ?? 'Appeal submitted. Our safety team will review.');
      setAppealText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error while submitting appeal.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      className="dash-shell"
      aria-label="Identity appeal"
      style={{
        background:
          'radial-gradient(circle at 16% 12%, rgba(233,30,140,0.08), transparent 30%), radial-gradient(circle at 84% 10%, rgba(139,92,246,0.08), transparent 28%), var(--background)',
      }}
    >
      <div className="dash-container" style={{ maxWidth: 800 }}>

        <div
          className="card-plain"
          style={{
            padding: 22,
            border: '1px solid var(--border)',
            background: 'var(--card)',
            boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)',
          }}
        >
          <div style={{ background: '#fce7f3', color: '#9d174d', padding: '12px 14px', borderRadius: 12, marginBottom: 16, border: '1px solid var(--border)' }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Account Under Review</h2>
          </div>
          <p className="stat-value" style={{ fontSize: 18, margin: '0 0 12px', color: '#0f172a' }}>
            Your account has been flagged for review due to our identity verification policies.
          </p>
          <p className="stat-context" style={{ margin: '0 0 16px', color: '#475569' }}>
            We are committed to maintaining a safe, women-first environment. If you believe this flag was applied in error,
            please submit an appeal below explaining your situation.
          </p>

          {gating && (
            <div className="card-plain" style={{ background: '#f1f5f9', border: '1px dashed var(--border)', marginBottom: 12 }}>
              <p className="stat-label" style={{ margin: 0 }}>Enforcement gating</p>
              <p className="stat-context" style={{ margin: '4px 0 0' }}>Status: {gating.status}</p>
              <p className="stat-context" style={{ margin: 0 }}>Appeal window: {gating.canAppeal ? 'open' : 'closed'}</p>
            </div>
          )}
          {searchParams?.get('reason') === 'identity_flagged' && (
            <Snackbar
              message="We redirected you here because your account requires identity verification. Complete the appeal to regain access."
              variant="info"
              durationMs={8000}
            />
          )}

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecdd3', color: '#b91c1c', padding: '10px 12px', borderRadius: 12, marginBottom: 12 }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ background: '#ecfdf3', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 12px', borderRadius: 12, marginBottom: 12 }}>
              {success}
            </div>
          )}

          <form className="search-form" style={{ gap: 14 }} onSubmit={handleSubmit}>
            <div>
              <label className="stat-label" htmlFor="appeal_text">Appeal Explanation</label>
              <textarea
                id="appeal_text"
                className="textarea"
                rows={6}
                placeholder="Please explain why your account should be reinstated..."
                value={appealText}
                onChange={(event) => setAppealText(event.target.value)}
                required
                minLength={20}
                maxLength={2000}
              />
              <p className="stat-context" style={{ marginTop: 6 }}>
                Include any context that helps our safety team verify your identity. Minimum 20 characters.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div className="stat-context">Signed in as {session?.user?.email ?? 'unknown user'}</div>
              <button type="submit" className="btn-primary-gradient" disabled={!canSubmit || loadingGating}>
                {submitting
                  ? 'Submitting…'
                  : success
                  ? 'Appeal Submitted'
                  : gating && !gating.canAppeal
                  ? 'Appeal Closed'
                  : 'Submit Appeal'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function IdentityAppealPage() {
  return (
    <Suspense fallback={<div className="dash-container" style={{ padding: 20 }}>Loading identity verification...</div>}>
      <IdentityAppealContent />
    </Suspense>
  );
}
