import React from 'react';
import '../dashboard/shared-dashboard.css';

const stats = [
  { label: 'Universities', value: '42' },
  { label: 'Scholarships', value: '$2.4M' },
  { label: 'Courses', value: '1,250+' },
];

const quickActions = [
  'Search Courses',
  'Deadlines',
  'Applications',
  'News',
];

const featured = [
  { title: 'Global Tech University', tag: 'Top Rated', emoji: '🏛️', desc: 'Leading AI and Robotics research.' },
  { title: 'Institute of Design', tag: 'Creative', emoji: '🎨', desc: 'Digital arts program bridging tech and creativity.' },
];

const trades = [
  { title: 'Construction', color: '#fed7aa', text: '#c2410c', desc: 'High demand for skilled builders.' },
  { title: 'Electrical', color: '#bfdbfe', text: '#1d4ed8', desc: 'Power the future with specialized training.' },
  { title: 'Plumbing', color: '#bbf7d0', text: '#15803d', desc: 'Essential services with great stability.' },
];

export default function EducationPage() {
  return (
    <main
      className="dash-shell"
      aria-label="Learning discovery"
      style={{
        background:
          'radial-gradient(circle at 16% 12%, rgba(233,30,140,0.08), transparent 30%), radial-gradient(circle at 84% 10%, rgba(139,92,246,0.08), transparent 28%), var(--background)',
      }}
    >
      <div className="dash-container" style={{ display: 'grid', gap: 24 }}>

        <header style={{ textAlign: 'center', position: 'relative', padding: '20px 0 10px' }}>
          <span className="pill" style={{ background: 'rgba(233,30,140,0.12)', color: '#9d174d', border: '1px solid var(--border)' }}>Education & Pathways</span>
          <h1 style={{ margin: '12px 0 10px', fontSize: 40, color: '#9d174d' }}>Discover Your Future</h1>
          <p className="stat-context" style={{ color: '#7f1d4e', maxWidth: 720, margin: '0 auto' }}>
            Explore curated opportunities across universities, trades, and apprenticeships designed to accelerate your career.
          </p>
        </header>

        <section className="dash-grid" style={{ gridTemplateColumns: '1fr 1.8fr', alignItems: 'start' }}>
          <div className="card-plain" style={{ borderRadius: 24, border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}>
            <h3 style={{ margin: '0 0 12px', color: '#9d174d' }}>Academic Overview</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="card-plain"
                  style={{ background: 'rgba(233,30,140,0.08)', color: '#9d174d', border: '1px solid var(--border)', boxShadow: '0 12px 28px -24px rgba(233,30,140,0.3)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700 }}>{stat.label}</span>
                    <span style={{ fontSize: 22, fontWeight: 800 }}>{stat.value}</span>
                  </div>
                </div>
              ))}
            </div>
            <div
              className="card-plain"
              style={{
                background: 'linear-gradient(135deg,#e91e8c,#8b5cf6)',
                color: '#fff',
                marginTop: 14,
                boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)',
              }}
            >
              <h4 style={{ margin: '0 0 6px' }}>Need Guidance?</h4>
              <p style={{ margin: 0 }}>Book a session with a university career counselor today.</p>
              <button className="btn-primary-gradient" style={{ marginTop: 10, background: '#fff', color: '#9d174d' }}>Find a Mentor</button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
            <section>
              <h2 style={{ margin: '0 0 10px', color: '#9d174d' }}>Featured Universities</h2>
              <div className="dash-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
                {featured.map((uni) => (
                  <div
                    key={uni.title}
                    className="card-plain"
                    style={{ border: '1px solid var(--border)', position: 'relative', overflow: 'hidden', background: 'var(--card)', boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(233,30,140,0.08)', display: 'grid', placeItems: 'center', fontSize: 20 }}>{uni.emoji}</div>
                      <span className="pill" style={{ background: 'rgba(139,92,246,0.12)', color: '#6d28d9', border: '1px solid var(--border)' }}>{uni.tag}</span>
                    </div>
                    <h3 style={{ margin: '0 0 6px', color: '#9d174d' }}>{uni.title}</h3>
                    <p className="stat-context" style={{ color: '#475569' }}>{uni.desc}</p>
                    <button className="btn-ghost" style={{ marginTop: 8, color: 'var(--accent)' }}>View Courses →</button>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 style={{ margin: '0 0 10px', color: '#9d174d' }}>Quick Actions</h2>
              <div className="dash-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
                {quickActions.map((action) => (
                  <button
                    key={action}
                    className="card-plain"
                    style={{ border: '1px solid var(--border)', textAlign: 'center', fontWeight: 700, background: 'var(--card)', boxShadow: '0 12px 28px -24px rgba(233,30,140,0.3)' }}
                  >
                    {action}
                  </button>
                ))}
              </div>
            </section>

            <section className="card-plain" style={{ textAlign: 'center', background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(233,30,140,0.08)', display: 'grid', placeItems: 'center', margin: '0 auto 12px', fontSize: 32 }}>🛠️</div>
              <h2 style={{ margin: '0 0 8px', color: '#9d174d' }}>Master a Trade</h2>
              <p className="stat-context" style={{ color: '#475569', maxWidth: 520, margin: '0 auto 12px' }}>
                Connect with industry leaders and find hands-on training programs. From carpentry to electrical engineering, build your future with practical skills.
              </p>
              <div className="dash-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginTop: 10 }}>
                {trades.map((trade) => (
                  <div
                    key={trade.title}
                    className="card-plain"
                    style={{
                      background: 'rgba(233,30,140,0.08)',
                      color: '#9d174d',
                      border: '1px solid var(--border)',
                      boxShadow: '0 12px 28px -24px rgba(233,30,140,0.3)',
                    }}
                  >
                    <h3 style={{ margin: '0 0 4px' }}>{trade.title}</h3>
                    <p className="stat-context" style={{ margin: 0, color: '#9d174d' }}>{trade.desc}</p>
                  </div>
                ))}
              </div>
              <button className="btn-primary-gradient" style={{ marginTop: 12 }}>Explore TAFE Dashboard</button>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
