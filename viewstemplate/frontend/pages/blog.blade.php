@extends('frontend.layouts.master')

@section('contents')
<style>
    /* Athena Blog Custom Styles */
    .blog-hero {
        background: linear-gradient(135deg, #e0f2fe 0%, #ffffff 50%, #f0f9ff 100%);
        padding: 80px 0;
        position: relative;
        overflow: hidden;
        text-align: center;
    }

    .blog-hero::before {
        content: '';
        position: absolute;
        top: -50px;
        right: -50px;
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(14, 165, 233, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .blog-hero::after {
        content: '';
        position: absolute;
        bottom: -50px;
        left: -50px;
        width: 400px;
        height: 400px;
        background: radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .hero-badge {
        display: inline-block;
        padding: 8px 16px;
        background: #bae6fd;
        border: 1px solid #7dd3fc;
        border-radius: 100px;
        color: #0284c7;
        font-weight: 600;
        font-size: 0.9rem;
        margin-bottom: 24px;
        box-shadow: 0 4px 15px rgba(2, 132, 199, 0.1);
        position: relative;
        z-index: 1;
    }

    .hero-title {
        font-size: 3.5rem;
        font-weight: 800;
        line-height: 1.2;
        background: linear-gradient(to right, #0369a1, #0ea5e9);
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

    .blog-card {
        background: white;
        border-radius: 24px;
        overflow: hidden;
        transition: all 0.3s ease;
        border: 1px solid #e2e8f0;
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    .blog-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 20px 40px -10px rgba(2, 132, 199, 0.1);
        border-color: #7dd3fc;
    }

    .blog-image {
        height: 240px;
        background-color: #e0f2fe;
        background-size: cover;
        background-position: center;
        position: relative;
    }

    .blog-category {
        position: absolute;
        top: 20px;
        left: 20px;
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(10px);
        padding: 6px 14px;
        border-radius: 50px;
        font-size: 0.8rem;
        font-weight: 700;
        color: #0284c7;
    }

    .blog-content {
        padding: 30px;
        flex-grow: 1;
        display: flex;
        flex-direction: column;
    }

    .blog-meta {
        font-size: 0.85rem;
        color: #94a3b8;
        margin-bottom: 15px;
        display: flex;
        align-items: center;
        gap: 15px;
    }

    .blog-meta span {
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .blog-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 15px;
        line-height: 1.3;
        transition: color 0.2s ease;
    }

    .blog-card:hover .blog-title {
        color: #0284c7;
    }

    .blog-excerpt {
        color: #64748b;
        font-size: 1rem;
        margin-bottom: 25px;
        flex-grow: 1;
        line-height: 1.6;
    }

    .blog-author {
        display: flex;
        align-items: center;
        gap: 10px;
        border-top: 1px solid #f1f5f9;
        padding-top: 20px;
    }

    .author-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #cbd5e1;
    }

    .author-info h5 {
        font-size: 0.9rem;
        font-weight: 700;
        color: #334155;
        margin: 0;
    }

    .author-info span {
        font-size: 0.8rem;
        color: #94a3b8;
    }
</style>

<!-- Hero Section -->
<section class="blog-hero">
    <div class="container">
        <span class="hero-badge wow animate__animated animate__fadeInDown">
            <ion-icon name="newspaper-outline" style="vertical-align: middle; margin-right: 5px;"></ion-icon>
            The Athena Blog
        </span>
        <h1 class="hero-title wow animate__animated animate__fadeInUp">
            Stories & Updates
        </h1>
        <p class="hero-subtitle wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
            Stay up to date with the latest news, success stories, and platform updates from the Athena team.
        </p>
    </div>
</section>

<!-- Blog Grid -->
<section class="section-box mt-50 mb-50">
    <div class="container">
        <div class="row">
            <!-- Post 1 -->
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0s">
                <div class="blog-card">
                    <div class="blog-image" style="background-image: url('https://placehold.co/600x400/e0f2fe/0284c7?text=Community');">
                        <span class="blog-category">Community</span>
                    </div>
                    <div class="blog-content">
                        <div class="blog-meta">
                            <span><ion-icon name="calendar-outline"></ion-icon> Nov 28, 2025</span>
                            <span><ion-icon name="time-outline"></ion-icon> 5 min read</span>
                        </div>
                        <h3 class="blog-title">Building a Supportive Community for Women in Tech</h3>
                        <p class="blog-excerpt">How mentorship and peer support networks are changing the landscape for female developers and entrepreneurs.</p>
                        <div class="blog-author">
                            <div class="author-avatar" style="background-image: url('https://placehold.co/100x100/cbd5e1/64748b?text=SJ'); background-size: cover;"></div>
                            <div class="author-info">
                                <h5>Sarah Jenkins</h5>
                                <span>Community Manager</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Post 2 -->
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
                <div class="blog-card">
                    <div class="blog-image" style="background-image: url('https://placehold.co/600x400/f0f9ff/0ea5e9?text=Product');">
                        <span class="blog-category">Product Update</span>
                    </div>
                    <div class="blog-content">
                        <div class="blog-meta">
                            <span><ion-icon name="calendar-outline"></ion-icon> Nov 25, 2025</span>
                            <span><ion-icon name="time-outline"></ion-icon> 3 min read</span>
                        </div>
                        <h3 class="blog-title">Introducing Athena AI Concierge 2.0</h3>
                        <p class="blog-excerpt">Our latest update brings smarter recommendations, faster resume parsing, and personalized career pathing.</p>
                        <div class="blog-author">
                            <div class="author-avatar" style="background-image: url('https://placehold.co/100x100/cbd5e1/64748b?text=MK'); background-size: cover;"></div>
                            <div class="author-info">
                                <h5>Maya Kim</h5>
                                <span>Product Lead</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Post 3 -->
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.2s">
                <div class="blog-card">
                    <div class="blog-image" style="background-image: url('https://placehold.co/600x400/e0f2fe/0369a1?text=Success');">
                        <span class="blog-category">Success Stories</span>
                    </div>
                    <div class="blog-content">
                        <div class="blog-meta">
                            <span><ion-icon name="calendar-outline"></ion-icon> Nov 20, 2025</span>
                            <span><ion-icon name="time-outline"></ion-icon> 4 min read</span>
                        </div>
                        <h3 class="blog-title">From Freelancer to Agency Owner: Jessica's Journey</h3>
                        <p class="blog-excerpt">Jessica shares how she used Athena's business tools to scale her freelance design gig into a full-service agency.</p>
                        <div class="blog-author">
                            <div class="author-avatar" style="background-image: url('https://placehold.co/100x100/cbd5e1/64748b?text=AL'); background-size: cover;"></div>
                            <div class="author-info">
                                <h5>Alex Lee</h5>
                                <span>Content Writer</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

@endsection
