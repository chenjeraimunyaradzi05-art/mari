@extends('layouts.master')

@section('title', 'Jobs, Money, Housing & Wellbeing')
@section('meta_description', 'Athena showcases women-first jobs, housing, grants, wellness and social tools supported by respectful AI and ethical advertising partners.')

@section('content')
    @php
        $homeSections = collect(config('athena.home_sections', []));

        $roleSections = $homeSections
            ->sortByDesc(static function ($section) {
                return $section['slug'] === 'ai-concierge';
            })
            ->values();

        $skillsCard = [
            'eyebrow' => 'Verified Credentials & Readiness',
            'title' => 'Your professional passport, powered by AI',
            'description' => 'Athena orchestrates your entire credential portfolio. From trade tickets and university degrees to cultural permits and micro-credentials, we verify, monitor, and match your skills to real-world opportunities.',
            'points' => [
                '<strong>AI-Verified Uploads:</strong> Securely store WWCC, RSA, PPE, and degrees with automated expiry tracking and renewal reminders.',
                '<strong>Universal Passport:</strong> One-click sharing with employers, grant bodies, and mentors—no more repetitive paperwork.',
                '<strong>Smart Gap Analysis:</strong> Our Opportunity Radar spots missing qualifications for your dream role and suggests sponsored upskilling.',
                '<strong>Privacy-First:</strong> You control exactly who sees your data. Share verified badges without exposing personal documents.',
            ],
            'cta' => [
                'label' => auth()->check() ? 'Manage Credentials' : 'Sync Your Credentials',
                'url' => auth()->check() ? route('member.dashboard') : route('register'),
            ]
        ];

        $seedAds = collect(config('advertising.frontend_preview', []))
            ->map(function ($ad) {
                $media = $ad['media'] ?? null;
                $url = $ad['url'] ?? $media;

                if ($url) {
                    if (\Illuminate\Support\Str::startsWith($url, ['http://', 'https://'])) {
                        $mediaUrl = $url;
                    } else {
                        $mediaUrl = asset(ltrim($url, '/'));
                    }
                } else {
                    $mediaUrl = null;
                }

                $ctaUrl = $ad['cta_url'] ?? null;
                if (! $ctaUrl && ! empty($ad['cta_route']) && \Illuminate\Support\Facades\Route::has($ad['cta_route'])) {
                    $ctaUrl = route($ad['cta_route']);
                } elseif ($ctaUrl && ! \Illuminate\Support\Str::startsWith($ctaUrl, ['http://', 'https://'])) {
                    $ctaUrl = url($ctaUrl);
                }

                return [
                    'type' => $ad['type'] ?? 'image',
                    'url' => $mediaUrl,
                    'poster' => $ad['poster'] ?? null,
                    'label' => $ad['label'] ?? 'Sponsor spotlight',
                    'title' => $ad['title'] ?? null,
                    'description' => $ad['description'] ?? null,
                    'cta_text' => $ad['cta_text'] ?? null,
                    'cta_url' => $ctaUrl,
                    'external' => (bool) ($ad['external'] ?? false),
                ];
            })
            ->filter(fn ($ad) => ! empty($ad['url']) && ! empty($ad['title']))
            ->values();

        $seedAdIndex = 0;
        $nextSeedAds = static function (string $slot) use (&$seedAdIndex, $seedAds) {
            if ($seedAds->isEmpty()) {
                return [];
            }

            $ad = $seedAds[$seedAdIndex % $seedAds->count()] ?? null;
            $seedAdIndex++;

            if (! $ad) {
                return [];
            }

            return [
                array_merge($ad, [
                    'metrics' => [
                        'slot' => $slot,
                    ],
                ]),
            ];
        };
    @endphp

    @if ($roleSections->isNotEmpty())
        @php
            $introAds = $nextSeedAds('home-intro');
        @endphp
        <section class="hub-section hub-section--intro hub-section--signals-right" id="how">
            <div class="container hub-section__layout">
                <div class="hub-section__meta {{ empty($introAds) ? 'hub-section__meta--blank' : 'hub-section__meta--ads' }}" @if(empty($introAds)) aria-hidden="true" @endif>
                    @if (!empty($introAds))
                        <x-ad-slot :ads="$introAds" position="home-intro" layout="stacked" />
                    @endif
                </div>
                <div class="hub-section__content">
                    <p class="section-eyebrow">Problem Map aligned hubs</p>

                    @if(isset($headlineVariant) && $headlineVariant === 'empowerment_focus')
                        <h2 class="heading-secondary">Empowering your journey to financial freedom</h2>
                    @elseif(isset($headlineVariant) && $headlineVariant === 'career_focus')
                        <h2 class="heading-secondary">Accelerate your career with Athena</h2>
                    @else
                        <h2 class="heading-secondary">Athena gives every ecosystem its own runway</h2>
                    @endif

                    <div class="hub-intro-card">
                        <p>
                            Athena gives every ecosystem its own runway – and every woman a clearer way through. Powered by deep research (Copilot Guide, Problem Map,
                            Critical Problems), Athena connects real problems to real pathways: from How Athena Works and Impact, to Membership, Athena Lounge and Join Athena.
                        </p>
                        <p>
                            Explore dedicated runways for Public Sector, Members, Company, Health & Fitness, TAFE / University, Business Network, Real Estate,
                            Trades & Apprenticeships, Financial Literacy & Wellbeing, New / Preloved Cars, AI Concierge, and Social Feed & Mentorship.
                        </p>

                        @if(!auth()->check())
                            <div class="mt-4">
                                @php
                                    $btnClass = 'btn btn-lg ';
                                    if(isset($buttonColorVariant)) {
                                        $btnClass .= match($buttonColorVariant) {
                                            'purple' => 'btn-purple', // Assuming these classes exist or using inline styles
                                            'green' => 'btn-success',
                                            default => 'btn-primary'
                                        };
                                    } else {
                                        $btnClass .= 'btn-primary';
                                    }
                                @endphp
                                <a href="{{ route('register') }}" class="{{ $btnClass }}">Join Athena Today</a>
                            </div>
                        @endif
                    </div>
                </div>
            </div>
        </section>

        @php
            $skillsAds = $nextSeedAds('home-skills');
        @endphp
        <section class="skills-licences-section hub-section" id="skills-licences">
            <div class="container hub-section__layout">
                <div class="hub-section__content skills-licences-section__content">
                    <p class="section-eyebrow">Credentials & readiness</p>
                    <h2 class="heading-secondary">Skills & Licences stay synced for every hub</h2>
                    <p>
                        Upload once, sync everywhere. Your AI Concierge, employers, grants teams, and wellness allies always know you are ready to deploy,
                        whether it is a WWCC renewal, PPE permit, or allied health credential.
                    </p>

                    <div class="skills-licences-section__card">
                        @include('components.skills-card', ['skillsCard' => $skillsCard])
                    </div>
                </div>

                <div class="hub-section__meta {{ empty($skillsAds) ? 'hub-section__meta--blank' : 'hub-section__meta--ads' }}" @if(empty($skillsAds)) aria-hidden="true" @endif>
                    @if (!empty($skillsAds))
                        <x-ad-slot :ads="$skillsAds" position="home-skills" layout="card" />
                    @endif
                </div>
            </div>
        </section>

        @foreach ($roleSections as $index => $section)
            @php
                $theme = $section['theme'] ?? [];
                $supporting = collect($section['supporting_points'] ?? []);
                $cta = $section['cta'] ?? [];
                $ctaUrl = $cta['url'] ?? null;
                $hasInsight = ! empty($section['insight']);

                if (! $ctaUrl && ! empty($cta['route']) && \Illuminate\Support\Facades\Route::has($cta['route'])) {
                    $ctaUrl = route($cta['route']);
                }
            @endphp
            @php
                $leftColumnFirst = ($index + 1) % 2 === 0;
            @endphp
            @php
                $sectionAds = $nextSeedAds('home-'.$section['slug']);
            @endphp
            <section
                id="{{ $section['slug'] }}"
                class="hub-section {{ $index % 2 === 1 ? 'hub-section--alt' : '' }} {{ $leftColumnFirst ? 'hub-section--signals-left' : 'hub-section--signals-right' }}"
                style="--hub-accent: {{ $theme['accent'] ?? 'var(--color-primary)' }}; --hub-surface: {{ $theme['surface'] ?? 'var(--color-surface)' }};"
            >
                <div class="container hub-section__layout">
                    <div class="hub-section__content {{ $leftColumnFirst ? '' : 'hub-section__content--padded' }}">
                        <div class="hub-section__icon" aria-hidden="true">
                            <ion-icon name="{{ $section['icon'] ?? 'sparkles-outline' }}"></ion-icon>
                        </div>
                        <p class="hub-section__eyebrow">{{ $section['eyebrow'] ?? 'Live hub' }}</p>
                        <h3 class="hub-section__title">{{ $section['label'] }}</h3>
                        <p class="hub-section__description">{{ $section['description'] }}</p>

                        @if ($supporting->isNotEmpty())
                            <ul class="hub-section__list">
                                @foreach ($supporting as $point)
                                    <li>{{ $point }}</li>
                                @endforeach
                            </ul>
                        @endif

                        @if ($ctaUrl)
                            <a class="hub-section__cta" href="{{ $ctaUrl }}">
                                {{ $cta['label'] ?? 'Explore hub' }}
                                <ion-icon name="arrow-forward-outline" aria-hidden="true"></ion-icon>
                            </a>
                        @endif

                        <div class="hub-section__signals">
                            <div class="hub-section__stat hub-section__stat--inline" aria-label="{{ $section['stat_label'] ?? 'Impact stat' }}">
                                <span class="hub-section__stat-value">{{ $section['stat_value'] ?? '—' }}</span>
                                <span class="hub-section__stat-label">{{ $section['stat_label'] ?? 'live signals' }}</span>
                            </div>

                            @if ($hasInsight)
                                <div class="hub-section__insight hub-section__insight--inline">
                                    <p class="hub-section__insight-label">Insight</p>
                                    <p>{{ $section['insight'] }}</p>
                                </div>
                            @endif
                        </div>
                    </div>

                    <div class="hub-section__meta {{ empty($sectionAds) ? 'hub-section__meta--blank' : 'hub-section__meta--ads' }}" @if(empty($sectionAds)) aria-hidden="true" @endif>
                        @if (!empty($sectionAds))
                            <x-ad-slot :ads="$sectionAds" position="home-{{ $section['slug'] }}" layout="stacked" />
                        @endif
                    </div>
                </div>
            </section>
        @endforeach

        <section
            id="impact"
            class="impact-widget"
            data-impact-widget="home-impact"
            data-impact-widget-id="home-impact"
            data-impact-endpoint="{{ route('api.v1.impact.index', ['audience' => 'public', 'timeframe' => 'daily']) }}"
            data-impact-cache-key="impact:public:daily"
            data-impact-cache-ttl="900000"
            data-impact-audience="public"
            data-impact-timeframe="daily"
            data-impact-telemetry="impact.widget.home"
        >
            <div class="container impact-widget__shell">
                <div class="impact-widget__header">
                    <div>
                        <p class="section-eyebrow">Impact index</p>
                        <h2 class="heading-secondary">Signals across jobs, housing, business and mentors.</h2>
                        <p class="impact-widget__lede">
                            Metrics refresh roughly every 15 minutes via the Impact Analytics Service so sponsors, members and
                            guardians can see what the system is doing in real time.
                        </p>
                    </div>
                    <div class="impact-widget__meta" aria-live="polite">
                        <p class="impact-widget__meta-line" data-impact-window>Window syncing...</p>
                        <p class="impact-widget__meta-line" data-impact-generated>Last updated just now</p>
                    </div>
                </div>

                <div class="impact-widget__grid" data-impact-grid role="list">
                    @for ($i = 0; $i < 5; $i++)
                        <article class="impact-widget__card impact-widget__card--placeholder" aria-hidden="true" role="listitem">
                            <p class="impact-widget__label">Calibrating metric...</p>
                            <p class="impact-widget__value">&mdash;</p>
                            <p class="impact-widget__description">Syncing live signals</p>
                        </article>
                    @endfor
                </div>

                <p class="impact-widget__footnote">
                    Powered by <code>impact:snapshots</code> + <code>/api/v1/impact</code>. Numbers align with the Problem Map roadmaps.
                </p>
            </div>
        </section>
    @endif
@endsection
