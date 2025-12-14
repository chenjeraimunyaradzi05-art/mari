@extends('frontend.layouts.master')

@section('contents')
<style>
    /* Athena Modules Custom Styles */
    .modules-hero {
        background: linear-gradient(135deg, #f5f3ff 0%, #ffffff 50%, #ede9fe 100%);
        padding: 80px 0;
        position: relative;
        overflow: hidden;
        text-align: center;
    }

    .modules-hero::before {
        content: '';
        position: absolute;
        top: -50px;
        right: -50px;
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .modules-hero::after {
        content: '';
        position: absolute;
        bottom: -50px;
        left: -50px;
        width: 400px;
        height: 400px;
        background: radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .hero-badge {
        display: inline-block;
        padding: 8px 16px;
        background: #ddd6fe;
        border: 1px solid #a78bfa;
        border-radius: 100px;
        color: #7c3aed;
        font-weight: 600;
        font-size: 0.9rem;
        margin-bottom: 24px;
        box-shadow: 0 4px 15px rgba(124, 58, 237, 0.1);
        position: relative;
        z-index: 1;
    }

    .hero-title {
        font-size: 3.5rem;
        font-weight: 800;
        line-height: 1.2;
        background: linear-gradient(to right, #6d28d9, #8b5cf6);
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

    .module-card {
        background: white;
        border-radius: 24px;
        overflow: hidden;
        transition: all 0.3s ease;
        border: 1px solid #e2e8f0;
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: 30px;
    }

    .module-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 20px 40px -10px rgba(124, 58, 237, 0.1);
        border-color: #a78bfa;
    }

    .module-icon-wrapper {
        width: 70px;
        height: 70px;
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        margin-bottom: 20px;
        transition: all 0.3s ease;
    }

    .module-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 10px;
    }

    .module-desc {
        color: #64748b;
        font-size: 1rem;
        line-height: 1.6;
        margin-bottom: 20px;
        flex-grow: 1;
    }

    .module-link {
        color: #7c3aed;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 5px;
        transition: gap 0.3s ease;
    }

    .module-link:hover {
        gap: 10px;
        color: #6d28d9;
    }
</style>

<!-- Hero Section -->
<section class="modules-hero">
    <div class="container">
        <span class="hero-badge wow animate__animated animate__fadeInDown">
            <ion-icon name="grid-outline" style="vertical-align: middle; margin-right: 5px;"></ion-icon>
            Platform Features
        </span>
        <h1 class="hero-title wow animate__animated animate__fadeInUp">
            Core Modules
        </h1>
        <p class="hero-subtitle wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
            Explore the powerful tools and features designed to support every aspect of your personal and professional life.
        </p>
    </div>
</section>

<!-- Modules Grid -->
<section class="section-box mt-50 mb-50">
    <div class="container">
        <div class="row">
            <!-- Module 1 -->
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0s">
                <div class="module-card">
                    <div class="module-icon-wrapper" style="background: #e0e7ff; color: #4f46e5;">
                        <ion-icon name="briefcase-outline"></ion-icon>
                    </div>
                    <h3 class="module-title">Career Hub</h3>
                    <p class="module-desc">AI-powered job matching, resume builder, and career pathing tools to help you land your dream job.</p>
                    <a href="{{ route('jobs.index') }}" class="module-link">Explore Career Hub <ion-icon name="arrow-forward-outline"></ion-icon></a>
                </div>
            </div>

            <!-- Module 2 -->
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
                <div class="module-card">
                    <div class="module-icon-wrapper" style="background: #dcfce7; color: #16a34a;">
                        <ion-icon name="wallet-outline"></ion-icon>
                    </div>
                    <h3 class="module-title">Financial Wellness</h3>
                    <p class="module-desc">Budgeting tools, debt management strategies, and investment guides to secure your financial future.</p>
                    <a href="{{ route('money.dashboard') }}" class="module-link">Explore Finance <ion-icon name="arrow-forward-outline"></ion-icon></a>
                </div>
            </div>

            <!-- Module 3 -->
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.2s">
                <div class="module-card">
                    <div class="module-icon-wrapper" style="background: #fce7f3; color: #db2777;">
                        <ion-icon name="people-outline"></ion-icon>
                    </div>
                    <h3 class="module-title">Community & Social</h3>
                    <p class="module-desc">Connect with peers, join interest groups, and find mentors in a safe, supportive environment.</p>
                    <a href="{{ route('athena.social') }}" class="module-link">Explore Social <ion-icon name="arrow-forward-outline"></ion-icon></a>
                </div>
            </div>

            <!-- Module 4 -->
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.3s">
                <div class="module-card">
                    <div class="module-icon-wrapper" style="background: #ffedd5; color: #ea580c;">
                        <ion-icon name="home-outline"></ion-icon>
                    </div>
                    <h3 class="module-title">Housing & Real Estate</h3>
                    <p class="module-desc">Resources for first-time buyers, mortgage calculators, and rental assistance programs.</p>
                    <a href="{{ route('housing.index') }}" class="module-link">Explore Housing <ion-icon name="arrow-forward-outline"></ion-icon></a>
                </div>
            </div>

            <!-- Module 5 -->
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.4s">
                <div class="module-card">
                    <div class="module-icon-wrapper" style="background: #e0f2fe; color: #0284c7;">
                        <ion-icon name="school-outline"></ion-icon>
                    </div>
                    <h3 class="module-title">Education & TAFE</h3>
                    <p class="module-desc">Discover courses, certifications, and upskilling opportunities tailored to market demands.</p>
                    <a href="{{ route('education.tafe.dashboard') }}" class="module-link">Explore Education <ion-icon name="arrow-forward-outline"></ion-icon></a>
                </div>
            </div>

            <!-- Module 6 -->
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.5s">
                <div class="module-card">
                    <div class="module-icon-wrapper" style="background: #f3e8ff; color: #9333ea;">
                        <ion-icon name="rocket-outline"></ion-icon>
                    </div>
                    <h3 class="module-title">Business & Grants</h3>
                    <p class="module-desc">Tools for entrepreneurs, including business plan templates, grant finders, and legal resources.</p>
                    <a href="{{ route('business.index') }}" class="module-link">Explore Business <ion-icon name="arrow-forward-outline"></ion-icon></a>
                </div>
            </div>
        </div>
    </div>
</section>

@endsection
