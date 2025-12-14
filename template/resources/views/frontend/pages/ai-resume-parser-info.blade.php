@extends('frontend.layouts.master')

@section('contents')
<style>
    /* Athena AI Resume Parser Custom Styles */
    .parser-hero {
        background: linear-gradient(135deg, #faf5ff 0%, #ffffff 50%, #f3e8ff 100%);
        padding: 80px 0;
        position: relative;
        overflow: hidden;
        text-align: center;
    }

    .parser-hero::before {
        content: '';
        position: absolute;
        top: -50px;
        left: -50px;
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .hero-badge {
        display: inline-block;
        padding: 8px 16px;
        background: #f3e8ff;
        border: 1px solid #a855f7;
        border-radius: 100px;
        color: #7e22ce;
        font-weight: 600;
        font-size: 0.9rem;
        margin-bottom: 24px;
        box-shadow: 0 4px 15px rgba(126, 34, 206, 0.1);
        position: relative;
        z-index: 1;
    }

    .hero-title {
        font-size: 3.5rem;
        font-weight: 800;
        line-height: 1.2;
        background: linear-gradient(to right, #a855f7, #9333ea);
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

    .feature-box {
        background: white;
        padding: 30px;
        border-radius: 20px;
        border: 1px solid #f3e8ff;
        text-align: center;
        transition: all 0.3s ease;
        height: 100%;
    }

    .feature-box:hover {
        transform: translateY(-5px);
        box-shadow: 0 15px 30px rgba(147, 51, 234, 0.1);
        border-color: #d8b4fe;
    }

    .feature-icon {
        font-size: 2.5rem;
        color: #9333ea;
        margin-bottom: 20px;
    }

    .upload-demo {
        border: 2px dashed #d8b4fe;
        background: #faf5ff;
        border-radius: 20px;
        padding: 40px;
        text-align: center;
        margin-top: 40px;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .upload-demo:hover {
        background: #f3e8ff;
        border-color: #a855f7;
    }
</style>

<!-- Hero Section -->
<section class="parser-hero">
    <div class="container">
        <span class="hero-badge wow animate__animated animate__fadeInDown">
            <ion-icon name="document-text-outline" style="vertical-align: middle; margin-right: 5px;"></ion-icon>
            Beat the ATS
        </span>
        <h1 class="hero-title wow animate__animated animate__fadeInUp">
            Resume Parser
        </h1>
        <p class="hero-subtitle wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
            Don't let a robot reject your application. Our parser analyzes your resume just like an Applicant Tracking System, giving you instant feedback to improve your score.
        </p>

        <div class="row justify-content-center mt-50">
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0s">
                <div class="feature-box">
                    <div class="feature-icon"><ion-icon name="scan-outline"></ion-icon></div>
                    <h3 style="font-weight: 700; margin-bottom: 10px;">Instant Scan</h3>
                    <p style="color: #64748b;">Upload your PDF or DOCX and get a detailed breakdown of your skills, experience, and formatting in seconds.</p>
                </div>
            </div>
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
                <div class="feature-box">
                    <div class="feature-icon"><ion-icon name="checkmark-done-circle-outline"></ion-icon></div>
                    <h3 style="font-weight: 700; margin-bottom: 10px;">Keyword Optimization</h3>
                    <p style="color: #64748b;">Identify missing keywords from job descriptions to ensure your resume gets flagged for the right reasons.</p>
                </div>
            </div>
            <div class="col-lg-4 col-md-6 mb-30 wow animate__animated animate__fadeInUp" data-wow-delay="0.2s">
                <div class="feature-box">
                    <div class="feature-icon"><ion-icon name="construct-outline"></ion-icon></div>
                    <h3 style="font-weight: 700; margin-bottom: 10px;">Smart Formatting</h3>
                    <p style="color: #64748b;">Detect layout issues that might confuse parsing software, ensuring your profile is read correctly every time.</p>
                </div>
            </div>
        </div>

        <div class="upload-demo wow animate__animated animate__fadeInUp">
            <ion-icon name="cloud-upload-outline" style="font-size: 3rem; color: #a855f7; margin-bottom: 15px;"></ion-icon>
            <h3 style="font-weight: 700; color: #4c1d95;">Try it now</h3>
            <p style="color: #6b7280;">Drop your resume here to see a sample analysis (Demo Mode)</p>
        </div>
    </div>
</section>

@endsection
