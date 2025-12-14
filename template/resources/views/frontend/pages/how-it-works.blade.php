@extends('frontend.layouts.master')

@section('contents')
<style>
    /* Athena How It Works Custom Styles */
    .how-hero {
        background: linear-gradient(135deg, #eef2ff 0%, #ffffff 50%, #e0e7ff 100%);
        padding: 80px 0;
        position: relative;
        overflow: hidden;
        text-align: center;
    }

    .how-hero::before {
        content: '';
        position: absolute;
        top: -50px;
        right: -50px;
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .how-hero::after {
        content: '';
        position: absolute;
        bottom: -50px;
        left: -50px;
        width: 400px;
        height: 400px;
        background: radial-gradient(circle, rgba(79, 70, 229, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .hero-badge {
        display: inline-block;
        padding: 8px 16px;
        background: #e0e7ff;
        border: 1px solid #a5b4fc;
        border-radius: 100px;
        color: #4f46e5;
        font-weight: 600;
        font-size: 0.9rem;
        margin-bottom: 24px;
        box-shadow: 0 4px 15px rgba(79, 70, 229, 0.1);
        position: relative;
        z-index: 1;
    }

    .hero-title {
        font-size: 3.5rem;
        font-weight: 800;
        line-height: 1.2;
        background: linear-gradient(to right, #4338ca, #6366f1);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 24px;
        letter-spacing: -0.02em;
        position: relative;
        z-index: 1;
    }

    .hero-subtitle {
        font-size: 1.25rem;
        color: #475569;
        line-height: 1.8;
        margin-bottom: 40px;
        max-width: 700px;
        margin-left: auto;
        margin-right: auto;
        position: relative;
        z-index: 1;
    }

    .step-card {
        background: white;
        padding: 40px;
        border-radius: 24px;
        height: 100%;
        transition: all 0.3s ease;
        border: 1px solid #e2e8f0;
        text-align: center;
        position: relative;
    }

    .step-card:hover {
        transform: translateY(-10px);
        box-shadow: 0 20px 40px -10px rgba(79, 70, 229, 0.1);
        border-color: #a5b4fc;
    }

    .step-number {
        width: 50px;
        height: 50px;
        background: #4f46e5;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0 auto 20px;
        box-shadow: 0 10px 20px rgba(79, 70, 229, 0.3);
    }

    .step-icon {
        font-size: 3rem;
        color: #6366f1;
        margin-bottom: 20px;
    }

    .step-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 15px;
    }

    .step-desc {
        color: #64748b;
        line-height: 1.6;
    }

    .connector-line {
        position: absolute;
        top: 65px;
        left: 50%;
        width: 100%;
        height: 2px;
        background: #e0e7ff;
        z-index: -1;
        display: none;
    }

    @media (min-width: 992px) {
        .connector-line {
            display: block;
        }
        .col-lg-4:last-child .connector-line {
            display: none;
        }
    }
</style>

<!-- Hero Section -->
<section class="how-hero">
    <div class="container">
        <span class="hero-badge wow animate__animated animate__fadeInDown">
            <ion-icon name="help-circle-outline" style="vertical-align: middle; margin-right: 5px;"></ion-icon>
            Platform Overview
        </span>
        <h1 class="hero-title wow animate__animated animate__fadeInUp">
            How Athena Works
        </h1>
        <p class="hero-subtitle wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
            Your journey to economic empowerment starts here. We've simplified the path to success into three easy steps.
        </p>
    </div>
</section>

<!-- Steps Section -->
<section class="section-box mt-50 mb-50">
    <div class="container">
        <div class="row">
            <!-- Step 1 -->
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0s">
                <div style="position: relative; height: 100%;">
                    <div class="connector-line"></div>
                    <div class="step-card">
                        <div class="step-number">1</div>
                        <div class="step-icon">
                            <ion-icon name="person-add-outline"></ion-icon>
                        </div>
                        <h3 class="step-title">Create Your Profile</h3>
                        <p class="step-desc">
                            Sign up and tell us about your goals. Our AI Concierge will analyze your skills and interests to build a personalized roadmap.
                        </p>
                    </div>
                </div>
            </div>

            <!-- Step 2 -->
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.2s">
                <div style="position: relative; height: 100%;">
                    <div class="connector-line"></div>
                    <div class="step-card">
                        <div class="step-number">2</div>
                        <div class="step-icon">
                            <ion-icon name="compass-outline"></ion-icon>
                        </div>
                        <h3 class="step-title">Explore Opportunities</h3>
                        <p class="step-desc">
                            Access tailored job matches, educational courses, and business grants. Connect with mentors who can guide your growth.
                        </p>
                    </div>
                </div>
            </div>

            <!-- Step 3 -->
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.4s">
                <div style="position: relative; height: 100%;">
                    <div class="step-card">
                        <div class="step-number">3</div>
                        <div class="step-icon">
                            <ion-icon name="rocket-outline"></ion-icon>
                        </div>
                        <h3 class="step-title">Achieve & Grow</h3>
                        <p class="step-desc">
                            Track your progress, earn certifications, and unlock new levels of economic security. Celebrate your wins with the community.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- CTA Section -->
<section class="section-box mb-80">
    <div class="container">
        <div class="text-center" style="background: #4f46e5; padding: 60px; border-radius: 24px; color: white; box-shadow: 0 20px 50px -10px rgba(79, 70, 229, 0.5);">
            <h2 style="font-size: 2.5rem; font-weight: 800; margin-bottom: 20px;">Ready to start your journey?</h2>
            <p style="font-size: 1.2rem; opacity: 0.9; margin-bottom: 30px; max-width: 600px; margin-left: auto; margin-right: auto;">
                Join thousands of women who are transforming their lives with Athena.
            </p>
            <a href="{{ route('register') }}" class="btn btn-default" style="background: white; color: #4f46e5; padding: 15px 40px; border-radius: 50px; font-weight: 700; text-decoration: none; transition: all 0.3s ease; box-shadow: 0 10px 20px rgba(0,0,0,0.2);">
                Get Started Now
            </a>
        </div>
    </div>
</section>

@endsection
