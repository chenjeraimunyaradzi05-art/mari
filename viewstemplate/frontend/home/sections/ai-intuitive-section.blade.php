@php
    $onboardingAds = $homepageSponsorSlots['onboarding'] ?? [];
    $educationAds = $homepageSponsorSlots['education'] ?? [];
@endphp

{{-- AI Intuitive Hiring Section with Apprenticeships --}}
<section class="section-box mt-80 ai-intuitive-section">
    <div class="container">
        {{-- Section Header --}}
        <div class="text-center mb-50">
            <span class="badge bg-gradient-primary text-white mb-20">🤖 AI-Powered Platform</span>
            <h2 class="heading-title mb-20">
                Intelligent Hiring Meets
                <span class="color-brand-2">Career Development</span>
            </h2>
            <p class="text-lg neutral-500 mx-auto" style="max-width: 700px;">
                Our AI doesn't just match jobs—it guides careers, suggests apprenticeships, and predicts success.
            </p>
        </div>

        <div class="row align-items-center mb-60">
            {{-- Left Content --}}
            <div class="col-lg-6 col-md-12 mb-30">
                <div class="ai-content">
                    <h3 class="mb-20">Real-Time AI Insights</h3>
                    <p class="text-md neutral-500 mb-30">
                        Experience the future of recruitment with our intelligent matching system.
                        Our AI analyzes skills, experience, cultural fit, and even suggests apprenticeships
                        for career development.
                    </p>                    {{-- AI Features List --}}
                    <div class="ai-features">
                        <div class="feature-item mb-20" data-aos="fade-right" data-aos-delay="100">
                            <div class="feature-icon">
                                <i class="fi-rr-magic-wand"></i>
                            </div>
                            <div class="feature-text">
                                <h6 class="mb-5">Smart Job Matching</h6>
                                <p class="text-sm text-muted">AI recommends perfect job fits based on your profile and preferences</p>
                            </div>
                        </div>

                        <div class="feature-item mb-20" data-aos="fade-right" data-aos-delay="200">
                            <div class="feature-icon">
                                <i class="fi-rr-graduation-cap"></i>
                            </div>
                            <div class="feature-text">
                                <h6 class="mb-5">Apprenticeship Discovery</h6>
                                <p class="text-sm text-muted">Find entry-level apprenticeships and trainee programs tailored to your goals</p>
                            </div>
                        </div>

                        <div class="feature-item mb-20" data-aos="fade-right" data-aos-delay="300">
                            <div class="feature-icon">
                                <i class="fi-rr-document"></i>
                            </div>
                            <div class="feature-text">
                                <h6 class="mb-5">Intelligent Resume Parsing</h6>
                                <p class="text-sm text-muted">Automatically extracts skills and experience from your resume</p>
                            </div>
                        </div>

                        <div class="feature-item mb-20" data-aos="fade-right" data-aos-delay="400">
                            <div class="feature-icon">
                                <i class="fi-rr-chart-line-up"></i>
                            </div>
                            <div class="feature-text">
                                <h6 class="mb-5">Career Path Insights</h6>
                                <p class="text-sm text-muted">Get AI-powered predictions on your career growth and development opportunities</p>
                            </div>
                        </div>
                    </div>

                    {{-- Interactive Apprenticeship Showcase --}}
                    <div class="apprenticeship-highlight mt-40" data-aos="zoom-in">
                        <div class="highlight-content">
                            <div class="highlight-icon">
                                <i class="fi-rr-star"></i>
                            </div>
                            <div class="highlight-text">
                                <h6>New: Apprenticeship Programs</h6>
                                <p class="text-sm">Explore 500+ apprenticeships across tech, healthcare, and business sectors</p>
                            </div>
                            <a href="{{ route('jobs.index', ['search' => 'apprenticeship']) }}" class="btn btn-sm btn-apprentice">
                                View Programs
                                <i class="fi-rr-arrow-right ms-2"></i>
                            </a>
                        </div>
                    </div>

                    <div class="mt-30">
                        <a href="{{ route('jobs.index') }}" class="btn btn-default btn-shadow me-10">
                            Explore AI-Matched Jobs
                        </a>
                        <a href="#how-it-works" class="btn btn-border scroll-to">
                            Learn More
                        </a>
                    </div>

                    @if (!empty($onboardingAds))
                        <div class="mt-40">
                            <x-ad-slot :ads="$onboardingAds" position="onboarding" layout="card" />
                        </div>
                    @endif
                </div>
            </div>

            {{-- Right Visual/Stats --}}
            <div class="col-lg-6 col-md-12">
                <div class="ai-visual">
                    {{-- AI Stats Cards --}}
                    <div class="row">
                        <div class="col-sm-6 mb-20">
                            <div class="card-ai-stat">
                                <div class="stat-icon">
                                    <i class="fi-rr-rocket"></i>
                                </div>
                                <h3 class="stat-number">98%</h3>
                                <p class="stat-label">Matching Accuracy</p>
                                <div class="stat-sparkline"></div>
                            </div>
                        </div>

                        <div class="col-sm-6 mb-20">
                            <div class="card-ai-stat">
                                <div class="stat-icon">
                                    <i class="fi-rr-time-fast"></i>
                                </div>
                                <h3 class="stat-number">2.5x</h3>
                                <p class="stat-label">Faster Hiring</p>
                                <div class="stat-sparkline"></div>
                            </div>
                        </div>

                        <div class="col-sm-6 mb-20">
                            <div class="card-ai-stat">
                                <div class="stat-icon">
                                    <i class="fi-rr-users-alt"></i>
                                </div>
                                <h3 class="stat-number">50K+</h3>
                                <p class="stat-label">AI Matches Made</p>
                                <div class="stat-sparkline"></div>
                            </div>
                        </div>

                        <div class="col-sm-6 mb-20">
                            <div class="card-ai-stat">
                                <div class="stat-icon">
                                    <i class="fi-rr-shield-check"></i>
                                </div>
                                <h3 class="stat-number">95%</h3>
                                <p class="stat-label">Member Satisfaction</p>
                                <div class="stat-sparkline"></div>
                            </div>
                        </div>
                    </div>

                    {{-- Floating Animation Elements --}}
                    <div class="ai-animation-dots">
                        <div class="dot dot-1"></div>
                        <div class="dot dot-2"></div>
                        <div class="dot dot-3"></div>
                    </div>

                    @if (!empty($educationAds))
                        <div class="mt-40">
                            <x-ad-slot :ads="$educationAds" position="education" layout="stacked" />
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </div>
</section>

{{-- AI Section Custom Styles --}}


