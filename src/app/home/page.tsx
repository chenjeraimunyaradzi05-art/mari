
import React from 'react';
import PillarBand from './sections/pillar-band';
import AiIntuitiveSection from './sections/ai-intuitive-section';
import AiFeaturesCards from './sections/ai-features-cards';
import ReviewSection from './sections/review-section';
import VerticalGateway from './sections/vertical-gateway';

export default function HomePage() {
  return (
    <main
      style={{
        background:
          'radial-gradient(circle at 16% 12%, rgba(233,30,140,0.08), transparent 30%), radial-gradient(circle at 84% 10%, rgba(139,92,246,0.08), transparent 28%), var(--background)',
      }}
    >
      {/* Hero Section (Sponsor) */}
      <section
        className="section-box sponsor-hero mt-60 mb-60"
        style={{
          background: 'linear-gradient(135deg,#e91e8c,#8b5cf6)',
          borderRadius: 24,
          boxShadow: '0 22px 44px -30px rgba(233,30,140,0.55)',
        }}
      >
        <div className="container">
          <div className="row align-items-center g-5">
            <div className="col-lg-6">
              <span className="sponsor-hero__badge" style={{ background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.28)' }}>Ethical sponsors fuel Athena</span>
              <h1 className="mt-20 mb-20" style={{ color: '#fff' }}>Dynamic placements keep community tools free</h1>
              <p className="font-lg color-text-paragraph-2 mb-30" style={{ color: 'rgba(255,255,255,0.85)' }}>
                Every carousel below is powered by live sponsor data. Banking allies, telcos, universities and wellbeing
                partners rotate through verified slots so members see helpful offers while Athena funds new features.
              </p>
              <div className="d-flex flex-wrap gap-3">
                <a href="/pricing" className="btn btn-default btn-shadow" style={{ background: '#fff', color: '#9d174d', borderColor: 'transparent' }}>Partner with Athena</a>
                <a href="/business/network" className="btn btn-border" style={{ borderColor: 'rgba(255,255,255,0.5)', color: '#fff' }}>View media kit</a>
              </div>
            </div>
            <div className="col-lg-6">
            </div>
          </div>
        </div>
      </section>

      {/* Pillar Band Section */}
      <PillarBand />

      {/* AI Intuitive Section */}
      <AiIntuitiveSection />

      {/* AI Features Cards Section */}
      <AiFeaturesCards />

      {/* Review/Testimonials Section */}
      <ReviewSection />

      {/* Vertical Gateway Section */}
      <VerticalGateway />
    </main>
  );
}
