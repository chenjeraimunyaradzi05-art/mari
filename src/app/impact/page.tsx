import '../dashboard/shared-dashboard.css';

type ImpactMetric = { label: string; description: string; value: number; unit: string; change: number };

async function fetchImpact(): Promise<{ metrics: ImpactMetric[]; lastUpdated: string; reportUrl: string }> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/api/impact`, {
    cache: 'no-store',
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Failed to load impact metrics (${res.status})`);
  return res.json();
}

export default async function ImpactPage() {
  const { metrics, lastUpdated, reportUrl } = await fetchImpact();
  const formattedDate = lastUpdated ? new Date(lastUpdated).toLocaleString() : '—';

  return (
    <main
      className="dash-shell"
      aria-label="Impact index"
      style={{
        background:
          'radial-gradient(circle at 16% 12%, rgba(233,30,140,0.08), transparent 30%), radial-gradient(circle at 84% 10%, rgba(139,92,246,0.08), transparent 28%), var(--background)',
      }}
    >
      <div className="dash-container" style={{ display: 'grid', gap: 20 }}>
        <header style={{ textAlign: 'center', marginBottom: 10 }}>
          <p className="stat-label" style={{ color: '#9d174d', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Transparency</p>
          <h1 style={{ margin: '6px 0 10px', fontSize: 34, color: '#0f172a' }}>Athena Impact Index</h1>
          <p className="stat-context" style={{ color: '#475569', maxWidth: 620, margin: '0 auto' }}>
            Real-time metrics on how we are empowering women, securing jobs, and building financial resilience.
          </p>
        </header>

        <section className="dash-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
          {metrics.map((metric) => (
            <article
              key={metric.label}
              className="card-plain"
              style={{ borderRadius: 16, border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}
            >
              <div className="pill" style={{ background: 'rgba(233,30,140,0.12)', color: '#9d174d', width: 'fit-content', border: '1px solid var(--border)' }}>
                <i className="fas fa-chart-bar" aria-hidden="true" />
              </div>
              <h3 style={{ margin: '10px 0 6px', color: '#0f172a' }}>{metric.label}</h3>
              <p className="stat-context" style={{ color: '#475569', margin: '0 0 10px' }}>{metric.description}</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="stat-value" style={{ fontSize: 30 }}>{metric.value.toLocaleString()} {metric.unit}</span>
                {typeof metric.change === 'number' ? (
                  <span style={{ color: metric.change > 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                    {metric.change > 0 ? '+' : ''}{metric.change}%
                  </span>
                ) : null}
              </div>
            </article>
          ))}
        </section>

        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <p className="stat-context" style={{ color: '#94a3b8' }}>Last updated: {formattedDate}</p>
          <a className="btn-primary-gradient" style={{ marginTop: 10, display: 'inline-flex' }} href={reportUrl}>
            Download Full Report (PDF)
          </a>
        </div>
      </div>
    </main>
  );
}
