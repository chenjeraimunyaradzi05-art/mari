@extends('frontend.layouts.master')

@section('contents')
<style>
    /* Athena Trust & Safety Custom Styles */
    .trust-hero {
        background: linear-gradient(135deg, #fff1f2 0%, #ffffff 50%, #fff7ed 100%);
        padding: 80px 0;
        position: relative;
        overflow: hidden;
        text-align: center;
    }

    .trust-hero::before {
        content: '';
        position: absolute;
        top: -50px;
        right: -50px;
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(251, 113, 133, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .trust-hero::after {
        content: '';
        position: absolute;
        bottom: -50px;
        left: -50px;
        width: 400px;
        height: 400px;
        background: radial-gradient(circle, rgba(253, 186, 116, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .hero-badge {
        display: inline-block;
        padding: 8px 16px;
        background: #ffe4e6;
        border: 1px solid #fda4af;
        border-radius: 100px;
        color: #e11d48;
        font-weight: 600;
        font-size: 0.9rem;
        margin-bottom: 24px;
        box-shadow: 0 4px 15px rgba(225, 29, 72, 0.1);
        position: relative;
        z-index: 1;
    }

    .hero-title {
        font-size: 3.5rem;
        font-weight: 800;
        line-height: 1.2;
        background: linear-gradient(to right, #be123c, #ea580c);
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
        padding: 40px;
        border-radius: 24px;
        height: 100%;
        transition: all 0.3s ease;
        border: 1px solid #e2e8f0;
        text-align: left;
        position: relative;
        overflow: hidden;
    }

    .feature-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 20px 40px -10px rgba(225, 29, 72, 0.1);
        border-color: #fda4af;
    }

    .feature-icon {
        width: 60px;
        height: 60px;
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.8rem;
        margin-bottom: 24px;
    }

    .guideline-section {
        padding: 80px 0;
        background: #fff;
    }

    .guideline-box {
        background: linear-gradient(145deg, #fff1f2, #fff);
        border-radius: 24px;
        padding: 40px;
        border: 1px solid #ffe4e6;
    }
</style>

<!-- Hero Section -->
<section class="trust-hero">
    <div class="container">
        <span class="hero-badge wow animate__animated animate__fadeInDown">
            <ion-icon name="shield-checkmark-outline" style="vertical-align: middle; margin-right: 5px;"></ion-icon>
            Trust & Safety
        </span>
        <h1 class="hero-title wow animate__animated animate__fadeInUp">
            Building a Safe Community
        </h1>
        <p class="hero-subtitle wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
            At Athena, your safety and privacy are our top priorities. We are committed to creating a secure, inclusive, and respectful environment for everyone.
        </p>
    </div>
</section>

<!-- Core Pillars -->
<section class="section-box mt-50 mb-50">
    <div class="container">
        <div class="row">
            <!-- Card 1: Data Privacy -->
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0s">
                <div class="feature-card">
                    <div class="feature-icon" style="background: #ffe4e6; color: #e11d48;">
                        <ion-icon name="lock-closed-outline"></ion-icon>
                    </div>
                    <h3 style="font-size: 1.5rem; font-weight: 700; color: #881337; margin-bottom: 15px;">Data Privacy</h3>
                    <p style="color: #475569; line-height: 1.6;">
                        We use bank-grade encryption to protect your personal information. Your data is yours, and we never sell it to third parties without your explicit consent.
                    </p>
                </div>
            </div>

            <!-- Card 2: Verified Profiles -->
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
                <div class="feature-card">
                    <div class="feature-icon" style="background: #ecfccb; color: #65a30d;">
                        <ion-icon name="checkmark-circle-outline"></ion-icon>
                    </div>
                    <h3 style="font-size: 1.5rem; font-weight: 700; color: #3f6212; margin-bottom: 15px;">Verified Profiles</h3>
                    <p style="color: #475569; line-height: 1.6;">
                        We verify the identity of our members and partners to ensure you are interacting with real, trusted individuals and businesses.
                    </p>
                </div>
            </div>

            <!-- Card 3: Community Guidelines -->
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.2s">
                <div class="feature-card">
                    <div class="feature-icon" style="background: #e0f2fe; color: #0284c7;">
                        <ion-icon name="people-outline"></ion-icon>
                    </div>
                    <h3 style="font-size: 1.5rem; font-weight: 700; color: #075985; margin-bottom: 15px;">Community Standards</h3>
                    <p style="color: #475569; line-height: 1.6;">
                        Our community guidelines promote respect and inclusivity. We have zero tolerance for harassment, discrimination, or hate speech.
                    </p>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- Detailed Sections -->
<section class="guideline-section">
    <div class="container">
        <div class="row align-items-center mb-80">
            <div class="col-lg-6 wow animate__animated animate__fadeInLeft">
                <img src="{{ asset('assets/imgs/page/about/img-safety.png') }}" alt="Safety First" style="border-radius: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); width: 100%;" onerror="this.src='https://placehold.co/600x400/ffe4e6/e11d48?text=Safety+First'">
            </div>
            <div class="col-lg-6 wow animate__animated animate__fadeInRight">
                <div class="pl-30">
                    <h2 style="font-size: 2.5rem; font-weight: 800; color: #1e293b; margin-bottom: 20px;">
                        Proactive Protection
                    </h2>
                    <p style="font-size: 1.1rem; color: #475569; margin-bottom: 20px; line-height: 1.7;">
                        Our dedicated Trust & Safety team works around the clock to monitor our platform for suspicious activity. We use advanced AI and human moderation to detect and prevent fraud, spam, and abuse before it affects you.
                    </p>
                    <ul style="list-style: none; padding: 0;">
                        <li style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px; color: #334155; font-weight: 500;">
                            <ion-icon name="shield-checkmark" style="color: #e11d48; font-size: 1.2rem;"></ion-icon> 24/7 Automated Monitoring
                        </li>
                        <li style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px; color: #334155; font-weight: 500;">
                            <ion-icon name="shield-checkmark" style="color: #e11d48; font-size: 1.2rem;"></ion-icon> Secure Payment Processing
                        </li>
                        <li style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px; color: #334155; font-weight: 500;">
                            <ion-icon name="shield-checkmark" style="color: #e11d48; font-size: 1.2rem;"></ion-icon> Dispute Resolution Support
                        </li>
                    </ul>
                </div>
            </div>
        </div>

        <div class="row justify-content-center">
            <div class="col-lg-10">
                <div class="guideline-box text-center wow animate__animated animate__fadeInUp">
                    <h2 style="font-size: 2rem; font-weight: 700; color: #881337; margin-bottom: 15px;">Need to report an issue?</h2>
                    <p style="color: #475569; margin-bottom: 30px; font-size: 1.1rem;">
                        If you encounter something that violates our policies or makes you feel unsafe, please let us know immediately.
                    </p>
                    <a href="{{ route('contact.index') }}" class="btn btn-default" style="background: #e11d48; color: white; padding: 12px 30px; border-radius: 50px; font-weight: 600; text-decoration: none; transition: all 0.3s ease;">
                        Contact Support
                    </a>
                </div>
            </div>
        </div>
    </div>
</section>

@endsection
