@php
    $isHome = request()->routeIs('home');
    $isAthenaSocial = request()->routeIs('athena.social');
    $ctaTarget = $isAthenaSocial ? '#cta' : route('athena.social') . '#cta';
@endphp

<style>
    /* Compact Header Styles */
    .compact-header {
        background: linear-gradient(90deg, rgba(255, 241, 242, 0.95) 0%, rgba(255, 255, 255, 0.98) 50%, rgba(243, 232, 255, 0.95) 100%); /* Soft Rose -> White -> Soft Purple */
        backdrop-filter: blur(20px);
        border-bottom: 1px solid rgba(255, 255, 255, 0.6);
        padding: 0 20px;
        height: 60px; /* Fixed small height */
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: sticky;
        top: 0;
        z-index: 1000;
        box-shadow: 0 4px 20px rgba(168, 85, 247, 0.08); /* Soft purple shadow */
        font-family: 'Rubik', sans-serif; /* Feminine, rounded font */
    }

    .header-left {
        display: flex;
        align-items: center;
        gap: 20px;
    }

    .header-logo {
        height: 32px;
        width: auto;
        filter: brightness(0.8); /* Slightly darken logo without losing detail */
        transition: filter 0.3s ease;
    }

    .header-logo:hover {
        filter: brightness(0.6); /* Slightly darker on hover */
    }

    .header-nav {
        display: flex;
        align-items: center;
        gap: 5px;
        height: 60px;
    }

    /* Dropdown Menu Styles */
    .nav-item {
        position: relative;
        height: 100%;
        display: flex;
        align-items: center;
    }

    .nav-link {
        color: #334155; /* Slate-700 */
        text-decoration: none;
        font-size: 0.95rem;
        font-weight: 600;
        padding: 0 12px;
        height: 100%;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
        border-bottom: 2px solid transparent;
        border-radius: 8px;
    }

    .nav-link:hover, .nav-item:hover .nav-link {
        color: #7e22ce; /* Purple-700 */
        background-color: #f3e8ff; /* Purple-100 */
        transform: translateY(-1px);
    }

    .nav-link ion-icon {
        font-size: 0.9rem;
        opacity: 0.9;
        transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        color: #64748b;
    }

    .nav-item:hover .nav-link ion-icon {
        transform: rotate(180deg) scale(1.1);
        color: #d946ef; /* Fuchsia-500 */
    }

    .dropdown-menu {
        position: absolute;
        top: calc(100% + 10px);
        left: 0;
        background: linear-gradient(165deg, rgba(255, 255, 255, 0.98) 0%, rgba(245, 243, 255, 0.95) 100%); /* Subtle white to lavender fade */
        backdrop-filter: blur(20px);
        min-width: 260px;
        border: 1px solid rgba(255, 255, 255, 0.8);
        border-radius: 16px;
        box-shadow:
            0 20px 40px -5px rgba(168, 85, 247, 0.15),
            0 0 0 1px rgba(255, 255, 255, 0.6) inset;
        padding: 12px;
        display: flex;
        flex-direction: column;
        z-index: 1001;

        /* Animation states */
        opacity: 0;
        visibility: hidden;
        transform: translateY(15px) scale(0.95);
        transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        pointer-events: none;
        transform-origin: top left;
    }

    /* Bridge the gap between nav-item and dropdown-menu to prevent closing */
    .dropdown-menu::before {
        content: '';
        position: absolute;
        top: -20px;
        left: 0;
        width: 100%;
        height: 20px;
        background: transparent;
    }

    .nav-item:hover .dropdown-menu {
        opacity: 1;
        visibility: visible;
        transform: translateY(0) scale(1);
        pointer-events: auto;
    }

    .dropdown-item {
        padding: 12px 16px;
        color: #1e293b; /* Slate-800 */
        text-decoration: none;
        font-size: 0.95rem;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 12px;
        border-radius: 12px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        margin-bottom: 4px;
        position: relative;
        overflow: hidden;
    }

    .dropdown-item:last-child {
        margin-bottom: 0;
    }

    .dropdown-item:hover {
        background: linear-gradient(to right, #f3e8ff, #ffe4e6); /* Purple-100 to Rose-100 */
        color: #6b21a8; /* Purple-800 */
        transform: translateX(6px);
        padding-left: 20px;
    }

    .dropdown-item ion-icon {
        font-size: 1.2rem;
        color: #64748b; /* Slate-500 */
        transition: all 0.3s ease;
    }

    .dropdown-item:hover ion-icon {
        color: #db2777; /* Pink-600 */
        transform: scale(1.2) rotate(10deg);
    }

    .header-right {
        display: flex;
        align-items: center;
        gap: 15px;
    }

    .btn-header-login {
        color: #6b21a8; /* Purple-800 */
        padding: 10px 24px;
        border-radius: 100px;
        text-decoration: none;
        font-size: 0.9rem;
        font-weight: 700;
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        background: rgba(255, 255, 255, 0.5);
        border: 1px solid transparent;
    }

    .btn-header-login:hover {
        background: white;
        color: #d946ef; /* Fuchsia-500 */
        box-shadow: 0 4px 15px rgba(168, 85, 247, 0.15);
        transform: translateY(-1px);
        border-color: rgba(233, 213, 255, 0.8);
    }

    .btn-header-cta {
        background: linear-gradient(135deg, #a855f7 0%, #d946ef 100%); /* Purple to Fuchsia gradient */
        color: white;
        padding: 10px 24px;
        border-radius: 100px;
        text-decoration: none;
        font-size: 0.9rem;
        font-weight: 600;
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);
        border: 1px solid rgba(255,255,255,0.2);
    }

    .btn-header-cta:hover {
        transform: translateY(-2px) scale(1.05);
        box-shadow: 0 8px 20px rgba(168, 85, 247, 0.4);
        filter: brightness(1.1);
    }

    .btn-header-cta:active {
        transform: translateY(0) scale(0.98);
    }

    .mobile-toggle {
        display: none;
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #64748b;
        transition: color 0.3s ease;
    }

    .mobile-toggle:hover {
        color: #a855f7;
    }

    @media (max-width: 992px) {
        .header-nav {
            display: none; /* Hide nav on mobile for now, or implement mobile menu */
        }
        .mobile-toggle {
            display: block;
        }
    }
</style>

<header class="compact-header">
    <div class="header-left">
        <a href="{{ route('home') }}">
            <img class="header-logo" src="{{ asset('default-uploads/logo.svg') }}" alt="Athena">
        </a>
    </div>

    <nav class="header-nav">
        <!-- Athena AI Dropdown -->
        <div class="nav-item">
            <a href="#" class="nav-link" style="color: #9333ea; font-weight: 700;">
                <ion-icon name="sparkles" style="color: #9333ea; opacity: 1;"></ion-icon> Athena AI <ion-icon name="chevron-down-outline"></ion-icon>
            </a>
            <div class="dropdown-menu">
                <a href="{{ route('ai.concierge.info') }}" class="dropdown-item" style="color: #9333ea; font-weight: 600;">
                    <ion-icon name="hardware-chip-outline" style="color: #9333ea;"></ion-icon> AI Concierge
                </a>
                <a href="{{ route('ai.resume-parser.info') }}" class="dropdown-item" style="color: #9333ea; font-weight: 600;">
                    <ion-icon name="document-text-outline" style="color: #9333ea;"></ion-icon> Resume Parser
                </a>
                <a href="{{ route('ai.career-insights.info') }}" class="dropdown-item" style="color: #9333ea; font-weight: 600;">
                    <ion-icon name="trending-up-outline" style="color: #9333ea;"></ion-icon> Career Insights
                </a>
                <a href="{{ route('ai.job-match.info') }}" class="dropdown-item" style="color: #9333ea; font-weight: 600;">
                    <ion-icon name="git-network-outline" style="color: #9333ea;"></ion-icon> Job Match
                </a>
            </div>
        </div>

        <!-- Athena Social Dropdown -->
        <div class="nav-item">
            <a href="#" class="nav-link" style="color: #db2777; font-weight: 700;">
                <ion-icon name="heart" style="color: #db2777; opacity: 1;"></ion-icon> Athena Social <ion-icon name="chevron-down-outline"></ion-icon>
            </a>
            <div class="dropdown-menu">
                <a href="{{ route('social.lounge.index') }}" class="dropdown-item" style="color: #db2777; font-weight: 600;">
                    <ion-icon name="planet-outline" style="color: #db2777;"></ion-icon> Athena Lounge
                </a>
                <a href="{{ route('social.feed-info.index') }}" class="dropdown-item" style="color: #db2777; font-weight: 600;">
                    <ion-icon name="people-outline" style="color: #db2777;"></ion-icon> Social Feed
                </a>
                <a href="{{ route('social.groups-info.index') }}" class="dropdown-item" style="color: #db2777; font-weight: 600;">
                    <ion-icon name="people-circle-outline" style="color: #db2777;"></ion-icon> Groups & Circles
                </a>
                <a href="{{ route('social.mentorship-info.index') }}" class="dropdown-item" style="color: #db2777; font-weight: 600;">
                    <ion-icon name="ribbon-outline" style="color: #db2777;"></ion-icon> Mentorship
                </a>
            </div>
        </div>

        <!-- Platform Dropdown -->
        <div class="nav-item">
            <a href="#" class="nav-link" style="color: #4f46e5; font-weight: 700;">
                Platform <ion-icon name="chevron-down-outline" style="color: #4f46e5; opacity: 1;"></ion-icon>
            </a>
            <div class="dropdown-menu">
                <a href="{{ route('platform.how-it-works.index') }}" class="dropdown-item" style="color: #4f46e5; font-weight: 600;">
                    <ion-icon name="help-circle-outline" style="color: #4f46e5;"></ion-icon> How it works
                </a>
                <a href="{{ route('platform.modules.index') }}" class="dropdown-item" style="color: #4f46e5; font-weight: 600;">
                    <ion-icon name="grid-outline" style="color: #4f46e5;"></ion-icon> Modules
                </a>
                <a href="{{ route('platform.impact.index') }}" class="dropdown-item" style="color: #4f46e5; font-weight: 600;">
                    <ion-icon name="pulse-outline" style="color: #4f46e5;"></ion-icon> Impact Index
                </a>
            </div>
        </div>

        <!-- Hubs Dropdown -->
        <div class="nav-item">
            <a href="#" class="nav-link" style="color: #059669; font-weight: 700;">
                Ecosystems <ion-icon name="chevron-down-outline" style="color: #059669; opacity: 1;"></ion-icon>
            </a>
            <div class="dropdown-menu">
                <a href="{{ route('jobs.index') }}" class="dropdown-item" style="color: #059669; font-weight: 600;">
                    <ion-icon name="briefcase-outline" style="color: #059669;"></ion-icon> Jobs & Careers
                </a>
                <a href="{{ route('housing.index') }}" class="dropdown-item" style="color: #059669; font-weight: 600;">
                    <ion-icon name="home-outline" style="color: #059669;"></ion-icon> Housing & Mortgages
                </a>
                <a href="{{ route('automotive.mobility-suite') }}" class="dropdown-item" style="color: #059669; font-weight: 600;">
                    <ion-icon name="car-sport-outline" style="color: #059669;"></ion-icon> Automotive & Mobility
                </a>
                <a href="{{ route('money.dashboard') }}" class="dropdown-item" style="color: #059669; font-weight: 600;">
                    <ion-icon name="wallet-outline" style="color: #059669;"></ion-icon> Money & Finance
                </a>
                <a href="{{ route('business.index') }}" class="dropdown-item" style="color: #059669; font-weight: 600;">
                    <ion-icon name="rocket-outline" style="color: #059669;"></ion-icon> Business & Grants
                </a>
                <a href="{{ route('wellness.hub') }}" class="dropdown-item" style="color: #059669; font-weight: 600;">
                    <ion-icon name="heart-outline" style="color: #059669;"></ion-icon> Wellness Hub
                </a>
                <a href="{{ route('education.tafe.dashboard') }}" class="dropdown-item" style="color: #059669; font-weight: 600;">
                    <ion-icon name="school-outline" style="color: #059669;"></ion-icon> Education & TAFE
                </a>
            </div>
        </div>

        <!-- Resources Dropdown -->
        <div class="nav-item">
            <a href="#" class="nav-link" style="color: #0891b2; font-weight: 700;">
                Resources <ion-icon name="chevron-down-outline" style="color: #0891b2; opacity: 1;"></ion-icon>
            </a>
            <div class="dropdown-menu">
                <a href="{{ route('resources.guides.index') }}" class="dropdown-item" style="color: #0891b2; font-weight: 600;">
                    <ion-icon name="book-outline" style="color: #0891b2;"></ion-icon> Guides & Playbooks
                </a>
                <a href="{{ route('resources.research.index') }}" class="dropdown-item" style="color: #0891b2; font-weight: 600;">
                    <ion-icon name="stats-chart-outline" style="color: #0891b2;"></ion-icon> Research
                </a>
                <a href="{{ route('resources.blog.index') }}" class="dropdown-item" style="color: #0891b2; font-weight: 600;">
                    <ion-icon name="newspaper-outline" style="color: #0891b2;"></ion-icon> Blog
                </a>
                <a href="{{ route('resources.help-center.index') }}" class="dropdown-item" style="color: #0891b2; font-weight: 600;">
                    <ion-icon name="headset-outline" style="color: #0891b2;"></ion-icon> Help Center
                </a>
            </div>
        </div>

        <!-- Company Dropdown -->
        <div class="nav-item">
            <a href="#" class="nav-link" style="color: #e11d48; font-weight: 700;">
                Company <ion-icon name="chevron-down-outline" style="color: #e11d48; opacity: 1;"></ion-icon>
            </a>
            <div class="dropdown-menu">
                <a href="{{ route('about.index') }}" class="dropdown-item" style="color: #e11d48; font-weight: 600;">
                    <ion-icon name="information-circle-outline" style="color: #e11d48;"></ion-icon> About Us
                </a>
                <a href="{{ route('pricing.index') }}" class="dropdown-item" style="color: #e11d48; font-weight: 600;">
                    <ion-icon name="pricetag-outline" style="color: #e11d48;"></ion-icon> Pricing
                </a>
                <a href="{{ route('contact.index') }}" class="dropdown-item" style="color: #e11d48; font-weight: 600;">
                    <ion-icon name="mail-outline" style="color: #e11d48;"></ion-icon> Contact
                </a>
                <a href="{{ route('trust-safety.index') }}" class="dropdown-item" style="color: #e11d48; font-weight: 600;">
                    <ion-icon name="shield-checkmark-outline" style="color: #e11d48;"></ion-icon> Trust & Safety
                </a>
            </div>
        </div>
    </nav>

    <div class="header-right">
        @if(auth()->check())
            <a href="{{ route('dashboard') }}" class="btn-header-login">Dashboard</a>
            @if(auth()->user()->role === 'member')
                <a href="{{ route('member.personal.dashboard') }}" class="nav-link" title="Profile">
                    <ion-icon name="person-circle-outline" style="font-size: 1.5rem;"></ion-icon>
                </a>
            @else
                <a href="{{ route('profile.edit') }}" class="nav-link" title="Profile">
                    <ion-icon name="person-circle-outline" style="font-size: 1.5rem;"></ion-icon>
                </a>
            @endif
        @else
            <a href="{{ route('login') }}" class="btn-header-login">Log in</a>
            <a href="{{ route('register') }}" class="btn-header-cta">Join Athena</a>
        @endif
        <button class="mobile-toggle">
            <ion-icon name="menu-outline"></ion-icon>
        </button>
    </div>
</header>

