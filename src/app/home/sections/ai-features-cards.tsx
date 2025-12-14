import React from 'react';

export default function AiFeaturesCards() {
  return (
    <section className="aura-recruitment">
      <div className="aura-container">
        <div className="aura-recruitment__intro">
          <span className="aura-recruitment__eyebrow">AI talent operating system</span>
          <h2>Experience the Future of Recruitment</h2>
          <p>Our intelligent AI system revolutionizes how you find opportunities, build your career, and achieve your dreams.</p>
          <div className="aura-recruitment__metrics">
            <div>
              <strong>4 journeys</strong>
              <span>Jobs, apprenticeships, resumes, insights</span>
            </div>
            <div>
              <strong>95% match score</strong>
              <span>Validated against member outcomes</span>
            </div>
            <div>
              <strong>Live refresh</strong>
              <span>Signals update every 15 minutes</span>
            </div>
          </div>
        </div>
        <div className="aura-recruitment__grid">
          <article className="aura-recruitment-card">
            <div className="aura-recruitment-card__icon">
              <i className="fas fa-brain" aria-hidden="true"></i>
            </div>
            <div className="aura-recruitment-card__body">
              <div className="aura-recruitment-card__badge">Smart Job Matching</div>
              <h3>Match-ready shortlists</h3>
              <p>AI recommends perfect job fits based on your profile, skills, experience, and career preferences. Get personalized match scores for every opportunity.</p>
              <ul>
                <li>95% match accuracy</li>
                <li>Real-time updates</li>
              </ul>
            </div>
            <a href="/member/job-recommendations" className="aura-recruitment-card__cta">
              Explore matches
              <i className="fas fa-arrow-right" aria-hidden="true"></i>
            </a>
          </article>
          <article className="aura-recruitment-card">
            <div className="aura-recruitment-card__icon">
              <i className="fas fa-graduation-cap" aria-hidden="true"></i>
            </div>
            <div className="aura-recruitment-card__body">
              <div className="aura-recruitment-card__badge">Apprenticeship Discovery</div>
              <h3>Structured career starts</h3>
              <p>Find entry-level apprenticeships and trainee programs perfectly tailored to your goals. Start your career journey with structured learning.</p>
              <ul>
                <li>Certified programs</li>
                <li>Career development playbooks</li>
              </ul>
            </div>
            <a href="/apprenticeships" className="aura-recruitment-card__cta">
              See apprenticeships
              <i className="fas fa-arrow-right" aria-hidden="true"></i>
            </a>
          </article>
          {/* Add more cards as needed */}
        </div>
      </div>
    </section>
  );
}
