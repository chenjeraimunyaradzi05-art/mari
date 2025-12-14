@extends('frontend.layouts.master')

@section('contents')
<style>
    /* Athena Research Custom Styles */
    .research-hero {
        background: linear-gradient(135deg, #f0fdfa 0%, #ffffff 50%, #ecfeff 100%); /* Teal -> White -> Cyan */
        padding: 80px 0;
        position: relative;
        overflow: hidden;
        text-align: center;
    }

    .research-hero::before {
        content: '';
        position: absolute;
        top: -50px;
        right: -50px;
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(20, 184, 166, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .research-hero::after {
        content: '';
        position: absolute;
        bottom: -50px;
        left: -50px;
        width: 400px;
        height: 400px;
        background: radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .hero-badge {
        display: inline-block;
        padding: 8px 16px;
        background: #ccfbf1;
        border: 1px solid #5eead4;
        border-radius: 100px;
        color: #0d9488;
        font-weight: 600;
        font-size: 0.9rem;
        margin-bottom: 24px;
        box-shadow: 0 4px 15px rgba(13, 148, 136, 0.1);
        position: relative;
        z-index: 1;
    }

    .hero-title {
        font-size: 3.5rem;
        font-weight: 800;
        line-height: 1.2;
        background: linear-gradient(to right, #0f766e, #0891b2);
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

    .report-card {
        background: white;
        border-radius: 24px;
        overflow: hidden;
        transition: all 0.3s ease;
        border: 1px solid #e2e8f0;
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    .report-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 20px 40px -10px rgba(13, 148, 136, 0.1);
        border-color: #5eead4;
    }

    .report-image {
        height: 220px;
        background: #f0fdfa;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
    }

    .report-icon {
        font-size: 4rem;
        color: #0d9488;
        opacity: 0.2;
        position: absolute;
        right: 20px;
        bottom: 20px;
    }

    .report-content {
        padding: 30px;
        flex-grow: 1;
        display: flex;
        flex-direction: column;
    }

    .report-date {
        font-size: 0.85rem;
        color: #94a3b8;
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .report-title {
        font-size: 1.4rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 15px;
        line-height: 1.3;
    }

    .report-desc {
        color: #64748b;
        font-size: 1rem;
        margin-bottom: 25px;
        flex-grow: 1;
    }

    .btn-download {
        background: white;
        color: #0d9488;
        border: 1px solid #0d9488;
        padding: 10px 20px;
        border-radius: 50px;
        font-weight: 600;
        text-align: center;
        transition: all 0.3s ease;
        display: inline-block;
        width: 100%;
    }

    .btn-download:hover {
        background: #0d9488;
        color: white;
        box-shadow: 0 4px 12px rgba(13, 148, 136, 0.2);
    }
</style>

<!-- Hero Section -->
<section class="research-hero">
    <div class="container">
        <span class="hero-badge wow animate__animated animate__fadeInDown">
            <ion-icon name="stats-chart-outline" style="vertical-align: middle; margin-right: 5px;"></ion-icon>
            Data & Insights
        </span>
        <h1 class="hero-title wow animate__animated animate__fadeInUp">
            Research Reports
        </h1>
        <p class="hero-subtitle wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
            In-depth analysis and data-driven insights on economic trends, workforce dynamics, and social impact.
        </p>
    </div>
</section>

<!-- Reports Grid -->
<section class="section-box mt-50 mb-50">
    <div class="container">
        <div class="row">
            <!-- Report 1 -->
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0s">
                <div class="report-card">
                    <div class="report-image">
                        <div style="padding: 30px;">
                            <h4 style="color: #0f766e; font-weight: 800; font-size: 1.5rem;">Future of Work 2025</h4>
                            <span style="background: #ccfbf1; color: #0f766e; padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; margin-top: 10px; display: inline-block;">Annual Report</span>
                        </div>
                        <ion-icon name="pie-chart-outline" class="report-icon"></ion-icon>
                    </div>
                    <div class="report-content">
                        <div class="report-date"><ion-icon name="calendar-outline"></ion-icon> October 2025</div>
                        <h3 class="report-title">The Changing Landscape of Remote Work</h3>
                        <p class="report-desc">Analyzing the long-term impacts of remote and hybrid work models on productivity and employee well-being.</p>
                        <a href="#" class="btn-download">Download PDF</a>
                    </div>
                </div>
            </div>

            <!-- Report 2 -->
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
                <div class="report-card">
                    <div class="report-image">
                        <div style="padding: 30px;">
                            <h4 style="color: #0f766e; font-weight: 800; font-size: 1.5rem;">Gender Pay Gap</h4>
                            <span style="background: #ccfbf1; color: #0f766e; padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; margin-top: 10px; display: inline-block;">Impact Study</span>
                        </div>
                        <ion-icon name="trending-up-outline" class="report-icon"></ion-icon>
                    </div>
                    <div class="report-content">
                        <div class="report-date"><ion-icon name="calendar-outline"></ion-icon> September 2025</div>
                        <h3 class="report-title">Closing the Gap: Progress & Challenges</h3>
                        <p class="report-desc">A comprehensive review of wage equality across industries and actionable steps for organizations.</p>
                        <a href="#" class="btn-download">Download PDF</a>
                    </div>
                </div>
            </div>

            <!-- Report 3 -->
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.2s">
                <div class="report-card">
                    <div class="report-image">
                        <div style="padding: 30px;">
                            <h4 style="color: #0f766e; font-weight: 800; font-size: 1.5rem;">Small Business</h4>
                            <span style="background: #ccfbf1; color: #0f766e; padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; margin-top: 10px; display: inline-block;">Market Analysis</span>
                        </div>
                        <ion-icon name="bar-chart-outline" class="report-icon"></ion-icon>
                    </div>
                    <div class="report-content">
                        <div class="report-date"><ion-icon name="calendar-outline"></ion-icon> August 2025</div>
                        <h3 class="report-title">SME Growth Trends in the Digital Economy</h3>
                        <p class="report-desc">How small businesses are leveraging digital tools to compete in a global marketplace.</p>
                        <a href="#" class="btn-download">Download PDF</a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

@endsection
