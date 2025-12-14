@extends('frontend.layouts.master')

@section('contents')
<style>
    /* Athena Social Mentorship Info Custom Styles */
    .mentor-hero {
        background: linear-gradient(135deg, #f5f3ff 0%, #ffffff 50%, #ede9fe 100%);
        padding: 80px 0;
        position: relative;
        overflow: hidden;
        text-align: center;
    }

    .mentor-hero::before {
        content: '';
        position: absolute;
        top: -50px;
        left: -50px;
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .hero-badge {
        display: inline-block;
        padding: 8px 16px;
        background: #ede9fe;
        border: 1px solid #8b5cf6;
        border-radius: 100px;
        color: #6d28d9;
        font-weight: 600;
        font-size: 0.9rem;
        margin-bottom: 24px;
        box-shadow: 0 4px 15px rgba(109, 40, 217, 0.1);
        position: relative;
        z-index: 1;
    }

    .hero-title {
        font-size: 3.5rem;
        font-weight: 800;
        line-height: 1.2;
        background: linear-gradient(to right, #7c3aed, #6d28d9);
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
        text-align: center;
        padding: 30px;
        position: relative;
    }

    .step-number {
        width: 50px;
        height: 50px;
        background: #7c3aed;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0 auto 20px;
        box-shadow: 0 10px 20px rgba(124, 58, 237, 0.3);
    }

    .step-title {
        font-size: 1.25rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 10px;
    }

    .step-desc {
        color: #64748b;
        line-height: 1.6;
    }

    .mentor-cta {
        background: #7c3aed;
        border-radius: 24px;
        padding: 60px;
        text-align: center;
        color: white;
        margin-top: 50px;
    }

    .btn-white-outline {
        background: transparent;
        border: 2px solid white;
        color: white;
        padding: 12px 24px;
        border-radius: 100px;
        font-weight: 600;
        text-decoration: none;
        display: inline-block;
        margin: 10px;
        transition: all 0.3s ease;
    }

    .btn-white-outline:hover {
        background: white;
        color: #7c3aed;
    }
</style>

<!-- Hero Section -->
<section class="mentor-hero">
    <div class="container">
        <span class="hero-badge wow animate__animated animate__fadeInDown">
            <ion-icon name="ribbon-outline" style="vertical-align: middle; margin-right: 5px;"></ion-icon>
            Lift As You Climb
        </span>
        <h1 class="hero-title wow animate__animated animate__fadeInUp">
            Mentorship
        </h1>
        <p class="hero-subtitle wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
            Accelerate your growth with guidance from women who have walked the path before you. Or give back by becoming a mentor yourself.
        </p>
    </div>
</section>

<!-- How it Works -->
<section class="section-box mt-50 mb-50">
    <div class="container">
        <div class="row">
            <div class="col-lg-4 wow animate__animated animate__fadeInUp" data-wow-delay="0s">
                <div class="step-card">
                    <div class="step-number">1</div>
                    <h3 class="step-title">Match</h3>
                    <p class="step-desc">Our AI-powered matching system pairs you with mentors based on your career goals, industry, and values.</p>
                </div>
            </div>
            <div class="col-lg-4 wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
                <div class="step-card">
                    <div class="step-number">2</div>
                    <h3 class="step-title">Connect</h3>
                    <p class="step-desc">Schedule 1:1 sessions, chat securely, and set milestones to track your progress together.</p>
                </div>
            </div>
            <div class="col-lg-4 wow animate__animated animate__fadeInUp" data-wow-delay="0.2s">
                <div class="step-card">
                    <div class="step-number">3</div>
                    <h3 class="step-title">Grow</h3>
                    <p class="step-desc">Unlock new opportunities, gain confidence, and achieve your professional dreams with expert support.</p>
                </div>
            </div>
        </div>

        <div class="mentor-cta wow animate__animated animate__fadeInUp">
            <h2 style="font-size: 2rem; font-weight: 800; margin-bottom: 20px;">Ready to get started?</h2>
            <div class="d-flex justify-content-center gap-3 flex-wrap">
                <a href="{{ route('register') }}" class="btn-white-outline">Find a Mentor</a>
                <a href="{{ route('register') }}" class="btn-white-outline">Become a Mentor</a>
            </div>
        </div>
    </div>
</section>

@endsection
