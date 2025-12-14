import React from 'react';

export default function ReviewSection() {
  return (
    <section className="review-section">
      <div className="review-section__container">
        <div className="review-section__intro">
          <span className="review-section__eyebrow">What our members say</span>
          <h2>Success Stories</h2>
          <p>Real feedback from candidates and employers who have transformed their journeys with Aura.</p>
        </div>
        <div className="review-section__grid">
          <blockquote className="review-section__card">
            <p>“Aura’s AI matched me to my dream job in days. The process was seamless and the support was incredible!”</p>
            <footer>
              <span className="review-section__author">Sarah M.</span>
              <span className="review-section__role">Marketing Graduate</span>
            </footer>
          </blockquote>
          <blockquote className="review-section__card">
            <p>“We hired three amazing apprentices through Aura. The platform’s insights and recommendations are spot on.”</p>
            <footer>
              <span className="review-section__author">James T.</span>
              <span className="review-section__role">HR Manager</span>
            </footer>
          </blockquote>
          {/* Add more testimonials as needed */}
        </div>
      </div>
    </section>
  );
}
