@extends('frontend.layouts.master')

@section('contents')
<style>
    /* Athena Help Center Custom Styles */
    .help-hero {
        background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
        padding: 100px 0;
        position: relative;
        overflow: hidden;
        text-align: center;
        color: white;
    }

    .help-hero::before {
        content: '';
        position: absolute;
        top: -50px;
        right: -50px;
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .help-hero::after {
        content: '';
        position: absolute;
        bottom: -50px;
        left: -50px;
        width: 400px;
        height: 400px;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .hero-title {
        font-size: 3rem;
        font-weight: 800;
        margin-bottom: 20px;
        position: relative;
        z-index: 1;
    }

    .hero-subtitle {
        font-size: 1.2rem;
        opacity: 0.9;
        margin-bottom: 40px;
        max-width: 600px;
        margin-left: auto;
        margin-right: auto;
        position: relative;
        z-index: 1;
    }

    .search-box {
        position: relative;
        max-width: 600px;
        margin: 0 auto;
        z-index: 1;
    }

    .search-input {
        width: 100%;
        padding: 20px 60px 20px 30px;
        border-radius: 50px;
        border: none;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        font-size: 1.1rem;
        outline: none;
    }

    .search-btn {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        background: #0891b2;
        color: white;
        border: none;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        cursor: pointer;
        transition: background 0.3s ease;
    }

    .search-btn:hover {
        background: #0e7490;
    }

    .category-card {
        background: white;
        padding: 30px;
        border-radius: 20px;
        border: 1px solid #e2e8f0;
        text-align: center;
        transition: all 0.3s ease;
        height: 100%;
    }

    .category-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 20px 40px -10px rgba(8, 145, 178, 0.1);
        border-color: #67e8f9;
    }

    .category-icon {
        width: 70px;
        height: 70px;
        background: #ecfeff;
        color: #0891b2;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        margin: 0 auto 20px;
        transition: all 0.3s ease;
    }

    .category-card:hover .category-icon {
        background: #0891b2;
        color: white;
    }

    .category-title {
        font-size: 1.25rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 10px;
    }

    .category-desc {
        color: #64748b;
        font-size: 0.95rem;
        margin-bottom: 0;
    }

    .faq-section {
        padding: 80px 0;
        background: #f8fafc;
    }

    .faq-item {
        background: white;
        border-radius: 16px;
        padding: 25px;
        margin-bottom: 20px;
        border: 1px solid #e2e8f0;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .faq-item:hover {
        border-color: #0891b2;
    }

    .faq-question {
        font-size: 1.1rem;
        font-weight: 700;
        color: #334155;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .faq-answer {
        margin-top: 15px;
        color: #64748b;
        line-height: 1.6;
        display: none; /* Hidden by default, would need JS to toggle */
    }
</style>

<!-- Hero Section -->
<section class="help-hero">
    <div class="container">
        <h1 class="hero-title wow animate__animated animate__fadeInUp">
            How can we help you?
        </h1>
        <p class="hero-subtitle wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
            Search our knowledge base or browse categories below to find the answers you need.
        </p>
        <div class="search-box wow animate__animated animate__fadeInUp" data-wow-delay="0.2s">
            <input type="text" class="search-input" placeholder="Search for articles, guides, and more...">
            <button class="search-btn">
                <ion-icon name="search-outline"></ion-icon>
            </button>
        </div>
    </div>
</section>

<!-- Categories Grid -->
<section class="section-box mt-50 mb-50">
    <div class="container">
        <div class="row">
            <div class="col-lg-3 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0s">
                <div class="category-card">
                    <div class="category-icon">
                        <ion-icon name="person-outline"></ion-icon>
                    </div>
                    <h3 class="category-title">Account & Profile</h3>
                    <p class="category-desc">Managing your account settings, password, and profile details.</p>
                </div>
            </div>

            <div class="col-lg-3 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
                <div class="category-card">
                    <div class="category-icon">
                        <ion-icon name="card-outline"></ion-icon>
                    </div>
                    <h3 class="category-title">Billing & Payments</h3>
                    <p class="category-desc">Invoices, payment methods, and subscription plans.</p>
                </div>
            </div>

            <div class="col-lg-3 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.2s">
                <div class="category-card">
                    <div class="category-icon">
                        <ion-icon name="briefcase-outline"></ion-icon>
                    </div>
                    <h3 class="category-title">Jobs & Careers</h3>
                    <p class="category-desc">Applying for jobs, resume builder, and career insights.</p>
                </div>
            </div>

            <div class="col-lg-3 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.3s">
                <div class="category-card">
                    <div class="category-icon">
                        <ion-icon name="shield-checkmark-outline"></ion-icon>
                    </div>
                    <h3 class="category-title">Privacy & Safety</h3>
                    <p class="category-desc">Data protection, reporting issues, and community guidelines.</p>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- Contact CTA -->
<section class="section-box mb-80">
    <div class="container">
        <div class="text-center" style="background: #ecfeff; padding: 60px; border-radius: 24px; border: 1px solid #cffafe;">
            <h2 style="font-size: 2rem; font-weight: 700; color: #0e7490; margin-bottom: 15px;">Still need help?</h2>
            <p style="color: #475569; margin-bottom: 30px; font-size: 1.1rem;">
                Our support team is available 24/7 to assist you with any questions or issues.
            </p>
            <a href="{{ route('contact.index') }}" class="btn btn-default" style="background: #0891b2; color: white; padding: 12px 30px; border-radius: 50px; font-weight: 600; text-decoration: none; transition: all 0.3s ease; box-shadow: 0 10px 20px -5px rgba(8, 145, 178, 0.3);">
                Contact Support
            </a>
        </div>
    </div>
</section>

@endsection
