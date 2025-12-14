@extends('frontend.layouts.master')

@section('contents')
<style>
    /* Automotive & Mobility Suite Custom Styles */
    .auto-hero {
        background: linear-gradient(135deg, #ecfdf5 0%, #ffffff 50%, #f0fdf4 100%);
        padding: 80px 0;
        position: relative;
        overflow: hidden;
        text-align: center;
    }

    .auto-hero::before {
        content: '';
        position: absolute;
        top: -50px;
        right: -50px;
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, rgba(255, 255, 255, 0) 70%);
        border-radius: 50%;
        z-index: 0;
    }

    .hero-badge {
        display: inline-block;
        padding: 8px 16px;
        background: #ecfdf5;
        border: 1px solid #34d399;
        border-radius: 100px;
        color: #059669;
        font-weight: 600;
        font-size: 0.9rem;
        margin-bottom: 24px;
        box-shadow: 0 4px 15px rgba(5, 150, 105, 0.1);
        position: relative;
        z-index: 1;
    }

    .hero-title {
        font-size: 3.5rem;
        font-weight: 800;
        line-height: 1.2;
        background: linear-gradient(to right, #059669, #10b981);
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

    /* Stats Section */
    .stats-container {
        display: flex;
        justify-content: center;
        gap: 60px;
        margin-bottom: 60px;
        flex-wrap: wrap;
    }

    .stat-item {
        text-align: center;
    }

    .stat-label {
        font-size: 0.95rem;
        color: #64748b;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 5px;
    }

    .stat-value {
        font-size: 2.5rem;
        font-weight: 800;
        color: #059669;
        margin-bottom: 5px;
    }

    .stat-desc {
        font-size: 0.9rem;
        color: #94a3b8;
        max-width: 220px;
        margin: 0 auto;
        line-height: 1.4;
    }

    /* Feature Cards */
    .features-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 30px;
        margin-top: 40px;
    }

    .feature-card {
        background: white;
        border-radius: 24px;
        padding: 30px;
        border: 1px solid #e2e8f0;
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
        height: 100%;
    }

    .feature-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 20px 40px -5px rgba(16, 185, 129, 0.1);
        border-color: #a7f3d0;
    }

    .feature-eyebrow {
        font-size: 0.8rem;
        font-weight: 600;
        color: #059669;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 15px;
        display: block;
    }

    .feature-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 15px;
    }

    .feature-text {
        color: #64748b;
        line-height: 1.6;
        font-size: 1.05rem;
    }

    /* AI Advisor Section */
    .ai-advisor-section {
        background: #f0fdf4;
        padding: 80px 0;
    }

    .steps-container {
        display: flex;
        flex-direction: column;
        gap: 20px;
        max-width: 800px;
        margin: 40px auto;
    }

    .step-item {
        display: flex;
        gap: 20px;
        background: white;
        padding: 25px;
        border-radius: 16px;
        align-items: flex-start;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        border: 1px solid transparent;
        transition: all 0.3s ease;
    }

    .step-item:hover {
        border-color: #a7f3d0;
        transform: translateX(5px);
    }

    .step-number {
        background: #059669;
        color: white;
        width: 35px;
        height: 35px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        flex-shrink: 0;
        font-size: 1.1rem;
    }

    /* Financial Education Desk */
    .fin-ed-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 30px;
    }

    .fin-ed-card {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 20px;
        padding: 30px;
        transition: all 0.3s ease;
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    .fin-ed-card:hover {
        border-color: #34d399;
        box-shadow: 0 10px 30px -5px rgba(16, 185, 129, 0.1);
    }

    .btn-cta {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: #059669;
        color: white;
        padding: 14px 32px;
        border-radius: 100px;
        font-weight: 600;
        text-decoration: none;
        transition: all 0.3s ease;
        margin-top: 20px;
        font-size: 1.1rem;
        box-shadow: 0 4px 12px rgba(5, 150, 105, 0.2);
    }

    .btn-cta:hover {
        background: #047857;
        transform: translateY(-2px);
        color: white;
        box-shadow: 0 8px 20px rgba(5, 150, 105, 0.3);
    }

    .btn-link {
        color: #059669;
        font-weight: 600;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        margin-top: auto; /* Push to bottom */
        padding-top: 20px;
        font-size: 1rem;
    }

    .btn-link:hover {
        text-decoration: underline;
        gap: 8px;
    }
</style>

<!-- Hero Section -->
<section class="auto-hero">
    <div class="container">
        <span class="hero-badge wow animate__animated animate__fadeInDown">
            <ion-icon name="car-sport-outline" style="vertical-align: middle; margin-right: 5px;"></ion-icon>
            Automotive & Mobility Suite
        </span>
        <h1 class="hero-title wow animate__animated animate__fadeInUp">
            AI-guided car buying with financial calm
        </h1>
        <p class="hero-subtitle wow animate__animated animate__fadeInUp" data-wow-delay="0.1s">
            Women-first buying concierge covering new EVs, safe used cars and financing mentors who demystify every signature.
        </p>

        <a href="#" class="btn-cta wow animate__animated animate__fadeInUp" data-wow-delay="0.2s">
            Book a buying consult <ion-icon name="arrow-forward-outline"></ion-icon>
        </a>

        <div class="stats-container wow animate__animated animate__fadeInUp" data-wow-delay="0.3s" style="margin-top: 60px;">
            <div class="stat-item">
                <div class="stat-label">Verified Dealers</div>
                <div class="stat-value">42</div>
                <div class="stat-desc">Only women-safe dealerships with transparent inventory feeds.</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Fin-ed Sessions</div>
                <div class="stat-value">1.3K</div>
                <div class="stat-desc">AI + human workshops recorded in the Money Desk.</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Relief Pool</div>
                <div class="stat-value">$420k</div>
                <div class="stat-desc">Mobility fund ready for rego, tyres, or adaptive tech.</div>
            </div>
        </div>
    </div>
</section>

<!-- Concierge Streams -->
<section class="section-padding" style="padding: 80px 0;">
    <div class="container">
        <div class="features-grid">
            <div class="feature-card">
                <span class="feature-eyebrow">Concierge Stream</span>
                <h3 class="feature-title">New Energy Fleet</h3>
                <p class="feature-text">
                    EV & hybrid vehicles with salary packaging ready and insurance primed for carers.
                </p>
            </div>
            <div class="feature-card">
                <span class="feature-eyebrow">Concierge Stream</span>
                <h3 class="feature-title">Certified Used Collection</h3>
                <p class="feature-text">
                    Safety-audited SUVs and sedans with cost-of-living friendly repayments and warranty cover.
                </p>
            </div>
            <div class="feature-card">
                <span class="feature-eyebrow">Concierge Stream</span>
                <h3 class="feature-title">Motoring Freedom Fund</h3>
                <p class="feature-text">
                    Sponsors co-fund rego, servicing and fuel vouchers when carers or apprentices need transport.
                </p>
            </div>
        </div>
    </div>
</section>

<!-- AI Advisor Section -->
<section class="ai-advisor-section">
    <div class="container">
        <div class="text-center">
            <span style="color: #059669; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">AI Advisor</span>
            <h2 style="font-size: 2.5rem; font-weight: 800; color: #1e293b; margin-top: 10px;">AI Car Guide</h2>
            <p style="max-width: 600px; margin: 10px auto; color: #64748b; font-size: 1.1rem;">
                Concierge blends EV research, DV-safe travel tips, and dealer scripts so women never negotiate alone.
            </p>
        </div>

        <div class="steps-container">
            <div class="step-item">
                <div class="step-number">1</div>
                <div>
                    <h4 style="font-weight: 700; margin-bottom: 5px; font-size: 1.2rem;">Share your needs</h4>
                    <p style="color: #64748b; margin: 0; font-size: 1.05rem;">Share budget, family or carer needs, and preferred ownership model.</p>
                </div>
            </div>
            <div class="step-item">
                <div class="step-number">2</div>
                <div>
                    <h4 style="font-weight: 700; margin-bottom: 5px; font-size: 1.2rem;">AI Analysis</h4>
                    <p style="color: #64748b; margin: 0; font-size: 1.05rem;">AI drafts shortlist with safety badges, insurance estimates, and servicing schedules.</p>
                </div>
            </div>
            <div class="step-item">
                <div class="step-number">3</div>
                <div>
                    <h4 style="font-weight: 700; margin-bottom: 5px; font-size: 1.2rem;">Action Plan</h4>
                    <p style="color: #64748b; margin: 0; font-size: 1.05rem;">Export scripts + comparison sheet to talk with verified dealers or lenders.</p>
                </div>
            </div>
        </div>

        <div class="text-center" style="margin-top: 40px;">
            <a href="{{ route('login') }}" class="btn-cta">
                Sign in to launch coach <ion-icon name="log-in-outline"></ion-icon>
            </a>
            <p style="font-size: 0.9rem; color: #94a3b8; margin-top: 20px;">
                Educational guidance only – we pair you with licensed finance partners for quotes.
            </p>
        </div>
    </div>
</section>

<!-- Financial Education Desk -->
<section class="section-padding" style="padding: 80px 0;">
    <div class="container">
        <div class="text-center mb-5">
            <h2 style="font-size: 2.5rem; font-weight: 800; color: #1e293b;">Financial Education Desk</h2>
            <p style="color: #64748b; font-size: 1.2rem;">Pair every test drive with money clarity</p>
        </div>

        <div class="fin-ed-grid">
            <div class="fin-ed-card">
                <ion-icon name="calculator-outline" style="font-size: 2.5rem; color: #059669; margin-bottom: 20px;"></ion-icon>
                <h3 style="font-size: 1.4rem; font-weight: 700; margin-bottom: 10px;">Operating Cost Planner</h3>
                <p style="color: #64748b; font-size: 1rem; margin-bottom: 20px;">
                    Use the budget dashboard to model repayments, charging, and insurance before test drives.
                </p>
                <a href="{{ route('money.dashboard') }}" class="btn-link">
                    Open budget dashboard <ion-icon name="arrow-forward"></ion-icon>
                </a>
            </div>

            <div class="fin-ed-card">
                <ion-icon name="wallet-outline" style="font-size: 2.5rem; color: #059669; margin-bottom: 20px;"></ion-icon>
                <h3 style="font-size: 1.4rem; font-weight: 700; margin-bottom: 10px;">Money Inbox + Relief Fund</h3>
                <p style="color: #64748b; font-size: 1rem; margin-bottom: 20px;">
                    Audit subscriptions, surface savings, and earmark sponsor-funded rego or servicing vouchers.
                </p>
                <a href="{{ route('money.inbox') }}" class="btn-link">
                    Visit money inbox <ion-icon name="arrow-forward"></ion-icon>
                </a>
            </div>

            <div class="fin-ed-card">
                <ion-icon name="trending-down-outline" style="font-size: 2.5rem; color: #059669; margin-bottom: 20px;"></ion-icon>
                <h3 style="font-size: 1.4rem; font-weight: 700; margin-bottom: 10px;">Debt + Loan Explainer</h3>
                <p style="color: #64748b; font-size: 1rem; margin-bottom: 20px;">
                    Run consolidation scenarios before accepting finance, complete with trauma-aware guardrails.
                </p>
                <a href="#" class="btn-link">
                    Simulate debt scenarios <ion-icon name="arrow-forward"></ion-icon>
                </a>
            </div>
        </div>
    </div>
</section>

<!-- Impact Index Footer -->
<section style="background: #1e293b; padding: 50px 0; color: white;">
    <div class="container">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 30px;">
            <div style="max-width: 600px;">
                <h4 style="font-weight: 700; margin-bottom: 10px; color: #34d399; font-size: 1.2rem;">Impact Index</h4>
                <p style="color: #cbd5e1; margin-bottom: 10px; font-size: 1rem; line-height: 1.6;">
                    Signals across jobs, housing, business and mentors.
                </p>
                <p style="color: #94a3b8; margin: 0; font-size: 0.9rem; line-height: 1.6;">
                    Metrics refresh roughly every 15 minutes via the Impact Analytics Service so sponsors, members and guardians can see what the system is doing in real time.
                </p>
            </div>
            <div style="text-align: right; min-width: 200px;">
                <div style="font-size: 0.9rem; color: #94a3b8; margin-bottom: 5px;">
                    <ion-icon name="sync-outline" class="spin" style="vertical-align: middle;"></ion-icon> Window syncing...
                </div>
                <div style="font-size: 0.95rem; color: #e2e8f0; font-weight: 600;">
                    Last updated just now
                </div>
                <div style="font-size: 0.8rem; color: #64748b; margin-top: 10px;">
                    Powered by impact:snapshots + /api/v1/impact
                </div>
                <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">
                    Numbers align with the Problem Map roadmaps.
                </div>
            </div>
        </div>
    </div>
</section>

@endsection
