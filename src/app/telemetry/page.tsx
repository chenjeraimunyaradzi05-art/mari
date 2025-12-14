import React from 'react';
import '../dashboard/shared-dashboard.css';
import { prisma } from '@/lib/db';

type Interaction = {
  userId: string;
  actionType: string;
  durationSeconds: number | null;
  timestamp: Date;
};

type TimelinePoint = { date: string; total: number };

type TelemetrySummary = {
  title: string;
  hub: string;
  total: number;
  uniqueUsers: number;
  authRate: string;
  lastSeen: string;
  averages: { label: string; value: string }[];
  timeline: TimelinePoint[];
  latestMetrics?: { label: string; value: string }[];
  signalLabels?: string[];
};

type AIContextRow = {
  context: string;
  total: number;
  uniqueUsers: number;
  avgDuration: number;
  historyRate: string;
  lastSeen: string;
};

const rangeOptions = [7, 14, 30, 90];

function relativeTime(date: Date | null) {
  if (!date) return '—';
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.max(1, Math.round(diffMs / 3600000));
  return diffHours < 24 ? `${diffHours}h ago` : `${Math.round(diffHours / 24)}d ago`;
}

function toDateLabel(date: Date) {
  return new Intl.DateTimeFormat('en-AU', { month: 'short', day: 'numeric' }).format(date);
}

function buildTimeline(interactions: Interaction[]): TimelinePoint[] {
  const buckets = new Map<string, number>();
  interactions.forEach((item) => {
    const label = toDateLabel(item.timestamp);
    buckets.set(label, (buckets.get(label) ?? 0) + 1);
  });
  return Array.from(buckets.entries())
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-10);
}

function buildSummary(title: string, hub: string, interactions: Interaction[]): TelemetrySummary {
  const uniqueUsers = new Set(interactions.map((i) => i.userId)).size;
  const lastSeenDate = interactions.length ? interactions.reduce((latest, i) => (i.timestamp > latest ? i.timestamp : latest), interactions[0].timestamp) : null;
  const avgDuration = interactions.reduce((sum, i) => sum + (i.durationSeconds ?? 0), 0) / (interactions.length || 1);
  const avgInteractionsPerUser = uniqueUsers ? (interactions.length / uniqueUsers).toFixed(1) : '0';
  const timelineBuckets = new Map<string, number>();
  interactions.forEach((i) => {
    const label = toDateLabel(i.timestamp);
    timelineBuckets.set(label, (timelineBuckets.get(label) ?? 0) + 1);
  });
  const peakDay = timelineBuckets.size ? Math.max(...timelineBuckets.values()) : 0;
  const longestSession = interactions.reduce((max, i) => Math.max(max, i.durationSeconds ?? 0), 0);

  return {
    title,
    hub,
    total: interactions.length,
    uniqueUsers,
    authRate: uniqueUsers ? `${Math.min(100, Math.round((uniqueUsers / interactions.length) * 100)).toString()}%` : '0%',
    lastSeen: relativeTime(lastSeenDate),
    averages: [
      { label: 'Avg duration (s)', value: avgDuration.toFixed(0) },
      { label: 'Avg interactions per user', value: avgInteractionsPerUser },
    ],
    timeline: buildTimeline(interactions),
    latestMetrics: [
      { label: 'Peak day volume', value: `${peakDay}` },
      { label: 'Longest session (s)', value: `${longestSession}` },
    ],
  };
}

function buildAIContexts(interactions: Interaction[]): AIContextRow[] {
  const byAction = new Map<string, Interaction[]>();
  interactions.forEach((item) => {
    const key = item.actionType || 'unknown';
    const group = byAction.get(key) ?? [];
    group.push(item);
    byAction.set(key, group);
  });

  return Array.from(byAction.entries()).map(([context, group]) => {
    const uniqueUsers = new Set(group.map((g) => g.userId)).size;
    const avgDuration = group.reduce((sum, g) => sum + (g.durationSeconds ?? 0), 0) / (group.length || 1);
    const longSessions = group.filter((g) => (g.durationSeconds ?? 0) > 120).length;
    const historyRate = group.length ? `${Math.round((longSessions / group.length) * 100)}%` : '0%';
    const lastSeen = group.reduce((latest, g) => (g.timestamp > latest ? g.timestamp : latest), group[0].timestamp);

    return {
      context,
      total: group.length,
      uniqueUsers,
      avgDuration: Math.round(avgDuration),
      historyRate,
      lastSeen: relativeTime(lastSeen),
    };
  });
}

async function loadTelemetry(days = 14) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const interactions = await prisma.userInteraction.findMany({
    where: { timestamp: { gte: since } },
    orderBy: { timestamp: 'asc' },
    select: { userId: true, actionType: true, durationSeconds: true, timestamp: true },
  });

  const mobility = interactions.filter((i) => i.actionType === 'view');
  const wellness = interactions.filter((i) => i.actionType !== 'view');

  const mobilitySummary = buildSummary('Mobility Suite renders', 'Home hub', mobility);
  const wellnessSummary = {
    ...buildSummary('Finance + AI section loads', 'Wellness hub', wellness),
    signalLabels: Array.from(new Set(wellness.map((i) => i.actionType || 'unknown'))),
  } as TelemetrySummary;

  const aiContexts = buildAIContexts(interactions);

  return { mobilitySummary, wellnessSummary, aiContexts, days };
}

export default async function TelemetryPage() {
  const { mobilitySummary, wellnessSummary, aiContexts, days } = await loadTelemetry();

  return (
    <main className="dash-shell" aria-label="Telemetry dashboard">
      <div className="dash-container" style={{ display: 'grid', gap: 18 }}>
        <header className="search-hero" style={{ background: 'linear-gradient(135deg,#0f172a,#1f2937)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <p className="stat-label" style={{ color: 'rgba(255,255,255,0.75)' }}>Athena telemetry</p>
              <h1 style={{ margin: '6px 0 8px' }}>Mobility &amp; wellness adoption signals</h1>
              <p style={{ color: 'rgba(226,232,240,0.85)', margin: 0 }}>Window: last {days} days (live)</p>
            </div>
            <div style={{ display: 'grid', gap: 4 }}>
              <label className="stat-label" htmlFor="telemetry-range" style={{ color: 'rgba(255,255,255,0.75)' }}>Window</label>
              <select id="telemetry-range" className="select" defaultValue={days} style={{ minWidth: 140 }}>
                {rangeOptions.map((option) => (
                  <option key={option} value={option}>{option} days</option>
                ))}
              </select>
            </div>
          </div>
        </header>

        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
          {[mobilitySummary, wellnessSummary].map((summary) => (
            <article key={summary.title} className="card-plain" style={{ borderRadius: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <p className="stat-label" style={{ letterSpacing: '0.2em' }}>{summary.hub}</p>
                  <h2 style={{ margin: '0 0 6px' }}>{summary.title}</h2>
                  <p className="stat-context" style={{ margin: 0 }}>Last seen {summary.lastSeen}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p className="stat-value" style={{ margin: 0 }}>{summary.total.toLocaleString()}</p>
                  <p className="stat-context" style={{ margin: 0 }}>Total events</p>
                </div>
              </div>

              <div className="dash-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', marginTop: 12 }}>
                <div className="card-plain" style={{ background: '#f8fafc' }}>
                  <p className="stat-label" style={{ marginBottom: 4 }}>Unique members</p>
                  <p className="stat-value" style={{ fontSize: 20 }}>{summary.uniqueUsers.toLocaleString()}</p>
                </div>
                <div className="card-plain" style={{ background: '#f8fafc' }}>
                  <p className="stat-label" style={{ marginBottom: 4 }}>Signed-in rate</p>
                  <p className="stat-value" style={{ fontSize: 20 }}>{summary.authRate}</p>
                </div>
                {summary.averages.map((average) => (
                  <div key={average.label} className="card-plain" style={{ background: '#f8fafc' }}>
                    <p className="stat-label" style={{ marginBottom: 4 }}>{average.label}</p>
                    <p className="stat-value" style={{ fontSize: 20 }}>{average.value}</p>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 14 }}>
                <p className="stat-label" style={{ letterSpacing: '0.2em' }}>Daily signals</p>
                <div className="card-plain" style={{ border: '1px solid #e5e7eb', background: '#fdfdfd', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {summary.timeline.map((point) => (
                    <div key={point.date} className="card-plain" style={{ background: '#eef2ff', border: '1px solid #e0e7ff', minWidth: 110, padding: '10px 12px' }}>
                      <p style={{ margin: 0, fontWeight: 700 }}>{point.total}</p>
                      <p className="stat-context" style={{ margin: 0 }}>{point.date}</p>
                    </div>
                  ))}
                </div>
              </div>

              {summary.latestMetrics && (
                <div style={{ marginTop: 14 }}>
                  <p className="stat-label" style={{ letterSpacing: '0.2em' }}>Latest metric snapshot</p>
                  <div className="dash-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
                    {summary.latestMetrics.map((metric) => (
                      <div key={metric.label} className="card-plain" style={{ background: '#f8fafc' }}>
                        <p className="stat-label" style={{ marginBottom: 4 }}>{metric.label}</p>
                        <p className="stat-value" style={{ fontSize: 20 }}>{metric.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {summary.signalLabels && summary.signalLabels.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <p className="stat-label" style={{ letterSpacing: '0.2em' }}>Signals tracked</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {summary.signalLabels.map((label) => (
                      <span key={label} className="badge-soft">{label}</span>
                    ))}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>

        <section className="card-plain" style={{ borderRadius: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <p className="stat-label" style={{ letterSpacing: '0.2em' }}>AI concierge</p>
              <h2 style={{ margin: '6px 0 4px' }}>Context usage across mobility &amp; wellness</h2>
              <p className="stat-context" style={{ margin: 0 }}>Derived from live interaction telemetry.</p>
            </div>
          </div>
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="table-lite" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th scope="col">Context</th>
                  <th scope="col">Events</th>
                  <th scope="col">Unique members</th>
                  <th scope="col">Avg duration (s)</th>
                  <th scope="col">History reuse</th>
                  <th scope="col">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {aiContexts.map((context) => (
                  <tr key={context.context}>
                    <td>
                      <strong>{context.context.replace(/-/g, ' ')}</strong>
                      <p className="stat-context" style={{ margin: 0 }}>{context.context}</p>
                    </td>
                    <td>{context.total.toLocaleString()}</td>
                    <td>{context.uniqueUsers.toLocaleString()}</td>
                    <td>{context.avgDuration.toLocaleString()}</td>
                    <td>{context.historyRate}</td>
                    <td>{context.lastSeen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
