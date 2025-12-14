@extends('frontend.layouts.master')

@section('contents')
<style>
    /* Athena AI Job Match Custom Styles */
    .match-hero {
        background: linear-gradient(135deg, #f5f3ff 0%, #ffffff 50%, #ede9fe 100%);
        padding: 80px 0;
        position: relative;
        overflow: hidden;
        text-align: center;
    }

    .match-hero::before {
        content: '';
        position: absolute;
        top: -50px;
        left: -50px;
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
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

    .match-card {
        background: white;
        border-radius: 20px;
        padding: 25px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.05);
        border: 1px solid #ddd6fe;
        position: relative;
        overflow: hidden;
    }

    .match-score {
        position: absolute;
        top: 20px;
        right: 20px;
        background: #dcfce7;
        color: #15803d;
        font-weight: 700;
        padding: 5px 12px;
        border-radius: 100px;
        font-size: 0.9rem;
    }

    .company-logo {
        width: 50px;
        height: 50px;
        background: #f3f4f6;
        border-radius: 12px;
        margin-bottom: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #9ca3af;
    }
</style>

<!-- Hero Section -->
<section class="match-hero">
    <div class="container">
        <span class="hero-badge wow animate__animated animate__fadeInDown">
            <ion-icon name="git-network-outline" style="vertical-align: middle; margin-right: 5px;"></ion-icon>
            Stop Searching, Start Matching
        </span>
        <h1 class="hero-title wow animate__animated animate__fadeInUp">
            Smart Job Match
        </h1>
        <p class="hero-subtitle wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
            We don't just match keywords. We match culture, values, and flexibility needs to find roles where you'll truly thrive.
        </p>
    </div>
</section>

<!-- Matches Preview -->
<section class="section-box mt-50 mb-50">
    <div class="container">
        <div class="row">
            <div class="col-lg-4 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0s">
                <div class="match-card">
                    <div class="match-score">98% Match</div>
                    <div class="company-logo"><ion-icon name="business" style="font-size: 1.5rem;"></ion-icon></div>
                    <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 5px;">Product Manager</h3>
                    <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 15px;">TechCorp Inc. • Remote</p>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <span style="font-size: 0.8rem; background: #f3f4f6; padding: 4px 10px; border-radius: 6px; color: #4b5563;">Flexible Hours</span>
                        <span style="font-size: 0.8rem; background: #f3f4f6; padding: 4px 10px; border-radius: 6px; color: #4b5563;">Female Leadership</span>
                    </div>
                </div>
            </div>
            <div class="col-lg-4 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
                <div class="match-card">
                    <div class="match-score">94% Match</div>
                    <div class="company-logo"><ion-icon name="business" style="font-size: 1.5rem;"></ion-icon></div>
                    <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 5px;">Senior UX Researcher</h3>
                    <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 15px;">Design Studio • Hybrid</p>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <span style="font-size: 0.8rem; background: #f3f4f6; padding: 4px 10px; border-radius: 6px; color: #4b5563;">Mentorship</span>
                        <span style="font-size: 0.8rem; background: #f3f4f6; padding: 4px 10px; border-radius: 6px; color: #4b5563;">Paid Parental Leave</span>
                    </div>
                </div>
            </div>
            <div class="col-lg-4 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.2s">
                <div class="match-card" style="background: #f5f3ff; border: 2px dashed #8b5cf6; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
                    <ion-icon name="add-circle-outline" style="font-size: 3rem; color: #8b5cf6; margin-bottom: 15px;"></ion-icon>
                    <h3 style="font-size: 1.2rem; font-weight: 700; color: #6d28d9;">Your Perfect Role</h3>
                    <p style="color: #64748b; font-size: 0.9rem;">Create your profile to see your matches.</p>
                    <a href="{{ route('register') }}" style="color: #7c3aed; font-weight: 600; text-decoration: none;">Get Started &rarr;</a>
                </div>
            </div>
        </div>
    </div>
</section>

@endsection
