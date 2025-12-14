@extends('frontend.layouts.master')

@section('contents')
<style>
    /* Athena AI Career Insights Custom Styles */
    .insights-hero {
        background: linear-gradient(135deg, #fdf4ff 0%, #ffffff 50%, #fae8ff 100%);
        padding: 80px 0;
        position: relative;
        overflow: hidden;
        text-align: center;
    }

    .insights-hero::before {
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

    .hero-badge {
        display: inline-block;
        padding: 8px 16px;
        background: #fdf4ff;
        border: 1px solid #c084fc;
        border-radius: 100px;
        color: #9333ea;
        font-weight: 600;
        font-size: 0.9rem;
        margin-bottom: 24px;
        box-shadow: 0 4px 15px rgba(147, 51, 234, 0.1);
        position: relative;
        z-index: 1;
    }

    .hero-title {
        font-size: 3.5rem;
        font-weight: 800;
        line-height: 1.2;
        background: linear-gradient(to right, #c026d3, #9333ea);
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

    .chart-card {
        background: white;
        border-radius: 24px;
        padding: 30px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.05);
        border: 1px solid #f0abfc;
        margin-bottom: 30px;
    }

    .stat-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        padding-bottom: 15px;
        border-bottom: 1px solid #f3f4f6;
    }

    .stat-row:last-child {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
    }

    .trend-up {
        color: #16a34a;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 5px;
    }
</style>

<!-- Hero Section -->
<section class="insights-hero">
    <div class="container">
        <span class="hero-badge wow animate__animated animate__fadeInDown">
            <ion-icon name="trending-up-outline" style="vertical-align: middle; margin-right: 5px;"></ion-icon>
            Data-Driven Growth
        </span>
        <h1 class="hero-title wow animate__animated animate__fadeInUp">
            Career Insights
        </h1>
        <p class="hero-subtitle wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
            Stop guessing what your skills are worth. Access real-time salary data, demand trends, and skill gap analyses tailored to your profile.
        </p>
    </div>
</section>

<!-- Data Visualization Section -->
<section class="section-box mt-50 mb-50">
    <div class="container">
        <div class="row align-items-center">
            <div class="col-lg-6 wow animate__animated animate__fadeInLeft">
                <div class="chart-card">
                    <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 20px; color: #1e293b;">Market Demand: UX Design</h3>
                    <div class="stat-row">
                        <span style="color: #64748b;">Average Salary</span>
                        <span style="font-weight: 700; color: #1e293b;">$115,000</span>
                    </div>
                    <div class="stat-row">
                        <span style="color: #64748b;">YoY Growth</span>
                        <span class="trend-up"><ion-icon name="arrow-up-outline"></ion-icon> 12%</span>
                    </div>
                    <div class="stat-row">
                        <span style="color: #64748b;">Top Skill Gap</span>
                        <span style="color: #d946ef; font-weight: 600;">Figma Prototyping</span>
                    </div>
                    <div style="margin-top: 20px; height: 150px; background: #fdf4ff; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #c026d3;">
                        <ion-icon name="bar-chart-outline" style="font-size: 3rem;"></ion-icon>
                    </div>
                </div>
            </div>
            <div class="col-lg-6 wow animate__animated animate__fadeInRight">
                <h2 style="font-size: 2rem; font-weight: 800; margin-bottom: 20px; color: #1e293b;">Know Your Worth</h2>
                <p style="font-size: 1.1rem; color: #475569; line-height: 1.6; margin-bottom: 30px;">
                    Our AI analyzes millions of job postings to give you the most accurate picture of the market.
                </p>
                <ul style="list-style: none; padding: 0;">
                    <li style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px; color: #334155;">
                        <ion-icon name="checkmark-circle" style="color: #9333ea; font-size: 1.2rem;"></ion-icon>
                        Salary benchmarks by location and experience
                    </li>
                    <li style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px; color: #334155;">
                        <ion-icon name="checkmark-circle" style="color: #9333ea; font-size: 1.2rem;"></ion-icon>
                        Emerging skill trends in your industry
                    </li>
                    <li style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px; color: #334155;">
                        <ion-icon name="checkmark-circle" style="color: #9333ea; font-size: 1.2rem;"></ion-icon>
                        Personalized learning path recommendations
                    </li>
                </ul>
                <a href="{{ route('register') }}" class="btn btn-default btn-shadow hover-up mt-20" style="background: #9333ea; border-color: #9333ea;">Unlock My Insights</a>
            </div>
        </div>
    </div>
</section>

@endsection
