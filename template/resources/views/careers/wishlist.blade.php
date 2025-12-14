@extends('layouts.app')

@section('title', 'Dream Jobs & Pathways Wishlist')

@section('content')
    @php
        $careerWishlistUser = [
            'id' => $user->id,
            'name' => $user->preferred_name ?? $user->name,
            'pronouns' => $user->pronouns,
            'email' => $user->email,
        ];

        $wishlistHighlights = [
            [
                'tag' => 'Focus',
                'title' => 'Dream role studio',
                'copy' => 'Shortlist the respectful employers, apprenticeships and scholarships you want next.',
            ],
            [
                'tag' => 'Allies',
                'title' => 'Guardian introductions',
                'copy' => 'Signal when you are ready for a warm intro to sponsors, agencies or policy partners.',
            ],
            [
                'tag' => 'Momentum',
                'title' => 'AI follow-ups',
                'copy' => 'Let Athena AI turn wishlist items into brief templates, gratitude notes or interview prep.',
            ],
        ];

        $wishlistMetrics = [
            ['label' => 'Wishlist roles', 'value' => 'Up to 12', 'hint' => 'Keep a tight, trauma-free shortlist.'],
            ['label' => 'Allies watching', 'value' => 'Guardians + sponsors', 'hint' => 'Only when you opt in.'],
            ['label' => 'Syncs to', 'value' => 'Jobs • housing • money', 'hint' => 'One ritual, every hub.'],
        ];

        $guardianCommitments = [
            'Wishlist entries never leave Athena until you choose who sees them.',
            'Guardians review language to keep it trauma-informed and bias-aware.',
            'Signals route to money, housing and wellbeing teams so you do not have to repeat context.',
        ];

        $wishlistSteps = [
            ['title' => 'Pin a respectful opportunity', 'copy' => 'Capture the role, apprenticeship, course or founder support you want and why it matters.'],
            ['title' => 'Mark your readiness signal', 'copy' => 'Tell guardians whether you need introductions, contract reviews or calm accountability.'],
            ['title' => 'Share when you feel safe', 'copy' => 'Flip sharing on for specific allies or keep private until you are ready — nothing is auto-shared.'],
        ];
    @endphp

    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <section class="section-shell" id="wishlist-hero">
            <div class="section-text">
                <p class="section-eyebrow">Wishlist studio</p>
                <h1 class="heading-secondary">Line up dream jobs, contracts and study plans without repeating trauma.</h1>
                <p class="hero-description">
                    Build a wishlist that mirrors the Athena dashboard. Guardians stand by to review language, AI copilots format
                    sponsor-ready snapshots, and every entry stays private until you explicitly invite collaborators.
                </p>

                <div class="guardian-badge-row">
                    <span class="guardian-badge">
                        <strong>Guardian verified</strong>
                        <span>24/7 care team is watching tone</span>
                    </span>
                    <span class="guardian-badge">
                        <strong>Privacy first</strong>
                        <span>Nothing leaves Athena without consent</span>
                    </span>
                    <span class="guardian-badge">
                        <strong>AI copilots</strong>
                        <span>Turns wishlist items into next steps</span>
                    </span>
                </div>

                <div class="auth-meta social-metrics" aria-label="Wishlist metrics">
                    @foreach ($wishlistMetrics as $metric)
                        <div>
                            <strong>{{ $metric['value'] }}</strong>
                            <span>{{ $metric['label'] }}</span>
                            <p class="text-sm text-slate-500">{{ $metric['hint'] }}</p>
                        </div>
                    @endforeach
                </div>
            </div>

            <div class="section-media">
                <div class="section-media-panel">
                    <p class="section-eyebrow">Live highlights</p>
                    <div class="dashboard-card-grid feed-highlight-grid" role="list">
                        @foreach ($wishlistHighlights as $highlight)
                            <article class="feed-highlight-card" role="listitem">
                                <p class="feed-highlight-card__eyebrow">{{ $highlight['tag'] }}</p>
                                <p class="feed-highlight-card__title">{{ $highlight['title'] }}</p>
                                <p class="feed-highlight-card__copy">{{ $highlight['copy'] }}</p>
                            </article>
                        @endforeach
                    </div>
                </div>
                <div class="section-media-panel">
                    <p class="section-eyebrow">Readiness checklist</p>
                    <ul class="auth-highlights">
                        <li>Tell us your next leap — job, contract, study, housing or venture.</li>
                        <li>Attach notes, support needs, or the energy level you want allies to bring.</li>
                        <li>Decide if Athena AI should draft intros, gratitude notes or interview prep.</li>
                    </ul>
                </div>
            </div>
        </section>

        <section class="section-shell" id="wishlist-dashboard">
            <div class="section-text">
                <p class="section-eyebrow">Dashboard view</p>
                <h2 class="heading-secondary">Keep the wishlist synced with jobs, housing, money and wellbeing hubs.</h2>
                <p>
                    Every wishlist entry receives the same guardian oversight, AI ritual support and sponsor-friendly formatting
                    that the main dashboard enjoys. It is your calm control centre for brave career moves.
                </p>

                <div class="dashboard-wishlist">
                    <div class="dashboard-wishlist__summary">
                        @foreach ($wishlistMetrics as $metric)
                            <div>
                                <p class="section-eyebrow" style="margin-bottom: 0.35rem;">{{ $metric['label'] }}</p>
                                <p class="heading-tertiary" style="margin: 0;">{{ $metric['value'] }}</p>
                                <p class="hero-description" style="margin-bottom: 0;">{{ $metric['hint'] }}</p>
                            </div>
                        @endforeach
                    </div>

                    <div class="dashboard-wishlist__list">
                        @foreach ($wishlistSteps as $step)
                            <article class="waitlist-card">
                                <div class="waitlist-card__header">
                                    <div>
                                        <p class="waitlist-card__title heading-tertiary">{{ $step['title'] }}</p>
                                        <p class="waitlist-card__summary">{{ $step['copy'] }}</p>
                                    </div>
                                </div>
                                <div class="waitlist-card__signals">
                                    <span class="status-pill status-pill--neutral">Calm rituals</span>
                                    <span class="status-pill status-pill--success">Guardian ready</span>
                                </div>
                            </article>
                        @endforeach
                    </div>
                </div>
            </div>

            <div class="section-media">
                <div class="section-media-panel" aria-live="polite">
                    <p class="section-eyebrow">Wishlist builder</p>
                    <div id="career-wishlist-root"
                        data-user="@json($careerWishlistUser)"
                        class="dashboard-panel">
                        <p class="text-sm text-slate-500">Loading wishlist surface…</p>
                    </div>
                </div>

                <div class="section-media-panel">
                    <p class="section-eyebrow">Guardian pledges</p>
                    <ul class="auth-highlights">
                        @foreach ($guardianCommitments as $pledge)
                            <li>{{ $pledge }}</li>
                        @endforeach
                    </ul>
                </div>
            </div>
        </section>

        <section class="section-shell" id="wishlist-cta">
            <div class="section-text">
                <p class="section-eyebrow">Next moves</p>
                <h2 class="heading-secondary">Ready to share with mentors, founders or councils?</h2>
                <p>
                    Once your wishlist feels steady, let Athena AI format it into a sponsor memo, investor brief or grant-ready
                    folio. Guardians will make sure tone, privacy and cultural needs are honoured before anything is sent.
                </p>
                <div class="cta-row">
                    <a href="{{ route('register') }}" class="btn btn--full">Invite a guardian to review</a>
                    <a href="{{ url('/dashboard') }}" class="btn btn--outline">Return to main dashboard</a>
                </div>
            </div>

            <div class="section-media">
                <div class="section-media-panel action-grid">
                    <div class="action-card">
                        <p class="action-card__title"><strong>Need help editing?</strong></p>
                        <p class="action-card__copy">Ask the guardians to co-write your wishlist entry or script a calm follow up.</p>
                    </div>
                    <div class="action-card">
                        <p class="action-card__title"><strong>Want employer context?</strong></p>
                        <p class="action-card__copy">Guardians can attach safety intel, salary benchmarks or visa-ready steps.</p>
                    </div>
                    <div class="action-card">
                        <p class="action-card__title"><strong>Share with care</strong></p>
                        <p class="action-card__copy">Toggle sharing on for specific allies. Every action is logged in your dashboard.</p>
                    </div>
                </div>
            </div>
        </section>

        <p class="text-center text-xs text-slate-500">
            Athena — crafted with care by <span class="font-semibold">Munyaradzi Chenjerai</span>. This beta experience honours
            your privacy; saved dreams stay private until you choose to share them.
        </p>
    </div>
@endsection
