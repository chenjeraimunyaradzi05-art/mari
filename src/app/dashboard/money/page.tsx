import React from 'react';
import '../shared-dashboard.css';

const offers = [
  { code: 'BND-4821', status: 'Active', savings: '$1,240/yr', created: '2d ago' },
  { code: 'BND-3794', status: 'Draft', savings: '$820/yr', created: '5d ago' },
];

export default function MoneyConciergePage() {
  return (
    <main
      className="dash-shell"
      aria-label="Expense concierge"
      style={{
        background:
          'radial-gradient(circle at 16% 12%, rgba(233,30,140,0.08), transparent 30%), radial-gradient(circle at 84% 10%, rgba(139,92,246,0.08), transparent 28%), var(--background)',
      }}
    >
      <div className="dash-container" style={{ display: 'grid', gap: 20 }}>
        <header
          className="search-hero"
          style={{
            background: 'linear-gradient(135deg,#e91e8c,#8b5cf6)',
            boxShadow: '0 22px 44px -30px rgba(233,30,140,0.55)',
          }}
        >
          <p className="stat-label" style={{ color: 'rgba(255,255,255,0.75)' }}>Expense Concierge</p>
          <h1 style={{ margin: '6px 0 10px' }}>Bundle your bills, unlock savings, boost resilience.</h1>
          <p style={{ color: 'rgba(255,255,255,0.85)', maxWidth: 680 }}>
            Start a new analysis to consolidate expenses and surface savings. Bundle codes mirror the template UI.
          </p>
          <div style={{ marginTop: 12 }}>
            <button className="btn-primary-gradient">Start New Analysis</button>
          </div>
        </header>

        {offers.length > 0 ? (
          <section className="card-plain" style={{ padding: 0, border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {offers.map((offer) => (
                <li key={offer.code} style={{ borderBottom: '1px solid var(--border)' }}>
                  <a className="card-plain" style={{ display: 'block', border: 'none', borderRadius: 0, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <p style={{ margin: 0, color: 'var(--accent)', fontWeight: 700 }}>Bundle #{offer.code}</p>
                      <span className="badge-soft" style={{ background: offer.status === 'Active' ? 'rgba(233,30,140,0.12)' : 'rgba(148,163,184,0.2)', color: offer.status === 'Active' ? '#9d174d' : '#334155' }}>{offer.status}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
                      <p className="stat-context" style={{ margin: 0 }}>Projected Savings: {offer.savings}</p>
                      <p className="stat-context" style={{ margin: 0 }}>Created {offer.created}</p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="card-plain" style={{ textAlign: 'center', padding: 28, border: '1px solid var(--border)', background: 'var(--card)', boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}>
            <p style={{ fontWeight: 700, marginBottom: 6 }}>No analyses yet</p>
            <p className="stat-context" style={{ margin: 0 }}>Get started by creating a new expense analysis.</p>
          </section>
        )}
      </div>
    </main>
  );
}
