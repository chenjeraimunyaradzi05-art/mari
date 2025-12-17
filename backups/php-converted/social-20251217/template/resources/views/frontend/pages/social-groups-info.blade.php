@extends('frontend.layouts.master')

@section('contents')
<style>
    /* Athena Social Groups Info Custom Styles */
    .groups-hero {
        background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 50%, #dcfce7 100%);
        padding: 80px 0;
        position: relative;
        overflow: hidden;
        text-align: center;
    }

    .groups-hero::before {
        content: '';
        position: absolute;
        top: -50px;
        right: -50px;
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(74, 222, 128, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .hero-badge {
        display: inline-block;
        padding: 8px 16px;
        background: #dcfce7;
        border: 1px solid #4ade80;
        border-radius: 100px;
        color: #15803d;
        font-weight: 600;
        font-size: 0.9rem;
        margin-bottom: 24px;
        box-shadow: 0 4px 15px rgba(21, 128, 61, 0.1);
        position: relative;
        z-index: 1;
    }

    .hero-title {
        font-size: 3.5rem;
        font-weight: 800;
        line-height: 1.2;
        background: linear-gradient(to right, #16a34a, #15803d);
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

    .group-card {
        background: white;
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0,0,0,0.05);
        transition: all 0.3s ease;
        height: 100%;
        border: 1px solid #f0fdf4;
    }

    .group-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 20px 40px rgba(22, 163, 74, 0.1);
    }

    .group-img {
        height: 160px;
        background-size: cover;
        background-position: center;
        position: relative;
    }

    .group-content {
        padding: 25px;
    }

    .group-tag {
        font-size: 0.8rem;
        font-weight: 600;
        color: #16a34a;
        background: #dcfce7;
        padding: 4px 10px;
        border-radius: 6px;
        display: inline-block;
        margin-bottom: 10px;
    }

    .group-title {
        font-size: 1.25rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 10px;
    }

    .group-members {
        display: flex;
        align-items: center;
        gap: 5px;
        color: #64748b;
        font-size: 0.9rem;
    }
</style>

<!-- Hero Section -->
<section class="groups-hero">
    <div class="container">
        <span class="hero-badge wow animate__animated animate__fadeInDown">
            <ion-icon name="people-circle-outline" style="vertical-align: middle; margin-right: 5px;"></ion-icon>
            Find Your Tribe
        </span>
        <h1 class="hero-title wow animate__animated animate__fadeInUp">
            Groups & Circles
        </h1>
        <p class="hero-subtitle wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
            Connect deeply with smaller communities based on your location, career, interests, or life stage.
        </p>
    </div>
</section>

<!-- Groups Showcase -->
<section class="section-box mt-50 mb-50">
    <div class="container">
        <div class="row">
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0s">
                <div class="group-card">
                    <div class="group-img" style="background-color: #bbf7d0;"></div>
                    <div class="group-content">
                        <span class="group-tag">Professional</span>
                        <h3 class="group-title">Women in Tech</h3>
                        <div class="group-members">
                            <ion-icon name="people"></ion-icon> 12.5k Members
                        </div>
                        <p class="mt-15" style="color: #64748b; font-size: 0.95rem;">Coding, design, and leadership advice for women in the technology sector.</p>
                    </div>
                </div>
            </div>
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
                <div class="group-card">
                    <div class="group-img" style="background-color: #86efac;"></div>
                    <div class="group-content">
                        <span class="group-tag">Lifestyle</span>
                        <h3 class="group-title">Wellness Warriors</h3>
                        <div class="group-members">
                            <ion-icon name="people"></ion-icon> 8.2k Members
                        </div>
                        <p class="mt-15" style="color: #64748b; font-size: 0.95rem;">Daily yoga challenges, meditation tips, and healthy living support.</p>
                    </div>
                </div>
            </div>
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.2s">
                <div class="group-card">
                    <div class="group-img" style="background-color: #4ade80;"></div>
                    <div class="group-content">
                        <span class="group-tag">Local</span>
                        <h3 class="group-title">Sydney Startups</h3>
                        <div class="group-members">
                            <ion-icon name="people"></ion-icon> 3.1k Members
                        </div>
                        <p class="mt-15" style="color: #64748b; font-size: 0.95rem;">Connect with founders, investors, and mentors in the Sydney area.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

@endsection
