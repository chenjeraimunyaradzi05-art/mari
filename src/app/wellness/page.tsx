import React from 'react';
import '../dashboard/shared-dashboard.css';

const playlists = [
  { title: 'Calm before interviews', focus: 'Breathwork', summary: 'Short rituals to center before calls', badges: ['5 min', 'Audio'] },
  { title: 'Money calm', focus: 'Finance', summary: 'Scripts for tough debt calls', badges: ['Script', 'Confidence'] },
  { title: 'Care work recovery', focus: 'Rest', summary: 'Micro-breaks to reduce fatigue', badges: ['Micro', 'Body'] },
];

const tracks = [
  { title: 'Budget reset', description: 'Rebuild your budget with compassionate steps', cta: 'Open module' },
  { title: 'Debt triage', description: 'Prioritize payments with less stress', cta: 'Open module' },
];

const signals = [
  { label: 'Sleep score', value: '82', description: 'Last 7d' },
  { label: 'Stress trend', value: 'Low', description: 'AI-calculated' },
  { label: 'Hydration', value: 'Good', description: '3 bottles/day' },
];

const rituals = [
  { title: 'Box breathing', length: '5 min', description: 'Guided breath with pace cues', views: 2480, likes: 180 },
  { title: 'Evening unwind', length: '8 min', description: 'Light stretching to close the day', views: 1820, likes: 140 },
  { title: 'Money body scan', length: '6 min', description: 'Notice tension before budgeting', views: 940, likes: 92 },
];

const stories = [
  { title: 'How I survived layoffs', excerpt: 'Calm scripts and community safety nets', url: '#' },
  { title: 'Resetting after burnout', excerpt: 'Micro-rituals that kept me steady', url: '#' },
];

export default function WellnessPage() {
  return (
    <main
      className="dash-shell"
      aria-label="Wellness hub"
      style={{
        background:
          'radial-gradient(circle at 16% 12%, rgba(233,30,140,0.08), transparent 32%), radial-gradient(circle at 82% 8%, rgba(139,92,246,0.08), transparent 28%), var(--background)',
      }}
    >
      <div className="dash-container" style={{ display: 'grid', gap: 18 }}>
        <section
          className="search-hero"
          style={{
            background: 'linear-gradient(135deg,#e91e8c,#8b5cf6)',
            boxShadow: '0 22px 44px -30px rgba(233,30,140,0.55)',
          }}
        >
          <h1 style={{ margin: '0 0 8px' }}>Care rituals, AI guidance, and money calm</h1>
          <p style={{ color: 'rgba(226,232,240,0.85)', maxWidth: 720 }}>
            Trade breathwork, trauma-aware scripts, and financial education in one women-first lane.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            <button className="btn-primary-gradient">Partner handoffs</button>
            <button className="btn-ghost" style={{ color: 'var(--foreground)', borderColor: 'rgba(255,255,255,0.5)' }}>Guides & stories</button>
            <button className="btn-ghost" style={{ color: 'var(--foreground)', borderColor: 'rgba(255,255,255,0.5)' }}>Member dashboard</button>
          </div>
        </section>

        <section
          className="card-plain"
          style={{
            borderRadius: 24,
            border: '1px solid var(--border)',
            background: 'var(--card)',
            boxShadow: '0 22px 44px -32px rgba(233,30,140,0.4)',
          }}
        >
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1.2fr 0.9fr' }}>
            <div style={{ display: 'grid', gap: 14 }}>
              <div
                className="card-plain"
                style={{
                  background: 'rgba(233,30,140,0.06)',
                  borderColor: 'var(--border)',
                  boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <h3 style={{ margin: 0, color: '#9d174d' }}>Your AI Wellness Plan</h3>
                  <span className="badge-soft" style={{ background: 'rgba(233,30,140,0.12)', color: '#9d174d' }}>Personalized</span>
                </div>
                <p className="stat-context" style={{ color: '#9d174d' }}>Daily summary and focus areas tuned to your goals.</p>
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
                  <div>
                    <p className="stat-label" style={{ color: '#9d174d' }}>Focus Areas</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span className="badge-soft" style={{ background: '#fff', color: '#9d174d', border: '1px solid var(--border)' }}>Breath</span>
                      <span className="badge-soft" style={{ background: '#fff', color: '#9d174d', border: '1px solid var(--border)' }}>Sleep</span>
                      <span className="badge-soft" style={{ background: '#fff', color: '#9d174d', border: '1px solid var(--border)' }}>Finance</span>
                    </div>
                  </div>
                  <div>
                    <p className="stat-label" style={{ color: '#9d174d' }}>Weekly Schedule</p>
                    <ul style={{ padding: 0, margin: 0, listStyle: 'none', color: '#9d174d' }}>
                      <li>Mon: Breath reset</li>
                      <li>Wed: Money calm</li>
                      <li>Fri: Stretch + reflect</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <p className="stat-label" style={{ letterSpacing: '0.2em', textTransform: 'uppercase', color: '#475569' }}>AI-guided journeys</p>
                <h2 style={{ margin: '6px 0 10px' }}>Concierge playlists that talk to Money Inbox</h2>
                <div className="dash-grid">
                  {playlists.map((playlist) => (
                    <div
                      key={playlist.title}
                      className="card-plain"
                      style={{ border: '1px solid var(--border)', background: 'rgba(255,255,255,0.88)', boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}
                    >
                      <p className="stat-label" style={{ color: '#9d174d' }}>{playlist.focus}</p>
                      <h3 style={{ margin: '6px 0', color: '#0f172a' }}>{playlist.title}</h3>
                      <p className="stat-context" style={{ color: '#475569' }}>{playlist.summary}</p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {playlist.badges.map((badge) => (
                          <span key={badge} className="badge-soft" style={{ background: 'rgba(233,30,140,0.12)', color: '#9d174d' }}>{badge}</span>
                        ))}
                      </div>
                      <button className="btn-ghost" style={{ marginTop: 10, color: 'var(--accent)' }}>Open AI coach</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <p className="stat-label" style={{ letterSpacing: '0.2em', textTransform: 'uppercase', color: '#475569' }}>Financial education desk</p>
                <h3 style={{ margin: '6px 0 10px' }}>Budget, debt, and relief tools tuned for care work</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
                  {tracks.map((track) => (
                    <li
                      key={track.title}
                      className="card-plain"
                      style={{ padding: 14, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.9)', boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}
                    >
                      <p style={{ margin: '0 0 4px', fontWeight: 700 }}>{track.title}</p>
                      <p className="stat-context" style={{ margin: 0, color: '#475569' }}>{track.description}</p>
                      <button className="btn-ghost" style={{ marginTop: 8, color: 'var(--accent)' }}>{track.cta}</button>
                    </li>
                  ))}
                </ul>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                  {signals.map((signal) => (
                    <div
                      key={signal.label}
                      className="card-plain"
                      style={{ border: '1px solid var(--border)', minWidth: 140, background: 'rgba(255,255,255,0.9)' }}
                    >
                      <p className="stat-label" style={{ marginBottom: 4 }}>{signal.label}</p>
                      <p className="stat-value" style={{ fontSize: 20 }}>{signal.value}</p>
                      <p className="stat-context" style={{ margin: 0 }}>{signal.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card-plain" style={{ borderRadius: 20, border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}>
                <h2 style={{ margin: '0 0 8px' }}>Ritual library</h2>
                <div className="dash-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
                  {rituals.map((ritual) => (
                    <div
                      key={ritual.title}
                      className="card-plain"
                      style={{ border: '1px solid var(--border)', background: 'rgba(255,255,255,0.9)' }}
                    >
                      <span className="stat-context" style={{ textTransform: 'uppercase' }}>{ritual.length}</span>
                      <h3 style={{ margin: '4px 0' }}>{ritual.title}</h3>
                      <p className="stat-context" style={{ margin: 0, flexGrow: 1 }}>{ritual.description}</p>
                      <div style={{ display: 'flex', gap: 12, marginTop: 10, color: '#475569', fontSize: 13 }}>
                        <span><i className="fas fa-eye" aria-hidden="true" /> {ritual.views.toLocaleString()} views</span>
                        <span><i className="fas fa-heart" aria-hidden="true" /> {ritual.likes.toLocaleString()} likes</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card-plain" style={{ borderRadius: 18, border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}>
                <h2 style={{ margin: '0 0 8px' }}>Stories & prompts</h2>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
                  {stories.map((story) => (
                    <li
                      key={story.title}
                      className="card-plain"
                      style={{ border: '1px solid var(--border)', background: 'rgba(255,255,255,0.9)' }}
                    >
                      <h3 style={{ margin: '0 0 4px' }}>{story.title}</h3>
                      <p className="stat-context" style={{ margin: 0 }}>{story.excerpt}</p>
                      <button className="btn-ghost" style={{ marginTop: 8 }}>Read the drop →</button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
