import React from 'react';

export default function PillarBand() {
  return (
    <section className="pillar-band">
      <div className="pillar-band__container">
        <div className="pillar-band__intro">
          <span className="pillar-band__eyebrow">Why Aura?</span>
          <h2>Our Pillars of Success</h2>
          <p>We combine technology, expertise, and a human touch to deliver unmatched results for candidates and employers alike.</p>
        </div>
        <div className="pillar-band__grid">
          <div className="pillar-band__item">
            <div className="pillar-band__icon">
              <i className="fas fa-robot" aria-hidden="true"></i>
            </div>
            <h3>AI-Driven Insights</h3>
            <p>Harness the power of artificial intelligence to make smarter career and hiring decisions.</p>
          </div>
          <div className="pillar-band__item">
            <div className="pillar-band__icon">
              <i className="fas fa-users" aria-hidden="true"></i>
            </div>
            <h3>Personalized Support</h3>
            <p>Our team is here to guide you at every step, ensuring a smooth and successful journey.</p>
          </div>
          <div className="pillar-band__item">
            <div className="pillar-band__icon">
              <i className="fas fa-chart-line" aria-hidden="true"></i>
            </div>
            <h3>Proven Outcomes</h3>
            <p>Thousands have found their dream roles and built lasting careers with Aura’s help.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
