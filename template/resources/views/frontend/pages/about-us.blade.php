@extends('frontend.layouts.master')

@section('contents')
<style>
    /* Athena About Us Custom Styles */
    .about-hero {
        background: linear-gradient(135deg, #fdf4ff 0%, #ffffff 50%, #f0f9ff 100%);
        padding: 80px 0;
        position: relative;
        overflow: hidden;
    }

    .about-hero::before {
        content: '';
        position: absolute;
        top: -50px;
        right: -50px;
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(216, 180, 254, 0.2) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .about-hero::after {
        content: '';
        position: absolute;
        bottom: -50px;
        left: -50px;
        width: 400px;
        height: 400px;
        background: radial-gradient(circle, rgba(253, 164, 175, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .hero-content {
        position: relative;
        z-index: 1;
        max-width: 800px;
        margin: 0 auto;
        text-align: center;
    }

    .hero-badge {
        display: inline-block;
        padding: 8px 16px;
        background: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(233, 213, 255, 0.6);
        border-radius: 100px;
        color: #9333ea;
        font-weight: 600;
        font-size: 0.9rem;
        margin-bottom: 24px;
        box-shadow: 0 4px 15px rgba(147, 51, 234, 0.1);
    }

    .hero-title {
        font-size: 3.5rem;
        font-weight: 800;
        line-height: 1.2;
        background: linear-gradient(to right, #4c1d95, #db2777);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 24px;
        letter-spacing: -0.02em;
    }

    .hero-subtitle {
        font-size: 1.25rem;
        color: #475569;
        line-height: 1.8;
        margin-bottom: 40px;
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 30px;
        margin-top: 60px;
    }

    .stat-card {
        background: white;
        padding: 30px;
        border-radius: 24px;
        box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.05);
        border: 1px solid #f1f5f9;
        transition: transform 0.3s ease;
        text-align: center;
    }

    .stat-card:hover {
        transform: translateY(-5px);
    }

    .stat-number {
        font-size: 2.5rem;
        font-weight: 800;
        color: #9333ea;
        margin-bottom: 8px;
    }

    .stat-label {
        color: #64748b;
        font-weight: 600;
        font-size: 1rem;
    }

    .mission-section {
        padding: 100px 0;
        background: white;
    }

    .mission-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 60px;
        align-items: center;
    }

    .mission-image-wrapper {
        position: relative;
        border-radius: 30px;
        overflow: hidden;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
    }

    .mission-image {
        width: 100%;
        height: auto;
        display: block;
        transition: transform 0.5s ease;
    }

    .mission-image-wrapper:hover .mission-image {
        transform: scale(1.05);
    }

    .values-section {
        padding: 100px 0;
        background: #f8fafc;
    }

    .value-card {
        background: white;
        padding: 40px;
        border-radius: 24px;
        height: 100%;
        transition: all 0.3s ease;
        border: 1px solid #e2e8f0;
        text-align: center;
    }

    .value-card:hover {
        transform: translateY(-10px);
        box-shadow: 0 20px 40px -10px rgba(147, 51, 234, 0.1);
        border-color: #d8b4fe;
    }

    .value-icon {
        width: 60px;
        height: 60px;
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.8rem;
        margin: 0 auto 24px;
    }

    .icon-purple { background: #f3e8ff; color: #9333ea; }
    .icon-pink { background: #fce7f3; color: #db2777; }
    .icon-blue { background: #e0f2fe; color: #0284c7; }
    .icon-green { background: #dcfce7; color: #16a34a; }

    .value-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 16px;
    }

    .value-text {
        color: #64748b;
        line-height: 1.7;
    }

    @media (max-width: 992px) {
        .hero-title { font-size: 2.5rem; }
        .mission-grid { grid-template-columns: 1fr; gap: 40px; }
    }
</style>

<!-- Hero Section -->
<section class="about-hero">
    <div class="container">
        <div class="hero-content">
            <span class="hero-badge wow animate__animated animate__fadeInDown" style="background: #f3e8ff; border-color: #d8b4fe; color: #9333ea;">
                <ion-icon name="sparkles-outline" style="vertical-align: middle; margin-right: 5px;"></ion-icon>
                Our Mission
            </span>
            <h1 class="hero-title wow animate__animated animate__fadeInUp">
                Empowering Women's<br>Economic Security
            </h1>
            <p class="hero-subtitle wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
                {{ config('settings.site_name') }} is more than a platform; it's a movement. We are orchestrating a new economic reality where women have the tools, connections, and pathways to secure their financial future, housing, and wellbeing.
            </p>
        </div>

        <div class="stats-grid wow animate__animated animate__fadeInUp" data-wow-delay="0.2s">
            <div class="stat-card" style="background: #f3e8ff; border-color: #e9d5ff;">
                <div class="stat-number" style="color: #9333ea;">850k+</div>
                <div class="stat-label" style="color: #6b21a8;">Active Members</div>
            </div>
            <div class="stat-card" style="background: #fce7f3; border-color: #fbcfe8;">
                <div class="stat-number" style="color: #db2777;">$47M+</div>
                <div class="stat-label" style="color: #9d174d;">Income Generated</div>
            </div>
            <div class="stat-card" style="background: #e0f2fe; border-color: #bae6fd;">
                <div class="stat-number" style="color: #0284c7;">25+</div>
                <div class="stat-label" style="color: #0369a1;">Integrated Modules</div>
            </div>
            <div class="stat-card" style="background: #dcfce7; border-color: #bbf7d0;">
                <div class="stat-number" style="color: #16a34a;">100%</div>
                <div class="stat-label" style="color: #15803d;">Women-First</div>
            </div>
        </div>
    </div>
</section>

<!-- Our Story / Dynamic Content Section -->
<section class="mission-section">
    <div class="container">
        <div class="mission-grid">
            <div class="mission-content wow animate__animated animate__fadeInLeft">
                <h6 class="color-text-mutted text-uppercase mb-15" style="letter-spacing: 2px; font-weight: 700; color: #9333ea;">Who We Are</h6>
                <h2 class="section-title mb-30" style="font-size: 2.8rem; font-weight: 800; background: linear-gradient(to right, #1e293b, #4c1d95); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                    {{ $about?->title ?? 'Building the Future of Work for Women' }}
                </h2>

                <div class="content-text" style="font-size: 1.2rem; line-height: 1.9; color: #334155;">
                    @if($about?->description)
                        {!! $about->description !!}
                    @else
                        <p class="mb-25">
                            <span style="font-weight: 700; color: #9333ea;">Athena</span> is the world's first <span style="background: linear-gradient(120deg, #f3e8ff 0%, #fce7f3 100%); padding: 0 5px; border-radius: 4px; color: #db2777; font-weight: 700;">orchestrated socio-economic platform</span> designed exclusively for women. We bridge the gap between ambition and achievement by providing a unified ecosystem for career growth, financial literacy, housing security, and community support.
                        </p>
                        <p>
                            Our platform integrates <span style="color: #4f46e5; font-weight: 700;">AI-driven career pathways</span> with real-world opportunities, ensuring that every woman has a personalized roadmap to success. From finding your dream job to securing a mortgage, Athena is your partner in every step of the journey.
                        </p>
                    @endif
                </div>

                @if ($about?->url)
                    <div class="mt-40">
                        <a class="btn btn-default btn-shadow-hover" href="{{ $about?->url }}" style="background: #9333ea; border: none; padding: 15px 35px; border-radius: 50px;">
                            Learn More <ion-icon name="arrow-forward-outline" style="vertical-align: middle; margin-left: 5px;"></ion-icon>
                        </a>
                    </div>
                @endif
            </div>

            <div class="mission-image-wrapper wow animate__animated animate__fadeInRight">
                <img src="{{ $about?->image ? asset($about->image) : asset('default-uploads/about-hero.jpg') }}"
                     alt="Athena Community"
                     class="mission-image"
                     onerror="this.src='https://images.unsplash.com/photo-1573164713988-8665fc963095?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';">
            </div>
        </div>
    </div>
</section>

<!-- Core Values Section -->
<section class="values-section">
    <div class="container">
        <div class="text-center mb-70">
            <h2 class="section-title mb-15 wow animate__animated animate__fadeInUp">Our Core Values</h2>
            <p class="font-lg color-text-paragraph-2 wow animate__animated animate__fadeInUp">The principles that guide our mission every day.</p>
        </div>

        <div class="row">
            <div class="col-lg-3 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0s">
                <div class="value-card" style="background: #f3e8ff; border-color: #e9d5ff;">
                    <div class="value-icon icon-purple" style="background: white;">
                        <ion-icon name="heart-outline"></ion-icon>
                    </div>
                    <h3 class="value-title" style="color: #6b21a8;">Women First</h3>
                    <p class="value-text" style="color: #581c87;">We prioritize the safety, privacy, and success of women in every decision we make, creating a truly safe digital space.</p>
                </div>
            </div>

            <div class="col-lg-3 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
                <div class="value-card" style="background: #fce7f3; border-color: #fbcfe8;">
                    <div class="value-icon icon-pink" style="background: white;">
                        <ion-icon name="shield-checkmark-outline"></ion-icon>
                    </div>
                    <h3 class="value-title" style="color: #9d174d;">Privacy Centric</h3>
                    <p class="value-text" style="color: #831843;">Your data is yours. We employ enterprise-grade security and strict privacy controls to protect your identity.</p>
                </div>
            </div>

            <div class="col-lg-3 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.2s">
                <div class="value-card" style="background: #e0f2fe; border-color: #bae6fd;">
                    <div class="value-icon icon-blue" style="background: white;">
                        <ion-icon name="trending-up-outline"></ion-icon>
                    </div>
                    <h3 class="value-title" style="color: #0369a1;">Economic Power</h3>
                    <p class="value-text" style="color: #075985;">We focus on tangible outcomes: jobs secured, income increased, and wealth built through smart orchestration.</p>
                </div>
            </div>

            <div class="col-lg-3 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.3s">
                <div class="value-card" style="background: #dcfce7; border-color: #bbf7d0;">
                    <div class="value-icon icon-green" style="background: white;">
                        <ion-icon name="people-outline"></ion-icon>
                    </div>
                    <h3 class="value-title" style="color: #15803d;">Community</h3>
                    <p class="value-text" style="color: #166534;">We believe in the power of connection. When women support women, incredible things happen.</p>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- Reviews Section -->
@include('frontend.home.sections.review-section')

<!-- CTA Section -->
<section class="section-box mt-50 mb-50">
    <div class="container">
        <div class="box-newsletter" style="background: linear-gradient(135deg, #9333ea 0%, #db2777 100%); border-radius: 30px; padding: 60px 40px; text-align: center; color: white;">
            <div class="row">
                <div class="col-xl-8 col-12 mx-auto">
                    <h2 class="mb-20" style="color: white; font-size: 2.5rem;">Ready to join the movement?</h2>
                    <p class="font-lg mb-30" style="color: rgba(255,255,255,0.9);">Join 850,000+ women building their future with Athena today.</p>
                    <div class="text-center">
                        <a href="{{ route('register') }}" class="btn btn-default font-weight-bold" style="background: white; color: #9333ea; border: none; padding: 15px 40px; border-radius: 50px; font-size: 1.1rem;">
                            Get Started Now
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

@endsection
