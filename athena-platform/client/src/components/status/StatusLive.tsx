'use client';

/**
 * Live service status, read from the API's own health endpoints every half
 * minute: whether the API answers, whether the database does, whether the
 * platform is closed for maintenance, and which build is running. Anything
 * that cannot be reached is shown as unreachable rather than guessed at.
 */

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Loader2, Wrench, XCircle } from 'lucide-react';
import { API_ORIGIN } from '@/lib/api';
import { cn } from '@/lib/utils';

type Check = { name: string; state: 'ok' | 'degraded' | 'down' | 'maintenance'; detail: string };

// The health endpoints live at the API origin's root, beside /api, so they
// are fetched directly; a readiness failure answers 503 with a body we read.
async function probeJson(path: string): Promise<{ data: Record<string, unknown> }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${API_ORIGIN}${path}`, { signal: controller.signal, cache: 'no-store' });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok && response.status !== 503) throw new Error(`HTTP ${response.status}`);
    return { data };
  } finally {
    clearTimeout(timer);
  }
}

async function probe(): Promise<{ checks: Check[]; version: string | null; checkedAt: string }> {
  const [health, ready, maintenance, version] = await Promise.allSettled([
    probeJson('/health'),
    probeJson('/health/ready'),
    probeJson('/api/maintenance'),
    probeJson('/health/version'),
  ]);

  const checks: Check[] = [];
  checks.push(
    health.status === 'fulfilled' && health.value.data?.status === 'healthy'
      ? { name: 'API', state: 'ok', detail: 'Answering' }
      : { name: 'API', state: 'down', detail: 'Not answering' }
  );
  checks.push(
    ready.status === 'fulfilled' && ready.value.data?.status === 'ready'
      ? { name: 'Database', state: 'ok', detail: 'Connected' }
      : { name: 'Database', state: ready.status === 'fulfilled' ? 'degraded' : 'down', detail: 'The API cannot reach its database' }
  );
  if (maintenance.status === 'fulfilled') {
    const m = maintenance.value.data as { enabled?: boolean; message?: string; startedAt?: string | null };
    checks.push(
      m?.enabled
        ? { name: 'Platform', state: 'maintenance', detail: m.message || 'Closed for maintenance' }
        : { name: 'Platform', state: 'ok', detail: 'Open' }
    );
  } else {
    checks.push({ name: 'Platform', state: 'down', detail: 'Cannot read the maintenance state' });
  }

  const v = version.status === 'fulfilled' ? (version.value.data as { version?: string; commitSha?: string; environment?: string }) : null;
  return {
    checks,
    version: v ? `${v.version ?? '?'}${v.commitSha && v.commitSha !== 'unknown' ? ` (${v.commitSha.slice(0, 7)})` : ''}` : null,
    checkedAt: new Date().toISOString(),
  };
}

const ICON: Record<Check['state'], { Icon: typeof CheckCircle2; tone: string; label: string }> = {
  ok: { Icon: CheckCircle2, tone: 'text-emerald-600', label: 'Operational' },
  degraded: { Icon: AlertTriangle, tone: 'text-amber-600', label: 'Degraded' },
  down: { Icon: XCircle, tone: 'text-red-600', label: 'Unreachable' },
  maintenance: { Icon: Wrench, tone: 'text-amber-600', label: 'Maintenance' },
};

export default function StatusLive() {
  const status = useQuery({ queryKey: ['public-status'], queryFn: probe, refetchInterval: 30000, retry: false });

  if (status.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking…
      </div>
    );
  }
  const data = status.data;
  if (!data) {
    return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">The API could not be reached from your browser.</div>;
  }
  const worst = data.checks.some((c) => c.state === 'down') ? 'down' : data.checks.some((c) => c.state === 'maintenance') ? 'maintenance' : data.checks.some((c) => c.state === 'degraded') ? 'degraded' : 'ok';
  const overall = { ok: 'All systems operational', degraded: 'Partly degraded', down: 'Something is down', maintenance: 'Closed for maintenance' }[worst];

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn('flex items-center gap-2 text-lg font-semibold', ICON[worst].tone)}>
          {(() => {
            const { Icon } = ICON[worst];
            return <Icon className="h-5 w-5" />;
          })()}
          {overall}
        </p>
        <p className="text-xs text-muted-foreground">
          Checked {new Date(data.checkedAt).toLocaleTimeString('en-AU')}
          {data.version ? ` · build ${data.version}` : ''}
        </p>
      </div>
      <ul className="mt-4 divide-y divide-border">
        {data.checks.map((c) => {
          const { Icon, tone, label } = ICON[c.state];
          return (
            <li key={c.name} className="flex items-center justify-between py-2 text-sm">
              <span className="font-medium">{c.name}</span>
              <span className={cn('flex items-center gap-1.5', tone)}>
                <Icon className="h-4 w-4" /> {label}
                <span className="text-muted-foreground">· {c.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
