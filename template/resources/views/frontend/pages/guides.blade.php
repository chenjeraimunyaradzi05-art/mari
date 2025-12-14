@extends('frontend.layouts.master')

@section('contents')
<style>
    /* Athena Guides Custom Styles */
    .guides-hero {
        background: linear-gradient(135deg, #ecfeff 0%, #ffffff 50%, #f0f9ff 100%);
        padding: 80px 0;
        position: relative;
        overflow: hidden;
        text-align: center;
    }

    .guides-hero::before {
        content: '';
        position: absolute;
        top: -50px;
        right: -50px;
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .guides-hero::after {
        content: '';
        position: absolute;
        bottom: -50px;
        left: -50px;
        width: 400px;
        height: 400px;
        background: radial-gradient(circle, rgba(14, 165, 233, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .hero-badge {
        display: inline-block;
        padding: 8px 16px;
        background: #cffafe;
        border: 1px solid #67e8f9;
        border-radius: 100px;
        color: #0891b2;
        font-weight: 600;
        font-size: 0.9rem;
        margin-bottom: 24px;
        box-shadow: 0 4px 15px rgba(8, 145, 178, 0.1);
        position: relative;
        z-index: 1;
    }

    .hero-title {
        font-size: 3.5rem;
        font-weight: 800;
        line-height: 1.2;
        background: linear-gradient(to right, #0e7490, #0284c7);
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

    .guide-card {
        background: white;
        border-radius: 24px;
        overflow: hidden;
        transition: all 0.3s ease;
        border: 1px solid #e2e8f0;
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    .guide-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 20px 40px -10px rgba(8, 145, 178, 0.1);
        border-color: #67e8f9;
    }

    .guide-image {
        height: 200px;
        background: #e0f2fe;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #0284c7;
        font-size: 3rem;
    }

    .guide-content {
        padding: 30px;
        flex-grow: 1;
        display: flex;
        flex-direction: column;
    }

    .guide-tag {
        display: inline-block;
        padding: 4px 12px;
        background: #ecfeff;
        color: #0891b2;
        border-radius: 50px;
        font-size: 0.8rem;
        font-weight: 600;
        margin-bottom: 15px;
        width: fit-content;
    }

    .guide-title {
        font-size: 1.25rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 10px;
        line-height: 1.4;
    }

    .guide-desc {
        color: #64748b;
        font-size: 0.95rem;
        margin-bottom: 20px;
        flex-grow: 1;
    }

    .btn-read-guide {
        color: #0891b2;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 5px;
        transition: gap 0.3s ease;
    }

    .btn-read-guide:hover {
        gap: 10px;
        color: #0e7490;
    }
</style>

<!-- Hero Section -->
<section class="guides-hero">
    <div class="container">
        <span class="hero-badge wow animate__animated animate__fadeInDown">
            <ion-icon name="book-outline" style="vertical-align: middle; margin-right: 5px;"></ion-icon>
            Knowledge Base
        </span>
        <h1 class="hero-title wow animate__animated animate__fadeInUp">
            Guides & Playbooks
        </h1>
        <p class="hero-subtitle wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
            Expert-led guides to help you navigate your career, finances, and business growth. Actionable advice for every stage of your journey.
        </p>
    </div>
</section>

<!-- Guides Grid -->
<section class="section-box mt-50 mb-50">
    <div class="container">
        <div class="row">
            <!-- Guide 1 -->
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0s">
                <div class="guide-card">
                    <div class="guide-image">
                        <ion-icon name="rocket-outline"></ion-icon>
                    </div>
                    <div class="guide-content">
                        <span class="guide-tag">Career Growth</span>
                        <h3 class="guide-title">The Ultimate Career Transition Playbook</h3>
                        <p class="guide-desc">A step-by-step guide to pivoting your career, updating your resume, and acing interviews in a new industry.</p>
                        <a href="#" class="btn-read-guide">Read Guide <ion-icon name="arrow-forward-outline"></ion-icon></a>
                    </div>
                </div>
            </div>

            <!-- Guide 2 -->
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
                <div class="guide-card">
                    <div class="guide-image">
                        <ion-icon name="wallet-outline"></ion-icon>
                    </div>
                    <div class="guide-content">
                        <span class="guide-tag">Financial Wellness</span>
                        <h3 class="guide-title">Mastering Your Personal Budget</h3>
                        <p class="guide-desc">Learn how to create a budget that works for you, save for goals, and manage debt effectively.</p>
                        <a href="#" class="btn-read-guide">Read Guide <ion-icon name="arrow-forward-outline"></ion-icon></a>
                    </div>
                </div>
            </div>

            <!-- Guide 3 -->
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.2s">
                <div class="guide-card">
                    <div class="guide-image">
                        <ion-icon name="briefcase-outline"></ion-icon>
                    </div>
                    <div class="guide-content">
                        <span class="guide-tag">Business</span>
                        <h3 class="guide-title">Starting Your First Business</h3>
                        <p class="guide-desc">From idea to launch: everything you need to know about legal structures, funding, and finding your first customers.</p>
                        <a href="#" class="btn-read-guide">Read Guide <ion-icon name="arrow-forward-outline"></ion-icon></a>
                    </div>
                </div>
            </div>

             <!-- Guide 4 -->
             <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.3s">
                <div class="guide-card">
                    <div class="guide-image">
                        <ion-icon name="home-outline"></ion-icon>
                    </div>
                    <div class="guide-content">
                        <span class="guide-tag">Housing</span>
                        <h3 class="guide-title">First-Time Home Buyer's Guide</h3>
                        <p class="guide-desc">Navigating the property market, understanding mortgages, and securing your dream home.</p>
                        <a href="#" class="btn-read-guide">Read Guide <ion-icon name="arrow-forward-outline"></ion-icon></a>
                    </div>
                </div>
            </div>

            <!-- Guide 5 -->
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.4s">
                <div class="guide-card">
                    <div class="guide-image">
                        <ion-icon name="school-outline"></ion-icon>
                    </div>
                    <div class="guide-content">
                        <span class="guide-tag">Education</span>
                        <h3 class="guide-title">Upskilling for the Future</h3>
                        <p class="guide-desc">Identify the skills in demand and find the right courses to stay competitive in the job market.</p>
                        <a href="#" class="btn-read-guide">Read Guide <ion-icon name="arrow-forward-outline"></ion-icon></a>
                    </div>
                </div>
            </div>

            <!-- Guide 6 -->
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.5s">
                <div class="guide-card">
                    <div class="guide-image">
                        <ion-icon name="heart-outline"></ion-icon>
                    </div>
                    <div class="guide-content">
                        <span class="guide-tag">Wellness</span>
                        <h3 class="guide-title">Work-Life Balance Strategies</h3>
                        <p class="guide-desc">Practical tips for maintaining your mental and physical health while pursuing your career goals.</p>
                        <a href="#" class="btn-read-guide">Read Guide <ion-icon name="arrow-forward-outline"></ion-icon></a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

@endsection
