@php
    $featureGridAds = $homepageSponsorSlots['feature-grid'] ?? [];
@endphp

{{-- AI Features Interactive Cards Component --}}
<section class="aura-recruitment">
    <div class="aura-container">
        <div class="aura-recruitment__intro">
            <span class="aura-recruitment__eyebrow">AI talent operating system</span>
            <h2>Experience the Future of Recruitment</h2>
            <p>Our intelligent AI system revolutionizes how you find opportunities, build your career, and achieve your dreams.</p>
            <div class="aura-recruitment__metrics">
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

        <div class="aura-recruitment__grid">
            <article class="aura-recruitment-card">
                <div class="aura-recruitment-card__icon">
                    <i class="fas fa-brain" aria-hidden="true"></i>
                </div>
                <div class="aura-recruitment-card__body">
                    <div class="aura-recruitment-card__badge">Smart Job Matching</div>
                    <h3>Match-ready shortlists</h3>
                    <p>AI recommends perfect job fits based on your profile, skills, experience, and career preferences. Get personalized match scores for every opportunity.</p>
                    <ul>
                        <li>95% match accuracy</li>
                        <li>Real-time updates</li>
                    </ul>
                </div>
                <a href="{{ route('member.job-recommendations') }}" class="aura-recruitment-card__cta">
                    Explore matches
                    <i class="fas fa-arrow-right" aria-hidden="true"></i>
                </a>
            </article>

            <article class="aura-recruitment-card">
                <div class="aura-recruitment-card__icon">
                    <i class="fas fa-graduation-cap" aria-hidden="true"></i>
                </div>
                <div class="aura-recruitment-card__body">
                    <div class="aura-recruitment-card__badge">Apprenticeship Discovery</div>
                    <h3>Structured career starts</h3>
                    <p>Find entry-level apprenticeships and trainee programs perfectly tailored to your goals. Start your career journey with structured learning.</p>
                    <ul>
                        <li>Certified programs</li>
                        <li>Career development playbooks</li>
                    </ul>
                </div>
                <a href="{{ route('jobs.index', ['apprenticeship' => 1]) }}" class="aura-recruitment-card__cta">
                    Discover programs
                    <i class="fas fa-arrow-right" aria-hidden="true"></i>
                </a>
            </article>

            <article class="aura-recruitment-card">
                <div class="aura-recruitment-card__icon">
                    <i class="fas fa-file-import" aria-hidden="true"></i>
                </div>
                <div class="aura-recruitment-card__body">
                    <div class="aura-recruitment-card__badge">Intelligent Resume Parsing</div>
                    <h3>Instant profile builds</h3>
                    <p>Automatically extracts skills, experience, education, and qualifications from your resume. Save time with AI-powered profile building.</p>
                    <ul>
                        <li>Instant processing</li>
                        <li>99% accuracy</li>
                    </ul>
                </div>
                <a href="{{ route('member.resume-parser.index') }}" class="aura-recruitment-card__cta">
                    Upload resume
                    <i class="fas fa-arrow-right" aria-hidden="true"></i>
                </a>
            </article>

            <article class="aura-recruitment-card">
                <div class="aura-recruitment-card__icon">
                    <i class="fas fa-chart-line" aria-hidden="true"></i>
                </div>
                <div class="aura-recruitment-card__body">
                    <div class="aura-recruitment-card__badge">Career Path Insights</div>
                    <h3>Data-guided growth</h3>
                    <p>Get AI-powered predictions on your career growth, salary expectations, and development opportunities. Plan your future with data-driven insights.</p>
                    <ul>
                        <li>Growth predictions</li>
                        <li>Career roadmap</li>
                    </ul>
                </div>
                <a href="{{ route('member.career-insights.index') }}" class="aura-recruitment-card__cta">
                    View insights
                    <i class="fas fa-arrow-right" aria-hidden="true"></i>
                </a>
            </article>
        </div>

        @if (!empty($featureGridAds))
            <div class="aura-recruitment__ads">
                <x-ad-slot :ads="$featureGridAds" position="feature-grid" layout="grid" />
            </div>
        @endif
    </div>
</section>



