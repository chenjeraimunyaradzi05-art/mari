import React from 'react';
import '../dashboard/shared-dashboard.css';

const hero = {
  title: 'Partner with Athena',
  copy: 'Women-first journeys, transparent telemetry, and privacy-safe lead flows. Bring your org to our community.',
  ctas: ['Book intro', 'View case studies'],
};

const highlights = [
  { title: 'Lead form tracking', desc: 'Analytics-ready forms with recaptcha and multi-destination webhooks.' },
  { title: 'Video hero', desc: 'HLS-ready embeds with graceful fallbacks.' },
  { title: 'Persona meta', desc: 'Dynamic persona meta to tune landing tone and CTAs.' },
];

const leadTypes = ['Partnership', 'Sponsorship', 'Hiring', 'Learning'];

export default function OrgPagesLanding() {
  return (
    <main className="dash-shell" aria-label="Organization landing">
      <div className="dash-container" style={{ display: 'grid', gap: 20 }}>
        <section className="search-hero" style={{ background: 'linear-gradient(135deg,#0f172a,#1f2937)' }}>
          <h1 style={{ margin: '0 0 10px' }}>{hero.title}</h1>
          <p style={{ color: 'rgba(226,232,240,0.85)', maxWidth: 720 }}>{hero.copy}</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            {hero.ctas.map((cta) => (
              <button key={cta} className="btn-primary-gradient">{cta}</button>
            ))}
          </div>
        </section>

        <section className="dash-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
          {highlights.map((item) => (
            <article key={item.title} className="card-plain" style={{ border: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: '0 0 6px' }}>{item.title}</h3>
              <p className="stat-context" style={{ margin: 0 }}>{item.desc}</p>
            </article>
          ))}
        </section>

        <section className="card-plain" style={{ borderRadius: 18 }}>
          <h2 style={{ margin: '0 0 12px' }}>Book a call</h2>
          <p className="stat-context" style={{ margin: '0 0 12px' }}>Pick your lead type and share a quick note.</p>
          <form className="search-form" style={{ gap: 12 }}>
            <div>
              <label className="stat-label" htmlFor="lead-type">Lead type</label>
              <select id="lead-type" className="select">
                {leadTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="stat-label" htmlFor="lead-notes">Notes</label>
              <textarea id="lead-notes" className="textarea" rows={4} placeholder="Tell us about your org and goals." />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="reset" className="btn-ghost">Reset</button>
              <button type="button" className="btn-primary-gradient">Submit</button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
