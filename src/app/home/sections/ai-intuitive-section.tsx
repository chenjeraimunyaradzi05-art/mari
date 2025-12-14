import React from 'react';

export default function AiIntuitiveSection() {
  return (
    <section className="section-box mt-80 ai-intuitive-section">
      <div className="container">
        <div className="text-center mb-50">
          <span className="badge bg-gradient-primary text-white mb-20">🤖 AI-Powered Platform</span>
          <h2 className="heading-title mb-20">
            Intelligent Hiring Meets <span className="color-brand-2">Career Development</span>
          </h2>
          <p className="text-lg neutral-500 mx-auto" style={{ maxWidth: 700 }}>
            Our AI doesn&apos;t just match jobs—it guides careers, suggests apprenticeships, and predicts success.
          </p>
        </div>
        <div className="row align-items-center mb-60">
          <div className="col-lg-6 col-md-12 mb-30">
            <div className="ai-content">
              <h3 className="mb-20">Real-Time AI Insights</h3>
              <p className="text-md neutral-500 mb-30">
                Experience the future of recruitment with our intelligent matching system. Our AI analyzes skills, experience, cultural fit, and even suggests apprenticeships for career development.
              </p>
              <div className="ai-features">
                <div className="feature-item mb-20">
                  <div className="feature-icon"><i className="fi-rr-magic-wand"></i></div>
                  <div className="feature-text">
                    <h6 className="mb-5">Smart Job Matching</h6>
                    <p className="text-sm text-muted">AI recommends perfect job fits based on your profile and preferences</p>
                  </div>
                </div>
                <div className="feature-item mb-20">
                  <div className="feature-icon"><i className="fi-rr-graduation-cap"></i></div>
                  <div className="feature-text">
                    <h6 className="mb-5">Apprenticeship Discovery</h6>
                    <p className="text-sm text-muted">Find entry-level apprenticeships and trainee programs tailored to your goals</p>
                  </div>
                </div>
                <div className="feature-item mb-20">
                  <div className="feature-icon"><i className="fi-rr-document"></i></div>
                  <div className="feature-text">
                    <h6 className="mb-5">Intelligent Resume Parsing</h6>
                    <p className="text-sm text-muted">Automatically extracts skills and experience from your resume</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-6 col-md-12 mb-30">
            {/* TODO: Add illustration or image */}
          </div>
        </div>
      </div>
    </section>
  );
}
