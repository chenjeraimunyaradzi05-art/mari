@extends('frontend.layouts.master')

@section('contents')
<style>
    /* Athena Social Lounge Custom Styles */
    .lounge-hero {
        background: linear-gradient(135deg, #fdf2f8 0%, #ffffff 50%, #fce7f3 100%);
        padding: 80px 0;
        position: relative;
        overflow: hidden;
        text-align: center;
    }

    .lounge-hero::before {
        content: '';
        position: absolute;
        top: -50px;
        right: -50px;
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(244, 114, 182, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .lounge-hero::after {
        content: '';
        position: absolute;
        bottom: -50px;
        left: -50px;
        width: 400px;
        height: 400px;
        background: radial-gradient(circle, rgba(219, 39, 119, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .hero-badge {
        display: inline-block;
        padding: 8px 16px;
        background: #fce7f3;
        border: 1px solid #f472b6;
        border-radius: 100px;
        color: #be185d;
        font-weight: 600;
        font-size: 0.9rem;
        margin-bottom: 24px;
        box-shadow: 0 4px 15px rgba(190, 24, 93, 0.1);
        position: relative;
        z-index: 1;
    }

    .hero-title {
        font-size: 3.5rem;
        font-weight: 800;
        line-height: 1.2;
        background: linear-gradient(to right, #db2777, #e11d48);
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

    .feature-card {
        background: white;
        padding: 40px 30px;
        border-radius: 24px;
        border: 1px solid #e2e8f0;
        text-align: center;
        transition: all 0.3s ease;
        height: 100%;
    }

    .feature-card:hover {
        transform: translateY(-10px);
        box-shadow: 0 20px 40px -10px rgba(219, 39, 119, 0.1);
        border-color: #f9a8d4;
    }

    .feature-icon {
        font-size: 3rem;
        color: #db2777;
        margin-bottom: 20px;
    }

    .feature-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 15px;
    }

    .feature-desc {
        font-size: 1rem;
        color: #64748b;
        line-height: 1.6;
    }

    .cta-section {
        background: linear-gradient(135deg, #db2777 0%, #be185d 100%);
        padding: 80px 0;
        color: white;
        text-align: center;
        border-radius: 30px;
        margin: 50px 0;
    }

    .btn-white {
        background: white;
        color: #db2777;
        padding: 15px 30px;
        border-radius: 100px;
        font-weight: 700;
        text-decoration: none;
        display: inline-block;
        margin-top: 30px;
        transition: all 0.3s ease;
    }

    .btn-white:hover {
        transform: translateY(-3px);
        box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        background: #fdf2f8;
    }
</style>

<!-- Hero Section -->
<section class="lounge-hero">
    <div class="container">
        <span class="hero-badge wow animate__animated animate__fadeInDown">
            <ion-icon name="planet-outline" style="vertical-align: middle; margin-right: 5px;"></ion-icon>
            The Digital Third Place
        </span>
        <h1 class="hero-title wow animate__animated animate__fadeInUp">
            Athena Lounge
        </h1>
        <p class="hero-subtitle wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
            Your sanctuary away from the noise. Connect, unwind, and grow with a community of women who truly get it. No trolls, just support.
        </p>
    </div>
</section>

<!-- Features Grid -->
<section class="section-box mt-50 mb-50">
    <div class="container">
        <div class="row">
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0s">
                <div class="feature-card">
                    <div class="feature-icon">
                        <ion-icon name="cafe-outline"></ion-icon>
                    </div>
                    <h3 class="feature-title">Casual Conversations</h3>
                    <p class="feature-desc">Drop in for a coffee chat, share your morning win, or just vent about your day in a safe, supportive environment.</p>
                </div>
            </div>
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
                <div class="feature-card">
                    <div class="feature-icon">
                        <ion-icon name="sparkles-outline"></ion-icon>
                    </div>
                    <h3 class="feature-title">Daily Inspirations</h3>
                    <p class="feature-desc">Start your day with curated affirmations, success stories, and motivation from fellow members.</p>
                </div>
            </div>
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.2s">
                <div class="feature-card">
                    <div class="feature-icon">
                        <ion-icon name="shield-checkmark-outline"></ion-icon>
                    </div>
                    <h3 class="feature-title">Safe & Moderated</h3>
                    <p class="feature-desc">Our community is actively moderated to ensure kindness, respect, and safety for every single member.</p>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- CTA Section -->
<div class="container">
    <div class="cta-section wow animate__animated animate__fadeInUp">
        <h2 style="font-size: 2.5rem; font-weight: 800; margin-bottom: 20px;">Ready to join the conversation?</h2>
        <p style="font-size: 1.2rem; opacity: 0.9; max-width: 600px; margin: 0 auto;">
            Become part of a thriving community where your voice matters.
        </p>
        <a href="{{ route('register') }}" class="btn-white">Join Athena Today</a>
    </div>
</div>

@endsection
