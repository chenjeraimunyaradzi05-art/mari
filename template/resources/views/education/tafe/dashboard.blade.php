@extends('frontend.layouts.master')

@section('title', 'TAFE + University Command Center')
@section('meta_description', 'AI-ranked pathways, scholarships, and social momentum for fearless women inside the MoneyMan education orbit.')

@php
    use Illuminate\Support\Str;
    use Illuminate\Support\Facades\Route as RouteFacade;

    $suppressFrontendHeader = true;
    $suppressSponsorPreview = true;
    $suppressConciergeBar = true;
    $suppressFooterNewsletter = true;

    $salaryOptions = [
        '70k-100k' => 'AUD 70k – 100k',
        '100k-130k' => 'AUD 100k – 130k',
        '130k-160k' => 'AUD 130k – 160k',
        '160k-plus' => 'AUD 160k+',
    ];

    $socialHubUrl = null;
    if (RouteFacade::has('social.feed.preview')) {
        $socialHubUrl = route('social.feed.preview');
    } elseif (RouteFacade::has('member.social.feed')) {
        $socialHubUrl = route('member.social.feed');
    } elseif (RouteFacade::has('social.posts.index')) {
        $socialHubUrl = route('social.posts.index');
    } else {
        $socialHubUrl = url('/social');
    }

    $workStyles = [
        'hybrid' => 'Hybrid leadership',
        'remote-first' => 'Remote-first',
        'on-site' => 'On-site immersion',
        'portfolio' => 'Portfolio / fractional',
    ];

    $profileDefaults = [
        'motivations' => old('motivations', optional($careerProfile)->motivations),
        'focus_areas' => old('focus_areas', collect(optional($careerProfile)->focus_areas)->implode(', ')),
        'preferred_sectors' => old('preferred_sectors', collect(optional($careerProfile)->preferred_sectors)->implode(', ')),
        'salary_aspiration' => old('salary_aspiration', optional($careerProfile)->salary_aspiration),
        'impact_goals' => old('impact_goals', optional($careerProfile)->impact_goals),
        'work_style' => old('work_style', optional($careerProfile)->work_style),
        'top_skills' => old('top_skills', collect(optional($careerProfile)->top_skills)->implode(', ')),
    ];

    $resolveUrl = function (array $item) {
        if (! empty($item['route']) && RouteFacade::has($item['route'])) {
            return route($item['route'], $item['parameters'] ?? []);
        }

        $raw = $item['url'] ?? $item['link'] ?? '#';
        if ($raw === '#') {
            return '#';
        }

        return Str::startsWith($raw, ['http://', 'https://']) ? $raw : url($raw);
    };

    $globalNavLinks = collect(config('site_navigation.primary', []))
        ->reject(function ($item) {
            $item = (array) $item;
            $label = Str::lower($item['label'] ?? '');
            return Str::contains($label, 'pricing');
        })
        ->map(function ($item) use ($resolveUrl) {
            $item = (array) $item;
            if (empty($item['label'])) {
                return null;
            }

            return [
                'label' => $item['label'],
                'url' => $resolveUrl($item),
            ];
        })
        ->filter()
        ->values()
        ->all();

    if (empty($globalNavLinks)) {
        $fallbackLinks = [
            ['label' => 'Home', 'route' => 'home', 'url' => url('/')],
            ['label' => 'Find Your Next Role', 'route' => 'jobs.index', 'url' => url('/jobs')],
            ['label' => 'Recruiter Hub', 'route' => 'recruiters.index', 'url' => url('/recruiters')],
            ['label' => 'Member Hub', 'route' => 'members.index', 'url' => url('/member')],
            ['label' => 'Playbook', 'route' => 'playbook.index', 'url' => url('/playbook')],
            ['label' => 'Insights', 'route' => 'wellness.dashboard', 'url' => url('/member/wellness')],
            ['label' => 'Feed', 'route' => 'feed.index', 'url' => url('/feed')],
        ];

        $globalNavLinks = collect($fallbackLinks)
            ->map(fn ($item) => [
                'label' => $item['label'],
                'url' => $resolveUrl($item),
            ])
            ->all();
    }

    $ecosystemSegments = collect(config('site_navigation.ecosystem', []))
            ->map(function ($segment) use ($resolveUrl) {
            $segment = (array) $segment;
            $items = collect($segment['items'] ?? [])->map(function ($item) use ($resolveUrl) {
                $item = (array) $item;
                return [
                    'label' => $item['label'] ?? 'Explore',
                    'url' => $resolveUrl($item),
                ];
            })->values()->all();

            return [
                'title' => $segment['title'] ?? 'Explore',
                'items' => $items,
            ];
        })
        ->filter(fn ($segment) => ! empty($segment['items']))
        ->values();

    if ($ecosystemSegments->isEmpty()) {
        $defaultSegments = [
            ['title' => 'Glow boldly', 'icon' => 'fa-bolt', 'items' => [
                ['label' => 'Company Lounge', 'route' => 'company.dashboard', 'url' => url('/company')],
                ['label' => 'Business Network', 'route' => 'business.network', 'url' => url('/business/network')],
                ['label' => 'Curated partners & mentors', 'route' => 'business.network', 'url' => url('/business/network#mentors')],
            ]],
            ['title' => 'Company', 'icon' => 'fa-building', 'items' => [
                ['label' => 'Employer console & briefs', 'route' => 'company.dashboard', 'url' => url('/company')],
            ]],
            ['title' => 'Government', 'icon' => 'fa-landmark', 'items' => [
                ['label' => 'Funding & procurement', 'route' => 'public-sector.pipeline', 'url' => url('/public-sector/pipeline')],
            ]],
            ['title' => 'Public Sector', 'icon' => 'fa-city', 'items' => [
                ['label' => 'Government & civic roles', 'route' => 'public-sector.dashboard', 'url' => url('/public-sector')],
            ]],
            ['title' => 'Member', 'icon' => 'fa-user-astronaut', 'items' => [
                ['label' => 'Personalised career hub', 'route' => 'member.dashboard', 'url' => url('/member/dashboard')],
            ]],
            ['title' => 'Real Estate', 'icon' => 'fa-home', 'items' => [
                ['label' => 'Property pathways & leadership', 'route' => 'women.real-estate.dashboard', 'url' => url('/women/real-estate')],
            ]],
            ['title' => 'TAFE & University', 'icon' => 'fa-graduation-cap', 'items' => [
                ['label' => 'Pathways & upskilling', 'route' => 'education.tafe.dashboard', 'url' => url('/education/tafe-university')],
            ]],
            ['title' => 'Trades', 'icon' => 'fa-tools', 'items' => [
                ['label' => 'Licences & traineeships', 'route' => 'trades.dashboard', 'url' => url('/trades')],
            ]],
        ];

        $ecosystemSegments = collect($defaultSegments)
            ->map(function ($segment) use ($resolveUrl) {
                $segment = (array) $segment;
                $items = collect($segment['items'])->map(function ($item) use ($resolveUrl) {
                    $item = (array) $item;
                    return [
                        'label' => $item['label'],
                        'url' => $resolveUrl($item),
                    ];
                })->all();

                return [
                    'title' => $segment['title'],
                    'icon' => $segment['icon'] ?? 'fa-link',
                    'items' => $items,
                ];
            });
    }

    $headerShortcuts = collect([
        ['label' => 'Member hub', 'route' => 'member.dashboard', 'url' => url('/member/dashboard')],
        ['label' => 'Glow guide', 'route' => 'wellness.dashboard', 'url' => url('/member/wellness')],
        ['label' => 'Live feed', 'route' => 'feed.index', 'url' => url('/feed')],
    ])->map(fn ($item) => [
        'label' => $item['label'],
        'url' => $resolveUrl($item),
    ])->all();

    $communitySpotlights = collect($socialHighlights ?? [])->take(3);
    $latestJourneyUpdatedAt = optional(collect($journeys)->first())->updated_at;
@endphp

@section('contents')
    {{-- Hero Section --}}
    <section class="hub-section hub-section--intro hub-section--signals-right housing-experience" id="tafe-hero">
        <div class="container hub-section__layout">
            <div class="hub-section__content">
                <p class="section-eyebrow">TAFE &amp; University Command</p>

                {{-- Greeting & Avatar --}}
                <div class="d-flex align-items-center mb-4">
                    <img src="{{ auth()->user()->avatar_url }}" alt="{{ auth()->user()->name }}" class="rounded-circle me-3" style="width: 64px; height: 64px; object-fit: cover; border: 2px solid #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    <div>
                        <h2 class="heading-secondary mb-0">Hello, {{ auth()->user()->name }}</h2>
                        <p class="mb-0 text-muted">Ready to explore your education pathways?</p>
                    </div>
                </div>

                <p>
                    Wraparound pathways, scholarships, and AI copilots that sync with your ambitions and your calendar.
                </p>

                <div class="hub-section__signals">
                    <div class="hub-section__stat">
                        <span class="hub-section__stat-value">{{ number_format($stats['totalPrograms']) }}</span>
                        <span class="hub-section__stat-label">Programs live</span>
                    </div>
                    <div class="hub-section__stat">
                        <span class="hub-section__stat-value">{{ number_format($stats['activeJourneys']) }}</span>
                        <span class="hub-section__stat-label">Journeys monitored</span>
                    </div>
                    <div class="hub-section__stat">
                        <span class="hub-section__stat-value">{{ number_format($stats['liveIntakes']) }}</span>
                        <span class="hub-section__stat-label">Active intakes</span>
                    </div>
                </div>

                <div class="cta-row">
                    <a href="{{ route('education.tafe.programs.index') }}" class="btn btn--full">Explore programs</a>
                    @if($socialHubUrl)
                        <a href="{{ $socialHubUrl }}" class="btn btn--outline">Launch social network</a>
                    @endif
                </div>
            </div>

            <div class="hub-section__meta">
                <div class="hub-intro-card housing-hero-card">
                    <p class="section-eyebrow">Live Momentum</p>
                    <ul>
                        <li>{{ number_format($stats['activeJourneys']) }} personal journeys live</li>
                        <li>{{ number_format($stats['liveIntakes']) }} intake windows to claim</li>
                        <li>
                            @if($latestJourneyUpdatedAt)
                                Journeys updated {{ $latestJourneyUpdatedAt->diffForHumans() }}
                            @else
                                Kick off your first journey in minutes
                            @endif
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </section>

    {{-- Profile Section --}}
    <section class="section-shell" aria-label="Profile &amp; AI boosts">
        <div class="container">
            @if(session('tafe_profile_saved'))
                <div class="alert alert-success mb-4" role="alert">
                    <i class="fas fa-sparkles me-2" aria-hidden="true"></i>
                    <span>Profile saved. We refreshed your AI career signals.</span>
                </div>
            @endif

            <div class="row">
                <div class="col-lg-8 mb-4">
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="card-body p-4">
                            <header class="d-flex justify-content-between align-items-center mb-4">
                                <div>
                                    <p class="text-uppercase text-muted small fw-bold mb-1">Profile registration</p>
                                    <h3 class="h4 mb-0">Tell us what you’re chasing</h3>
                                </div>
                                <span class="badge bg-primary-soft text-primary">AI boost</span>
                            </header>
                            <p class="text-muted mb-4">Share your motivations, dream collaborators, and impact goals. We will keep refreshing the dashboard with personalised leads, grants, and wraparound mentors.</p>

                            <form method="POST" action="{{ route('education.tafe.profile.store') }}">
                                @csrf
                                <div class="mb-3">
                                    <label for="tafe-motivations" class="form-label">What drives you?</label>
                                    <textarea id="tafe-motivations" name="motivations" class="form-control" rows="3">{{ $profileDefaults['motivations'] }}</textarea>
                                    @error('motivations')
                                        <small class="text-danger">{{ $message }}</small>
                                    @enderror
                                </div>
                                <div class="mb-3">
                                    <label for="tafe-focus-areas" class="form-label">Focus themes (comma separated)</label>
                                    <input id="tafe-focus-areas" name="focus_areas" type="text" class="form-control" value="{{ $profileDefaults['focus_areas'] }}">
                                    @error('focus_areas')
                                        <small class="text-danger">{{ $message }}</small>
                                    @enderror
                                </div>
                                <div class="mb-3">
                                    <label for="tafe-sectors" class="form-label">Preferred sectors</label>
                                    <input id="tafe-sectors" name="preferred_sectors" type="text" class="form-control" value="{{ $profileDefaults['preferred_sectors'] }}" placeholder="e.g. climate tech, digital health">
                                    @error('preferred_sectors')
                                        <small class="text-danger">{{ $message }}</small>
                                    @enderror
                                </div>
                                <div class="row mb-3">
                                    <div class="col-md-6">
                                        <label for="tafe-salary" class="form-label">Salary momentum</label>
                                        <select id="tafe-salary" name="salary_aspiration" class="form-select">
                                            <option value="">Select range</option>
                                            @foreach($salaryOptions as $value => $label)
                                                <option value="{{ $value }}" @selected($profileDefaults['salary_aspiration'] === $value)>{{ $label }}</option>
                                            @endforeach
                                        </select>
                                        @error('salary_aspiration')
                                            <small class="text-danger">{{ $message }}</small>
                                        @enderror
                                    </div>
                                    <div class="col-md-6">
                                        <label for="tafe-work-style" class="form-label">Work style</label>
                                        <select id="tafe-work-style" name="work_style" class="form-select">
                                            <option value="">Select</option>
                                            @foreach($workStyles as $value => $label)
                                                <option value="{{ $value }}" @selected($profileDefaults['work_style'] === $value)>{{ $label }}</option>
                                            @endforeach
                                        </select>
                                        @error('work_style')
                                            <small class="text-danger">{{ $message }}</small>
                                        @enderror
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label for="tafe-skills" class="form-label">Top skills to leverage</label>
                                    <input id="tafe-skills" name="top_skills" type="text" class="form-control" value="{{ $profileDefaults['top_skills'] }}" placeholder="e.g. partnerships, product, capital raising">
                                    @error('top_skills')
                                        <small class="text-danger">{{ $message }}</small>
                                    @enderror
                                </div>
                                <div class="mb-4">
                                    <label for="tafe-impact" class="form-label">Impact goals</label>
                                    <textarea id="tafe-impact" name="impact_goals" class="form-control" rows="3">{{ $profileDefaults['impact_goals'] }}</textarea>
                                    @error('impact_goals')
                                        <small class="text-danger">{{ $message }}</small>
                                    @enderror
                                </div>
                                <button type="submit" class="btn btn-primary w-100">Save profile &amp; refresh AI</button>
                                <p class="text-muted small mt-2 text-center">Updates refresh within 60 seconds.</p>
                            </form>
                        </div>
                    </div>
                </div>

                <div class="col-lg-4 mb-4">
                    <div class="card h-100 border-0 shadow-sm bg-light">
                        <div class="card-body p-4">
                            <header class="mb-4">
                                <p class="text-uppercase text-muted small fw-bold mb-1">AI-powered outlook</p>
                                <h3 class="h4">Careers about to surge</h3>
                            </header>
                            <p class="text-muted mb-4">We scan high-growth sectors, funding rounds, and salary indices to surface the most lucrative missions for your profile.</p>

                            @if(! empty($careerSuggestions['summary']))
                                <div class="alert alert-info border-0 bg-white shadow-sm">{{ $careerSuggestions['summary'] }}</div>
                            @else
                                <div class="alert alert-warning border-0 bg-white shadow-sm">Share your ambitions to unlock tailored signals.</div>
                            @endif

                            <div class="d-flex flex-column gap-3">
                                @forelse($careerSuggestions['careers'] ?? [] as $career)
                                    <div class="bg-white p-3 rounded shadow-sm">
                                        <h4 class="h6 mb-1">{{ $career['title'] ?? 'Emerging leadership pathway' }}</h4>
                                        <p class="small text-muted mb-2">{{ $career['growth_outlook'] ?? 'Growth outlook pending' }}</p>

                                        @if(! empty($career['median_salary']))
                                            <span class="badge bg-light text-dark border mb-2">{{ $career['median_salary'] }}</span>
                                        @endif

                                        @if(! empty($career['why_match']))
                                            <p class="small mb-2">{{ $career['why_match'] }}</p>
                                        @endif

                                        @if(! empty($career['next_step']))
                                            <p class="small mb-0"><strong>Next step:</strong> {{ $career['next_step'] }}</p>
                                        @endif
                                    </div>
                                @empty
                                    <p class="text-muted text-center">Save your profile to reveal three glowing career bets.</p>
                                @endforelse
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    {{-- Insights & Programs --}}
    <section class="section-shell bg-light" aria-label="AI snapshot">
        <div class="container">
            <div class="row">
                <div class="col-lg-4 mb-4">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-body p-4">
                            <header class="mb-4">
                                <p class="text-uppercase text-muted small fw-bold mb-1">Focus radar</p>
                                <h3 class="h4">Glowline priorities</h3>
                            </header>
                            <div class="mb-4">
                                <p class="badge bg-primary-soft text-primary mb-2">Focus themes</p>
                                <ul class="list-unstyled">
                                    @forelse($aiInsights['focus'] ?? [] as $focus)
                                        <li class="mb-2"><i class="fas fa-check text-success me-2"></i>{{ $focus }}</li>
                                    @empty
                                        <li class="text-muted">Add at least one journey to unlock tailored focus themes.</li>
                                    @endforelse
                                </ul>
                            </div>
                            <div>
                                <p class="badge bg-secondary-soft text-secondary mb-2">Action board</p>
                                <ul class="list-unstyled">
                                    @forelse($aiInsights['actions'] ?? [] as $action)
                                        <li class="mb-2"><i class="fas fa-arrow-right text-primary me-2"></i>{{ $action }}</li>
                                    @empty
                                        <li class="text-muted">We will populate actions once your journeys are humming.</li>
                                    @endforelse
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-8 mb-4">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-body p-4">
                            <header class="d-flex justify-content-between align-items-center mb-4">
                                <div>
                                    <p class="text-uppercase text-muted small fw-bold mb-1">Recommended programs</p>
                                    <h3 class="h4 mb-0">Curated for this moment</h3>
                                </div>
                                <a href="{{ route('education.tafe.programs.index') }}" class="btn btn-link text-decoration-none">View all</a>
                            </header>

                            <div class="row g-3">
                                @forelse($recommendations as $program)
                                    <div class="col-md-6">
                                        <div class="card h-100 border bg-light">
                                            <div class="card-body">
                                                <span class="badge bg-white text-dark border mb-2">{{ strtoupper(str_replace('_', ' ', $program->credential_level)) }}</span>
                                                <h4 class="h6 mb-1">{{ $program->title }}</h4>
                                                <p class="small text-muted mb-3">{{ $program->institution->name ?? 'Partner campus' }}</p>
                                                <div class="d-flex align-items-center justify-content-between">
                                                    <div class="d-flex align-items-center">
                                                        <span class="fw-bold text-primary me-2">{{ number_format($program->ai_match_score ?? $program->calculated_match_score ?? 0) }}%</span>
                                                        <span class="small text-muted">AI match</span>
                                                    </div>
                                                    <a href="{{ route('education.tafe.programs.show', $program) }}" class="btn btn-sm btn-outline-primary">Open playbook</a>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                @empty
                                    <div class="col-12">
                                        <p class="text-muted text-center py-4">No recommendations yet—add journeys to unlock AI curation.</p>
                                    </div>
                                @endforelse
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    {{-- Journeys & Partners --}}
    <section class="section-shell" aria-label="Journeys &amp; Partners">
        <div class="container">
            <div class="row">
                <div class="col-lg-6 mb-4">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-body p-4">
                            <header class="d-flex justify-content-between align-items-center mb-4">
                                <div>
                                    <p class="text-uppercase text-muted small fw-bold mb-1">Community journeys</p>
                                    <h3 class="h4 mb-0">Active journeys</h3>
                                </div>
                                <span class="badge bg-light text-dark border">{{ collect($journeys)->count() }} tracked</span>
                            </header>

                            <div class="d-flex flex-column gap-3">
                                @forelse($journeys as $journey)
                                    <div class="border-bottom pb-3 last-no-border">
                                        <div class="d-flex justify-content-between align-items-start mb-1">
                                            <h4 class="h6 mb-0">{{ $journey->program->title }}</h4>
                                            <span class="badge bg-success-soft text-success">{{ Str::upper(str_replace('_', ' ', $journey->status)) }}</span>
                                        </div>
                                        <p class="small text-muted mb-2">{{ $journey->program->institution->name ?? 'Partner campus' }}</p>
                                        <div class="d-flex gap-3 small">
                                            <span class="text-warning"><i class="fas fa-bolt me-1"></i>{{ number_format($journey->ai_success_probability, 1) }}% success odds</span>
                                            @if($journey->next_action)
                                                <span class="text-muted"><i class="fas fa-calendar me-1"></i>{{ $journey->next_action }}</span>
                                            @endif
                                        </div>
                                    </div>
                                @empty
                                    <p class="text-muted text-center py-4">Use “Track this program” from any listing to generate your personalised journey.</p>
                                @endforelse
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-lg-6 mb-4">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-body p-4">
                            <header class="mb-4">
                                <p class="text-uppercase text-muted small fw-bold mb-1">Strategic Alliances</p>
                                <h3 class="h4 mb-0">Partnering Institutions</h3>
                            </header>

                            <div class="row g-3">
                                {{-- Mock Partners --}}
                                <div class="col-6">
                                    <div class="p-3 border rounded text-center bg-light h-100 d-flex align-items-center justify-content-center">
                                        <span class="text-muted fw-bold">TAFE NSW</span>
                                    </div>
                                </div>
                                <div class="col-6">
                                    <div class="p-3 border rounded text-center bg-light h-100 d-flex align-items-center justify-content-center">
                                        <span class="text-muted fw-bold">RMIT University</span>
                                    </div>
                                </div>
                                <div class="col-6">
                                    <div class="p-3 border rounded text-center bg-light h-100 d-flex align-items-center justify-content-center">
                                        <span class="text-muted fw-bold">Swinburne</span>
                                    </div>
                                </div>
                                <div class="col-6">
                                    <div class="p-3 border rounded text-center bg-light h-100 d-flex align-items-center justify-content-center">
                                        <span class="text-muted fw-bold">Western Sydney U</span>
                                    </div>
                                </div>
                            </div>

                            <div class="mt-4 d-flex justify-content-between align-items-center">
                                <div>
                                    <p class="small text-muted mb-0">Partner with us to feature your institution.</p>
                                    <p class="small text-muted mb-0">Exclusive scholarships &amp; fast-tracked entry.</p>
                                </div>
                                <a href="#" class="btn btn-sm btn-outline-primary">Become a Partner</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    {{-- Sponsor Showcase --}}
    <section class="section-shell" aria-label="Sponsor Showcase">
        <div class="container">
            <div class="d-flex justify-content-between align-items-end mb-4">
                <div>
                    <p class="section-eyebrow">Sponsorship &amp; Advertising</p>
                    <h3 class="heading-secondary mb-0">Our Corporate Partners</h3>
                </div>
                <a href="#" class="text-muted small text-decoration-none">View Media Kit <i class="fas fa-arrow-right ms-1"></i></a>
            </div>

            <div class="card border-0 shadow-sm bg-dark text-white overflow-hidden mb-4">
                <div class="card-body p-5 text-center position-relative">
                    <div class="position-absolute top-0 start-0 w-100 h-100" style="background: linear-gradient(45deg, rgba(0,0,0,0.8), rgba(0,0,0,0.4)); z-index: 1;"></div>
                    <div class="position-relative" style="z-index: 2;">
                        <span class="badge bg-warning text-dark mb-3">Featured Sponsor</span>
                        <h3 class="display-6 fw-bold mb-3">Future-Proof Your Career with CommBank</h3>
                        <p class="lead mb-4 text-white-50">Exclusive graduate programs and tech internships for women in finance.</p>
                        <a href="#" class="btn btn-light btn-lg px-5">Explore Opportunities</a>
                    </div>
                </div>
            </div>

            <div class="row g-4">
                <div class="col-md-4">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-body text-center p-4">
                            <p class="text-uppercase text-muted small fw-bold mb-2">Industry Partner</p>
                            <h5 class="fw-bold mb-2">Atlassian</h5>
                            <p class="small text-muted mb-3">Tech mentorships &amp; bootcamps.</p>
                            <a href="#" class="btn btn-sm btn-link stretched-link">Learn more</a>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-body text-center p-4">
                            <p class="text-uppercase text-muted small fw-bold mb-2">Industry Partner</p>
                            <h5 class="fw-bold mb-2">Canva</h5>
                            <p class="small text-muted mb-3">Design scholarships for creatives.</p>
                            <a href="#" class="btn btn-sm btn-link stretched-link">Learn more</a>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card border-0 shadow-sm h-100 bg-light d-flex align-items-center justify-content-center" style="border: 2px dashed #dee2e6;">
                        <div class="text-center p-4">
                            <div class="mb-3 text-muted opacity-50">
                                <i class="fas fa-ad fa-2x"></i>
                            </div>
                            <h5 class="fw-bold text-muted">Advertising Space</h5>
                            <p class="small text-muted mb-3">Connect with future leaders.</p>
                            <a href="#" class="btn btn-sm btn-outline-secondary">Media Kit &amp; Rates</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>    {{-- Ecosystem --}}
    <section class="section-shell bg-light" aria-label="Explore the MoneyMan ecosystem">
        <div class="container">
            <header class="mb-5 text-center">
                <p class="section-eyebrow">Across the ecosystem</p>
                <h3 class="heading-secondary">Browse neighbouring portals</h3>
            </header>
            <div class="row g-4">
                @foreach($ecosystemSegments as $segment)
                    <div class="col-md-6 col-lg-3">
                        <div class="card h-100 border-0 shadow-sm hover-lift transition-all">
                            <div class="card-body">
                                <div class="d-flex align-items-center mb-3">
                                    @if(!empty($segment['icon']))
                                        <div class="icon-wrapper bg-primary-soft text-primary rounded-circle p-2 me-3">
                                            <i class="fas {{ $segment['icon'] }} fa-lg"></i>
                                        </div>
                                    @endif
                                    <h4 class="h6 fw-bold mb-0">{{ $segment['title'] }}</h4>
                                </div>
                                <ul class="list-unstyled mb-0">
                                    @foreach($segment['items'] as $item)
                                        <li class="mb-2">
                                            <a href="{{ $item['url'] }}" class="text-decoration-none text-muted hover-primary d-flex align-items-center">
                                                <i class="fas fa-chevron-right fa-xs me-2 opacity-50"></i>
                                                {{ $item['label'] }}
                                            </a>
                                        </li>
                                    @endforeach
                                </ul>
                            </div>
                        </div>
                    </div>
                @endforeach
            </div>
        </div>
    </section>
@endsection
