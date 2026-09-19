'use client';

/**
 * What the platform is running with, read from the API rather than typed in.
 *
 * This page used to print a table of constants ('Maintenance Mode: Disabled',
 * 'Session Timeout: 7 days', 'CDN: CloudFront', 'Last Deploy: today') that
 * nothing read from anywhere and that were mostly wrong; an operator could
 * read 'Disabled' during an outage with maintenance on. Everything shown now
 * comes from GET /admin/ops/summary (the live state), GET /admin/ops/config
 * (the process's own account of its configuration, values reduced to
 * "configured or not") and lib/contact (what the web build knows about the
 * organisation). Where the server does not know, the page says so.
 *
 * Nothing here is editable: settings are environment variables. Maintenance
 * mode and feature flags are changed on /admin/feature-flags.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Building2, ChevronLeft, GitCommit, Loader2, Plug, Shield, Wrench, HardDrive } from 'lucide-react';
import { adminOpsApi, type OpsSummary, type RuntimeConfig } from '@/lib/admin-ops-api';
import { contactEmail, HAS_LEGAL_IDENTITY, HAS_OWNED_DOMAIN, ORGANISATION } from '@/lib/contact';
import { cn } from '@/lib/utils';

/** '1 hour', '30 days', '45 minutes'; null when the server could not measure it. */
function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) return null;
  const units: Array<[string, number]> = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];
  for (const [name, size] of units) {
    if (seconds % size === 0 || size === 1) {
      const n = Math.round(seconds / size);
      return `${n} ${name}${n === 1 ? '' : 's'}`;
    }
  }
  return `${seconds} seconds`;
}

const errorMessage = (e: unknown) =>
  (e as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ||
  (e as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.error;

function Configured({ ok, yes = 'Configured', no = 'Not configured', tone = 'neutral' }: { ok: boolean; yes?: string; no?: string; tone?: 'neutral' | 'warn' }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-medium',
        ok
          ? tone === 'warn'
            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
          : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
      )}
    >
      {ok ? yes : no}
    </span>
  );
}

function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      <div className="text-right text-sm font-medium text-slate-900 dark:text-white">{children}</div>
    </div>
  );
}

function Card({ icon: Icon, title, description, children }: { icon: typeof Shield; title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-lg bg-white shadow dark:bg-slate-800">
      <div className="flex items-center gap-3 border-b border-slate-200 p-5 dark:border-slate-700">
        <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-700">
          <Icon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <div className="divide-y divide-slate-100 px-5 py-2 dark:divide-slate-700">{children}</div>
    </section>
  );
}

const NOT_RECORDED = <span className="text-slate-500">Not recorded</span>;

export default function AdminSettingsPage() {
  const summary = useQuery({
    queryKey: ['admin-ops-summary'],
    queryFn: () => adminOpsApi.summary(),
    select: (r) => r.data as OpsSummary,
  });
  const config = useQuery({
    queryKey: ['admin-ops-config'],
    queryFn: () => adminOpsApi.config(),
    select: (r) => r.data as RuntimeConfig,
  });
  const flags = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => adminOpsApi.featureFlags(),
    select: (r) => (Array.isArray(r.data?.flags) ? (r.data.flags as unknown[]).length : null),
  });

  const loading = summary.isLoading || config.isLoading;
  const failed = summary.error || config.error;
  const s = summary.data;
  const c = config.data;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <header className="bg-white shadow dark:bg-slate-800">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-slate-500 hover:text-slate-700" aria-label="Back to admin">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Platform settings</h1>
              <p className="text-slate-600 dark:text-slate-400">What is running, as the API reports it</p>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-16" role="status" aria-label="Loading">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : failed ? (
          <div className="rounded-lg bg-white p-6 text-center shadow dark:bg-slate-800">
            <p className="font-medium text-slate-900 dark:text-white">The API did not answer</p>
            <p className="mt-1 text-sm text-slate-500">{errorMessage(summary.error || config.error) || 'Only a platform admin can read this page.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card icon={Wrench} title="Right now" description="Live state, read fresh on every load">
              <Row
                label="Maintenance mode"
                hint={
                  <Link href="/admin/feature-flags" className="text-primary-600 hover:underline">
                    Change it on Feature flags
                  </Link>
                }
              >
                {s?.maintenance.enabled ? (
                  <span className="text-amber-700 dark:text-amber-300">
                    On{s.maintenance.startedAt ? `, since ${formatDistanceToNow(new Date(s.maintenance.startedAt), { addSuffix: true })}` : ''}
                  </span>
                ) : (
                  'Off, the platform is open'
                )}
              </Row>
              <Row label="Breach notifications awaiting" hint={<Link href="/admin/breaches" className="text-primary-600 hover:underline">Data breach register</Link>}>
                {s ? (
                  <>
                    {s.breaches.awaitingNotification}
                    {s.breaches.overdue > 0 && <span className="ml-2 text-red-600">{s.breaches.overdue} overdue</span>}
                    {s.breaches.dueWithin24Hours > 0 && <span className="ml-2 text-amber-600">{s.breaches.dueWithin24Hours} due within 24h</span>}
                  </>
                ) : (
                  NOT_RECORDED
                )}
              </Row>
              <Row label="Legal holds active" hint={<Link href="/admin/compliance" className="text-primary-600 hover:underline">Compliance</Link>}>
                {s ? s.legalHolds.active : NOT_RECORDED}
              </Row>
              <Row label="Authority referrals awaiting filing" hint={<Link href="/admin/moderation" className="text-primary-600 hover:underline">Report queue</Link>}>
                {s ? s.authorityEscalations.awaitingFiling : NOT_RECORDED}
              </Row>
              <Row label="Feature flags" hint={<Link href="/admin/feature-flags" className="text-primary-600 hover:underline">Feature flags</Link>}>
                {flags.data === null || flags.data === undefined ? NOT_RECORDED : flags.data}
              </Row>
            </Card>

            <Card icon={GitCommit} title="Build" description="The API process that answered this page">
              <Row label="Version">{c?.build.version ?? NOT_RECORDED}</Row>
              <Row label="Environment">{c?.build.environment}</Row>
              <Row label="Node">{c?.build.node}</Row>
              {c?.build.commitSha && <Row label="Commit"><code className="text-xs">{c.build.commitSha.slice(0, 12)}</code></Row>}
              {c?.build.buildTime && <Row label="Built">{c.build.buildTime}</Row>}
              {!c?.build.commitSha && !c?.build.buildTime && (
                <Row label="Commit and build time" hint="Set COMMIT_SHA and BUILD_TIME at deploy to see them here">
                  {NOT_RECORDED}
                </Row>
              )}
            </Card>

            <Card icon={Shield} title="Security" description="Sessions, staff access and the request budget">
              <Row label="Staff two-factor" hint="Production always requires it; STAFF_TWO_FACTOR_REQUIRED=false switches it off elsewhere">
                {c?.security.staffTwoFactor === 'required' ? 'Required before any staff power works' : <span className="text-amber-700 dark:text-amber-300">Optional in this environment</span>}
              </Row>
              <Row label="Access token lifetime" hint="JWT_EXPIRES_IN">
                {formatDuration(c?.tokens.accessSeconds) ?? NOT_RECORDED}
              </Row>
              <Row label="Refresh token lifetime" hint="JWT_REFRESH_EXPIRES_IN">
                {formatDuration(c?.tokens.refreshSeconds) ?? NOT_RECORDED}
              </Row>
              <Row label="API rate limit" hint="RATE_LIMIT_MAX per RATE_LIMIT_WINDOW_MS">
                {c?.rateLimit.enabled
                  ? `${c.rateLimit.max.toLocaleString()} requests per ${formatDuration(Math.round(c.rateLimit.windowMs / 1000)) ?? `${c.rateLimit.windowMs} ms`}`
                  : <span className="text-amber-700 dark:text-amber-300">Off (development switch)</span>}
              </Row>
            </Card>

            <Card icon={HardDrive} title="Storage and media" description="Where uploads go">
              <Row label="Backend">
                {c?.storage.backend === 's3' ? 'Amazon S3' : 'Local disk on the API host'}
              </Row>
              {c?.storage.backend === 's3' && <Row label="Region">{c.storage.region}</Row>}
              <Row label="Bucket" hint="S3_BUCKET"><Configured ok={Boolean(c?.storage.bucketConfigured)} /></Row>
              <Row label="CDN" hint="CDN_URL; without it files are served from the bucket or the API"><Configured ok={Boolean(c?.storage.cdnConfigured)} /></Row>
            </Card>

            <Card icon={Plug} title="Integrations" description="Configured or not; keys are never shown">
              <Row label="Email (SendGrid)"><Configured ok={Boolean(c?.integrations.email)} /></Row>
              <Row label="Payments (Stripe)"><Configured ok={Boolean(c?.integrations.stripe)} /></Row>
              <Row label="AI provider"><Configured ok={Boolean(c?.integrations.ai)} /></Row>
              <Row label="AI simulation" hint="AI_ALLOW_SIMULATION; simulated answers are labelled as such">
                <Configured ok={Boolean(c?.integrations.aiSimulationAllowed)} yes="Allowed" no="Not allowed" tone="warn" />
              </Row>
              <Row label="Redis" hint="Shared rate limits, queues and cache; in-process without it"><Configured ok={Boolean(c?.integrations.redis)} /></Row>
              <Row label="OpenSearch" hint="Search falls back to the database without it"><Configured ok={Boolean(c?.integrations.openSearch)} /></Row>
              <Row label="Live-stream ingest" hint="Hosts paste a playback URL without it"><Configured ok={Boolean(c?.integrations.livestreamIngest)} /></Row>
              <Row label="Live-stream playback template"><Configured ok={Boolean(c?.integrations.livestreamPlayback)} /></Row>
              <Row label="Error reporting (Sentry)"><Configured ok={Boolean(c?.integrations.sentry)} /></Row>
            </Card>

            <Card icon={Building2} title="Contact and legal identity" description="What the web build publishes about the organisation">
              <Row label="Legal name">{ORGANISATION.legalName}</Row>
              <Row label="Jurisdiction">{ORGANISATION.jurisdiction}</Row>
              <Row label="Support contact">{contactEmail('support') ?? 'In-product help centre (no domain configured)'}</Row>
              <Row label="Owned email domain" hint="NEXT_PUBLIC_CONTACT_DOMAIN"><Configured ok={HAS_OWNED_DOMAIN} /></Row>
              <Row label="ABN and registered office" hint="Published on the legal pages once set">
                <Configured ok={HAS_LEGAL_IDENTITY} yes="Published" no="Not yet published" />
              </Row>
            </Card>
          </div>
        )}

        <div className="mt-8 rounded-lg bg-amber-50 p-6 dark:bg-amber-900/20">
          <h2 className="mb-2 font-semibold text-amber-800 dark:text-amber-200">Changing any of this</h2>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Settings are environment variables on the API and web hosts; nothing on this page is editable here, and the values above are what the running process reported when the page loaded.
            Maintenance mode and feature flags are the exceptions and live on <Link href="/admin/feature-flags" className="underline">Feature flags</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}
