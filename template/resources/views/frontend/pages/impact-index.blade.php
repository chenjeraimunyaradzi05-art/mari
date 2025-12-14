@extends('frontend.layouts.master')

@section('contents')
<style>
    /* Athena Impact Index Custom Styles */
    .impact-hero {
        background: linear-gradient(135deg, #fdf4ff 0%, #ffffff 50%, #fae8ff 100%);
        padding: 80px 0;
        position: relative;
        overflow: hidden;
        text-align: center;
    }

    .impact-hero::before {
        content: '';
        position: absolute;
        top: -50px;
        right: -50px;
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(216, 180, 254, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .impact-hero::after {
        content: '';
        position: absolute;
        bottom: -50px;
        left: -50px;
        width: 400px;
        height: 400px;
        background: radial-gradient(circle, rgba(232, 121, 249, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .hero-badge {
        display: inline-block;
        padding: 8px 16px;
        background: #f5d0fe;
        border: 1px solid #e879f9;
        border-radius: 100px;
        color: #a21caf;
        font-weight: 600;
        font-size: 0.9rem;
        margin-bottom: 24px;
        box-shadow: 0 4px 15px rgba(162, 28, 175, 0.1);
        position: relative;
        z-index: 1;
    }

    .hero-title {
        font-size: 3.5rem;
        font-weight: 800;
        line-height: 1.2;
        background: linear-gradient(to right, #9333ea, #c026d3);
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

    .stat-card {
        background: white;
        padding: 40px 30px;
        border-radius: 24px;
        border: 1px solid #e2e8f0;
        text-align: center;
        transition: all 0.3s ease;
        height: 100%;
    }

    .stat-card:hover {
        transform: translateY(-10px);
        box-shadow: 0 20px 40px -10px rgba(147, 51, 234, 0.1);
        border-color: #d8b4fe;
    }

    .stat-number {
        font-size: 3.5rem;
        font-weight: 800;
        background: linear-gradient(135deg, #9333ea 0%, #db2777 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 10px;
        line-height: 1;
    }

    .stat-label {
        font-size: 1.1rem;
        font-weight: 600;
        color: #475569;
        margin-bottom: 5px;
    }

    .stat-desc {
        font-size: 0.9rem;
        color: #94a3b8;
    }

    .impact-story-section {
        padding: 80px 0;
        background: #fdf4ff;
    }

    .story-card {
        background: white;
        border-radius: 20px;
        padding: 30px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.05);
        margin-bottom: 30px;
    }

    .story-quote {
        font-size: 1.2rem;
        font-style: italic;
        color: #334155;
        margin-bottom: 20px;
        line-height: 1.6;
    }

    .story-author {
        display: flex;
        align-items: center;
        gap: 15px;
    }

    .author-img {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: #e2e8f0;
    }
</style>

<!-- Hero Section -->
<section class="impact-hero">
    <div class="container">
        <span class="hero-badge wow animate__animated animate__fadeInDown">
            <ion-icon name="pulse-outline" style="vertical-align: middle; margin-right: 5px;"></ion-icon>
            Measuring Success
        </span>
        <h1 class="hero-title wow animate__animated animate__fadeInUp">
            Our Impact Index
        </h1>
        <p class="hero-subtitle wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
            We believe in transparency and results. Here's how the Athena platform is driving real economic change for women across the globe.
        </p>
    </div>
</section>

<!-- Stats Grid -->
<section class="section-box mt-50 mb-50">
    <div class="container">
        <div class="row">
            <div class="col-lg-3 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0s">
                <div class="stat-card">
                    <div class="stat-number">50k+</div>
                    <div class="stat-label">Members</div>
                    <div class="stat-desc">Active women on the platform</div>
                </div>
            </div>
            <div class="col-lg-3 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
                <div class="stat-card">
                    <div class="stat-number">$12M</div>
                    <div class="stat-label">Economic Value</div>
                    <div class="stat-desc">Generated through jobs & grants</div>
                </div>
            </div>
            <div class="col-lg-3 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.2s">
                <div class="stat-card">
                    <div class="stat-number">15k</div>
                    <div class="stat-label">Jobs Filled</div>
                    <div class="stat-desc">Connecting talent with opportunity</div>
                </div>
            </div>
            <div class="col-lg-3 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.3s">
                <div class="stat-card">
                    <div class="stat-number">98%</div>
                    <div class="stat-label">Satisfaction</div>
                    <div class="stat-desc">Member retention rate</div>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- Stories Section -->
<section class="impact-story-section">
    <div class="container">
        <div class="text-center mb-50">
            <h2 style="font-size: 2.5rem; font-weight: 800; color: #1e293b;">Real Stories, Real Impact</h2>
        </div>
        <div class="row">
            <div class="col-lg-6 wow animate__animated animate__fadeInLeft">
                <div class="story-card">
                    <p class="story-quote">"Athena helped me pivot from a stagnant administrative role to a thriving career in Data Science. The mentorship and course recommendations were life-changing."</p>
                    <div class="story-author">
                        <div class="author-img" style="background-image: url('https://placehold.co/100x100/e9d5ff/9333ea?text=EM'); background-size: cover;"></div>
                        <div>
                            <h5 style="margin: 0; font-weight: 700; color: #1e293b;">Elena M.</h5>
                            <span style="font-size: 0.9rem; color: #64748b;">Data Scientist</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-lg-6 wow animate__animated animate__fadeInRight">
                <div class="story-card">
                    <p class="story-quote">"Securing a small business grant through the Athena platform allowed me to open my second bakery location. The process was seamless and supportive."</p>
                    <div class="story-author">
                        <div class="author-img" style="background-image: url('https://placehold.co/100x100/fbcfe8/db2777?text=RJ'); background-size: cover;"></div>
                        <div>
                            <h5 style="margin: 0; font-weight: 700; color: #1e293b;">Rachel J.</h5>
                            <span style="font-size: 0.9rem; color: #64748b;">Business Owner</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

@endsection
