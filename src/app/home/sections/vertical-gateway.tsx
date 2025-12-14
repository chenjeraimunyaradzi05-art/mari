import React from 'react';

export default function VerticalGateway() {
  return (
    <section className="vertical-gateway">
      <div className="vertical-gateway__container">
        <div className="vertical-gateway__intro">
          <span className="vertical-gateway__eyebrow">Explore by vertical</span>
          <h2>Industry Gateways</h2>
          <p>Discover tailored opportunities and resources for your chosen field. Aura’s vertical gateways connect you to the best jobs, apprenticeships, and insights in every sector.</p>
        </div>
        <div className="vertical-gateway__grid">
          <a href="/vertical/technology" className="vertical-gateway__card">
            <div className="vertical-gateway__icon">
              <i className="fas fa-laptop-code" aria-hidden="true"></i>
            </div>
            <h3>Technology</h3>
            <p>Software, IT, Data Science, and more</p>
          </a>
          <a href="/vertical/healthcare" className="vertical-gateway__card">
            <div className="vertical-gateway__icon">
              <i className="fas fa-heartbeat" aria-hidden="true"></i>
            </div>
            <h3>Healthcare</h3>
            <p>Nursing, Allied Health, Medical Research</p>
          </a>
          <a href="/vertical/finance" className="vertical-gateway__card">
            <div className="vertical-gateway__icon">
              <i className="fas fa-chart-pie" aria-hidden="true"></i>
            </div>
            <h3>Finance</h3>
            <p>Banking, Accounting, Financial Analysis</p>
          </a>
          {/* Add more verticals as needed */}
        </div>
      </div>
    </section>
  );
}
