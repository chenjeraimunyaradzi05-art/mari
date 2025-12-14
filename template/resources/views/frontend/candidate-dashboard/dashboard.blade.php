@extends('frontend.layouts.master')

@php
    $hideIntentLauncher = true;
    $hideGreetingSection = true;
    $hideFocusRail = true;

    $candidate = auth()->user()->candidate;
    $jobAppliedCount = (int) ($jobAppliedCount ?? 0);
    $userBookmarksCount = (int) ($userBookmarksCount ?? 0);
    $totalProgress = (float) $progress->sum('value');
    $totalTarget = max((float) $progress->sum('target'), 1);
    $percent = (int) round(($totalProgress / $totalTarget) * 100);
    $percent = max(min($percent, 100), 0);

    $formatDreamPing = function ($timestamp) {
        if (! $timestamp) {
            return __('Not yet');
        }

        $timezone = auth()->user()?->timezone ?? config('app.timezone');

        return $timestamp->copy()
            ->setTimezone($timezone)
            ->locale('en_AU')
            ->isoFormat('MMM D, h:mma');
    };

    $progressItems = $progress->take(4);
    $badgeHighlights = $badges->take(3);

    $candidateName = auth()->user()?->preferred_name
        ?? auth()->user()?->first_name
        ?? __('friend');

    $heroMetrics = [
        [
            'label' => __('Applications sent'),
            'value' => number_format($jobAppliedCount),
            'context' => __('Total to date'),
            'icon' => 'fas fa-paper-plane',
        ],
        [
            'label' => __('Saved roles'),
            'value' => number_format($userBookmarksCount),
            'context' => __('Ready to revisit'),
            'icon' => 'fas fa-bookmark',
        ],
        [
            'label' => __('Profile score'),
            'value' => number_format((int) ($candidate?->profile_score ?? 0)) . '%',
            'context' => __('Signal strength'),
            'icon' => 'fas fa-id-badge',
        ],
    ];

    $priorityActions = [
        [
            'title' => __('Send two courageous applications before midday.'),
            'copy' => __('Signals keep flowing when you ship work early.'),
            'accent' => 'rgba(99,102,241,0.2)',
            'accent_text' => '#a5b4fc',
        ],
        [
            'title' => __('Invite a trusted ally to review your story.'),
            'copy' => __('Fresh eyes unlock kinder insights.'),
            'accent' => 'rgba(239,68,68,0.2)',
            'accent_text' => '#fca5a5',
        ],
        [
            'title' => __('Clear lingering onboarding steps to unlock nudges.'),
            'copy' => __('Prime Athena to route premium matches your way.'),
            'accent' => 'rgba(148,163,184,0.2)',
            'accent_text' => '#cbd5e1',
        ],
    ];

    $nextMoves = [
        [
            'icon' => 'fas fa-feather',
            'title' => __('Record a 30-second gratitude note to your strongest ally.'),
            'copy' => __('Signals warmth to mentors holding space for you.'),
            'accent' => 'rgba(52,211,153,0.2)',
            'accent_text' => '#6ee7b7',
        ],
        [
            'icon' => 'fas fa-reply-all',
            'title' => __('Drop a fresh update in the community feed.'),
            'copy' => __('Keeps the orbit feminine-forward and focused.'),
            'accent' => 'rgba(99,102,241,0.2)',
            'accent_text' => '#a5b4fc',
        ],
        [
            'icon' => 'fas fa-envelope-open',
            'title' => __('Close out pending invites so networking AI stays accurate.'),
            'copy' => __('Unlocks new matches instantly.'),
            'accent' => 'rgba(239,68,68,0.2)',
            'accent_text' => '#fca5a5',
        ],
    ];

    $wishlistActive = (int) ($dreamTelemetry['active'] ?? 0);
    $wishlistTotal = (int) ($dreamTelemetry['total'] ?? 0);
    $dreamMatches = (int) ($dreamTelemetry['match_count'] ?? 0);

    $signalStats = [
        [
            'label' => __('Dream wishlist entries'),
            'value' => number_format($wishlistTotal),
            'hint' => __('Tracked quietly in the background'),
        ],
        [
            'label' => __('Active signals'),
            'value' => number_format($wishlistActive),
            'hint' => __('Ready for nudges'),
        ],
        [
            'label' => __('Matches delivered'),
            'value' => number_format($dreamMatches),
            'hint' => __('Lifetime warm leads'),
        ],
    ];
@endphp

@push('styles')
    <link rel="stylesheet" href="{{ asset('css/candidate-dashboard.css') }}">
@endpush

@section('title', __('Member Dashboard'))

@section('contents')
    <div class="candidate-dashboard-page">
        <section class="candidate-hero hub-section hub-section--intro" id="candidate-dashboard">
            <div class="container d-flex flex-column gap-4">
                <div class="row g-4 align-items-stretch">
                    <div class="col-12 col-xxl-7">
                        <article class="h-100" style="background:linear-gradient(135deg,#5a1e3a,#6f2d4a 45%,#7f3d5a);color:#fff;border:none;border-radius:2rem;padding:2rem;box-shadow:0 30px 70px -40px rgba(90,30,58,0.8);">
                            <header class="d-flex flex-wrap align-items-center justify-content-between gap-2 gap-md-3 mb-4">
                                <div class="d-flex flex-wrap align-items-center gap-2">
                                    <span class="badge rounded-pill bg-white text-dark text-uppercase fw-semibold" style="letter-spacing:0.3em;">{{ __('Welcome to Athena') }}</span>
                                    <span class="badge rounded-pill bg-white text-dark fw-semibold">
                                        <i class="fas fa-clock me-1" aria-hidden="true"></i>
                                        {{ __('Updated :time', ['time' => now()->format('g:i A')]) }}
                                    </span>
                                </div>
                                <span class="badge rounded-pill bg-white text-dark fw-semibold"><i class="fas fa-sun me-1"></i>{{ __('Morning window') }}</span>
                            </header>
                            <div class="mb-4">
                                <p class="section-eyebrow text-uppercase mb-1" style="letter-spacing:0.3em;color:rgba(255,255,255,0.75);">{{ __('Athena member hub') }}</p>
                                <h1 class="heading-secondary" style="color:#fff;">{{ __('Good morning, :name. Let\'s build something powerful today.', ['name' => $candidateName]) }}</h1>
                                <p class="candidate-hero__lede" style="color:rgba(255,255,255,0.85);">{{ __('Crafted with dignity, respect, and love for every woman who joins Athena. Track applications, unlock AI nudges, and keep your pathways on course without giving an inch to doubt.') }}</p>
                            </div>
                            <div class="row g-3 row-cols-1 row-cols-sm-2 row-cols-lg-3 mb-4" aria-label="{{ __('Key career metrics') }}">
                                @foreach($heroMetrics as $metric)
                                    <div class="col">
                                        <div class="rounded-4 border-0 h-100 p-3" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);">
                                            <span class="badge rounded-circle mb-2" style="background:rgba(255,255,255,0.2);color:#fff;"><i class="{{ $metric['icon'] }}" aria-hidden="true"></i></span>
                                            <p class="text-uppercase small fw-semibold mb-1" style="letter-spacing:0.15em;color:rgba(255,255,255,0.7);">{{ $metric['label'] }}</p>
                                            <p class="fs-3 fw-bold mb-0" style="color:#fff;">{{ $metric['value'] }}</p>
                                            <p class="small mb-0" style="color:rgba(255,255,255,0.7);">{{ $metric['context'] }}</p>
                                        </div>
                                    </div>
                                @endforeach
                            </div>
                            <div class="mb-4">
                                <div class="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
                                    <p class="text-uppercase small fw-semibold mb-0" style="letter-spacing:0.25em;color:#fff;">{{ __('Today\'s priorities') }}</p>
                                    <span class="text-white-75 small">{{ __('Fuel the feed before noon') }}</span>
                                </div>
                                <ol class="list-unstyled row row-cols-1 row-cols-md-3 g-3 mb-0" style="color:#fff;">
                                    @foreach($priorityActions as $index => $priority)
                                        <li class="col">
                                            <div class="h-100 rounded-4 border-0 px-3 py-2 d-flex gap-3 align-items-start" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);">
                                                <span class="badge rounded-circle" style="background:{{ $priority['accent'] }};color:{{ $priority['accent_text'] }};">{{ str_pad($index + 1, 2, '0', STR_PAD_LEFT) }}</span>
                                                <div>
                                                    <p class="fw-semibold mb-1" style="color:#fff;">{{ $priority['title'] }}</p>
                                                    <small class="text-white-75">{{ $priority['copy'] }}</small>
                                                </div>
                                            </div>
                                        </li>
                                    @endforeach
                                </ol>
                            </div>
                            <div class="d-flex flex-wrap align-items-center gap-3">
                                <a class="btn btn-light rounded-pill px-4 py-2 d-inline-flex align-items-center gap-2 fw-semibold text-dark" href="{{ route('member.onboarding.index') }}">
                                    <i class="fas fa-bolt" aria-hidden="true"></i>
                                    <span>{{ __('Open onboarding dashboard') }}</span>
                                </a>
                                <a class="btn rounded-pill px-4 py-2 d-inline-flex align-items-center gap-2 text-nowrap fw-semibold" style="background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.25);" href="{{ route('member.profile.index') }}">
                                    <i class="fas fa-user-plus" aria-hidden="true"></i>
                                    <span>{{ __('Refresh profile story') }}</span>
                                </a>
                            </div>
                        </article>
                    </div>

                    <div class="col-12 col-xxl-5">
                        <article class="h-100" style="background:linear-gradient(135deg,#2b185a,#461867 45%,#7f104e);color:#fff;border:none;border-radius:2rem;padding:2rem;box-shadow:0 30px 70px -40px rgba(47,12,73,0.9);">
                            <div class="rounded-4 border-0 text-white p-4 h-100" style="background:linear-gradient(120deg,#1e0d3f,#3a1680 55%,#6525b6);">
                                <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
                                    <div>
                                        <p class="text-uppercase small mb-1 text-white-50" style="letter-spacing:0.3em;">{{ __('Athena Pulse') }}</p>
                                        <h3 class="h4 fw-semibold mb-0 text-white">{{ __('Network snapshot') }}</h3>
                                        <p class="mb-0 text-white-75">{{ __('Athena watches your moves in real time and filters noise so you stay brave.') }}</p>
                                    </div>
                                    <span class="badge bg-white text-dark fw-semibold">
                                        <i class="fas fa-wave-square me-1" aria-hidden="true"></i>
                                        {{ __('Live') }}
                                    </span>
                                </div>
                                <div class="mb-4">
                                    <p class="text-uppercase small fw-semibold mb-1" style="letter-spacing:0.2em;color:rgba(255,255,255,0.75);">{{ __('Momentum level') }}</p>
                                    <div class="d-flex align-items-center gap-3">
                                        <strong class="display-6 mb-0" style="color:#fff;">{{ $percent }}%</strong>
                                        <div class="flex-grow-1">
                                            <div class="progress" style="height:6px;background:rgba(255,255,255,0.25);">
                                                <div class="progress-bar bg-warning" style="width: {{ $percent }}%;"></div>
                                            </div>
                                            <p class="small mt-2 mb-0 text-white-75">{{ __('Complete onboarding actions to hit 100%.') }}</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-4">
                                    <div class="d-flex align-items-center justify-content-between mb-3">
                                        <p class="text-uppercase small fw-semibold mb-0 text-white" style="letter-spacing:0.2em;">{{ __('Next moves') }}</p>
                                        <span class="badge bg-white text-dark fw-semibold"><i class="fas fa-brain me-1"></i>{{ __('AI cue') }}</span>
                                    </div>
                                    <div class="d-flex flex-column gap-3">
                                        @foreach($nextMoves as $move)
                                            <div class="d-flex gap-3 align-items-start p-3 rounded-4 border-0" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);">
                                                <span class="badge rounded-circle p-3" style="background:{{ $move['accent'] }};color:{{ $move['accent_text'] }};"><i class="{{ $move['icon'] }}" aria-hidden="true"></i></span>
                                                <div>
                                                    <p class="fw-semibold mb-1" style="color:#fff;">{{ $move['title'] }}</p>
                                                    <small class="text-white-75">{{ $move['copy'] }}</small>
                                                </div>
                                            </div>
                                        @endforeach
                                    </div>
                                </div>
                                <div class="d-grid gap-3" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));">
                                    @foreach($signalStats as $stat)
                                        <div class="rounded-4 border-0 p-3" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);">
                                            <p class="text-uppercase small fw-semibold mb-1" style="letter-spacing:0.15em;color:rgba(255,255,255,0.75);">{{ $stat['label'] }}</p>
                                            <p class="fs-4 fw-bold mb-0" style="color:#fff;">{{ $stat['value'] }}</p>
                                            <p class="small mb-0" style="color:rgba(255,255,255,0.7);">{{ $stat['hint'] }}</p>
                                        </div>
                                    @endforeach
                                </div>
                            </div>
                        </article>
                    </div>
                </div>

                <div class="candidate-hero__utility mt-2 d-flex flex-column flex-lg-row gap-3 align-items-stretch">
                    <div class="candidate-progress-chip flex-shrink-0" aria-live="polite">
                        <p class="candidate-progress-chip__label">{{ __('Momentum level') }}</p>
                        <strong class="candidate-progress-chip__value">{{ $percent }}%</strong>
                        <span class="candidate-progress-chip__copy">{{ __('Complete onboarding actions to hit 100%.') }}</span>
                    </div>
                    <nav class="candidate-nav flex-grow-1" aria-label="{{ __('Member dashboard navigation') }}">
                        <a class="candidate-nav__link {{ request()->routeIs('member.dashboard') ? 'is-active' : '' }}" href="{{ route('member.dashboard') }}">{{ __('Dashboard') }}</a>
                        <a class="candidate-nav__link {{ request()->routeIs('member.applied-jobs.*') ? 'is-active' : '' }}" href="{{ route('member.applied-jobs.index') }}">{{ __('Applied jobs') }}</a>
                        <a class="candidate-nav__link {{ request()->routeIs('member.bookmarked-jobs.*') ? 'is-active' : '' }}" href="{{ route('member.bookmarked-jobs.index') }}">{{ __('Bookmarks') }}</a>
                        <a class="candidate-nav__link {{ request()->routeIs('member.profile.*') ? 'is-active' : '' }}" href="{{ route('member.profile.index') }}">{{ __('My profile') }}</a>
                        <form class="candidate-nav__form" method="POST" action="{{ route('logout') }}">
                            @csrf
                            <button type="submit" class="candidate-nav__link candidate-nav__link--action">{{ __('Logout') }}</button>
                        </form>
                    </nav>
                </div>
            </div>
        </section>

        <section class="candidate-section" id="candidate-progress">
            <header class="candidate-section__header">
                <div>
                    <p class="section-eyebrow">{{ __('Momentum snapshot') }}</p>
                    <h2 class="heading-secondary">{{ __('Progress & badges') }}</h2>
                    <p>{{ __('Small steps compound into stronger job matches.') }}</p>
                </div>
            </header>
            <div class="candidate-card-grid candidate-card-grid--two">
                <article class="dashboard-card candidate-card">
                    <p class="dashboard-eyebrow">{{ __('Onboarding checklist') }}</p>
                    <ul class="progress-list">
                        @forelse($progressItems as $item)
                            @php
                                $target = max((int) $item->target, 1);
                                $value = (int) min($item->value, $target);
                                $label = \Illuminate\Support\Str::headline(str_replace('_', ' ', $item->type));
                            @endphp
                            <li class="progress-list__item">
                                <div class="progress-list__meta">
                                    <span class="progress-list__label">{{ $label }}</span>
                                    <span class="progress-list__value">{{ $value }} / {{ $target }}</span>
                                </div>
                                <progress class="progress-meter" value="{{ $value }}" max="{{ $target }}">
                                    {{ $value }}
                                </progress>
                            </li>
                        @empty
                            <li class="progress-list__item is-empty">
                                {{ __('Progress tracking will appear once you complete onboarding steps.') }}
                            </li>
                        @endforelse
                    </ul>
                </article>

                <article class="dashboard-card candidate-card">
                    @php $badgeCount = $badgeHighlights->count(); @endphp
                    <div class="candidate-card__header">
                        <div>
                            <p class="dashboard-eyebrow">{{ __('Unlocked badges') }}</p>
                            <h3 class="dashboard-heading dashboard-heading--sm">{{ trans_choice('{0} No badges yet|{1} :count badge|[2,*] :count badges', $badgeCount, ['count' => $badgeCount]) }}</h3>
                        </div>
                        <a class="link-arrow" href="{{ route('member.profile.index') }}">{{ __('View profile signals') }}</a>
                    </div>
                    <div class="badge-grid">
                        @forelse($badgeHighlights as $badge)
                            <article class="badge-card">
                                <div class="badge-card__media" aria-hidden="true">
                                    @if(! empty($badge->icon))
                                        <i class="{{ $badge->icon }}"></i>
                                    @else
                                        <span>★</span>
                                    @endif
                                </div>
                                <div>
                                    <p class="badge-card__title">{{ $badge->name }}</p>
                                    <p class="badge-card__meta">{{ $badge->rarity_label ?? __('Badge') }}</p>
                                    <p class="badge-card__copy">{{ $badge->description ?? __('Awarded for consistent momentum inside Athena.') }}</p>
                                </div>
                            </article>
                        @empty
                            <div class="dashboard-empty">
                                <p class="dashboard-empty__title">{{ __('Badges unlock soon') }}</p>
                                <p class="dashboard-empty__copy">{{ __('Complete onboarding actions to earn your first badge.') }}</p>
                            </div>
                        @endforelse
                    </div>
                </article>
            </div>
        </section>

        <section class="candidate-section" id="candidate-dreams">
            <header class="candidate-section__header">
                <div>
                    <p class="section-eyebrow">{{ __('Dream pathway waitlist') }}</p>
                    <h2 class="heading-secondary">{{ __('Respectful monitoring in the background') }}</h2>
                    <p>{{ __('We monitor your saved dreams and surface warm nudges first.') }}</p>
                </div>
                <a class="link-arrow" href="{{ route('careers.wishlist') }}">{{ __('Tune wishlist') }}</a>
            </header>
            <div class="dashboard-wishlist">
                @if(($dreamTelemetry['total'] ?? 0) === 0)
                    <div class="dashboard-empty">
                        <p class="dashboard-empty__title">{{ __('Add your first dream intention') }}</p>
                        <p class="dashboard-empty__copy">{{ __('Capture roles or courses and Athena scouts in the background.') }}</p>
                        <a class="btn btn-secondary btn-pill" href="{{ route('careers.wishlist') }}">{{ __('Open dream wishlist') }}</a>
                    </div>
                @else
                    <div class="dashboard-wishlist__summary">
                        <p class="dashboard-eyebrow">{{ $dreamTelemetry['headline'] }}</p>
                        <p class="dashboard-summary-card__value">{{ $dreamTelemetry['active'] }} / {{ $dreamTelemetry['total'] }}</p>
                        <p class="dashboard-summary-card__copy">{{ __('Last warm ping: :ping', ['ping' => $formatDreamPing($dreamTelemetry['last_ping'] ?? null)]) }}</p>
                        <p class="dashboard-summary-card__copy">{{ __(':matches matches delivered', ['matches' => number_format($dreamTelemetry['match_count'])]) }}</p>
                    </div>
                    <div class="dashboard-wishlist__list">
                        @foreach($dreamTelemetry['entries'] as $entry)
                            @php
                                $statusClasses = match ($entry['status']) {
                                    'active' => 'status-pill status-pill--success',
                                    'paused' => 'status-pill status-pill--pause',
                                    'fulfilled' => 'status-pill status-pill--neutral',
                                    default => 'status-pill',
                                };
                            @endphp
                            <article class="waitlist-card">
                                <div class="waitlist-card__header">
                                    <div>
                                        <p class="dashboard-eyebrow">{{ \Illuminate\Support\Str::headline(str_replace('_', ' ', $entry['pathway_type'])) }}</p>
                                        <h3 class="waitlist-card__title">{{ $entry['title'] }}</h3>
                                        <p class="waitlist-card__summary">{{ $entry['preferred_location'] ?? __('Flexible location') }}</p>
                                    </div>
                                    <span class="{{ $statusClasses }}">{{ ucfirst($entry['status']) }}</span>
                                </div>
                                <dl class="waitlist-card__meta">
                                    <div class="waitlist-card__meta-item">
                                        <dt>{{ __('Matches') }}</dt>
                                        <dd>{{ number_format($entry['match_count']) }}</dd>
                                    </div>
                                    <div class="waitlist-card__meta-item">
                                        <dt>{{ __('Last ping') }}</dt>
                                        <dd>{{ $formatDreamPing($entry['last_matched_at'] ?? null) }}</dd>
                                    </div>
                                </dl>
                                <div class="waitlist-card__signals">
                                    <span class="signal-pill">
                                        <span class="signal-indicator {{ $entry['notify_in_app'] ? 'is-on' : '' }}"></span>
                                        {{ __('In-app :state', ['state' => $entry['notify_in_app'] ? __('on') : __('off')]) }}
                                    </span>
                                    <span class="signal-pill">
                                        <span class="signal-indicator {{ $entry['notify_email'] ? 'is-on' : '' }}"></span>
                                        {{ __('Email :state', ['state' => $entry['notify_email'] ? __('on') : __('off')]) }}
                                    </span>
                                </div>
                            </article>
                        @endforeach
                    </div>
                @endif
            </div>
        </section>

        <section class="candidate-section" id="candidate-actions">
            <header class="candidate-section__header">
                <div>
                    <p class="section-eyebrow">{{ __('Action centre') }}</p>
                    <h2 class="heading-secondary">{{ __('Keep the flywheel moving') }}</h2>
                </div>
            </header>
            @php
                $actionCards = [
                    [
                        'title' => __('Refresh my story'),
                        'copy' => __('Update your member profile so AI matches stay sharp.'),
                        'cta' => __('Go to profile'),
                        'href' => route('member.profile.index'),
                    ],
                    [
                        'title' => __('Track onboarding steps'),
                        'copy' => __('Finish outstanding items to unlock premium nudges.'),
                        'cta' => __('Open onboarding'),
                        'href' => route('member.onboarding.index'),
                    ],
                    [
                        'title' => __('Tune dream wishlist'),
                        'copy' => __('Add roles, apprenticeships, or study pathways for background scouting.'),
                        'cta' => __('Manage wishlist'),
                        'href' => route('careers.wishlist'),
                    ],
                ];
            @endphp
            <div class="action-grid">
                @foreach($actionCards as $card)
                    <article class="action-card">
                        <h3 class="action-card__title">{{ $card['title'] }}</h3>
                        <p class="action-card__copy">{{ $card['copy'] }}</p>
                        <a class="btn btn-ghost btn-pill" href="{{ $card['href'] }}">{{ $card['cta'] }}</a>
                    </article>
                @endforeach
            </div>
        </section>

        <section class="candidate-section" id="candidate-applications">
            <header class="candidate-section__header">
                <div>
                    <p class="section-eyebrow">{{ __('Recent applications') }}</p>
                    <h2 class="heading-secondary">{{ __('Your latest signals to employers') }}</h2>
                </div>
                <a class="link-arrow" href="{{ route('member.applied-jobs.index') }}">{{ __('View all') }}</a>
            </header>
            @if($appliedJobs->isEmpty())
                <div class="dashboard-empty">
                    <p class="dashboard-empty__title">{{ __('No applications yet') }}</p>
                    <p class="dashboard-empty__copy">{{ __('Use job matches or the public job board to send your first application.') }}</p>
                </div>
            @else
                <ul class="application-list">
                    @foreach($appliedJobs as $applied)
                        @php
                            $job = $applied->job;
                            $timelineLabel = optional($job)->created_at?->diffForHumans() ?? optional($applied->created_at)->diffForHumans();
                            $jobLink = $job?->slug ? route('jobs.show', $job->slug) : '#';
                        @endphp
                        <li class="application-row">
                            <div>
                                <p class="application-row__title">{{ $job->title ?? __('Opportunity pending') }}</p>
                                <p class="application-row__meta">{{ optional($job->company)->name ?? __('Confidential company') }}</p>
                            </div>
                            <div class="application-row__status">
                                <span>{{ $timelineLabel }}</span>
                                <a class="link-arrow" href="{{ $jobLink }}">{{ __('View job') }}</a>
                            </div>
                        </li>
                    @endforeach
                </ul>
            @endif
        </section>

        <section class="candidate-section" id="candidate-matches">
            <header class="candidate-section__header">
                <div>
                    <p class="section-eyebrow">{{ __('AI-powered matches') }}</p>
                    <h2 class="heading-secondary">{{ __('Curated roles for your profile') }}</h2>
                </div>
            </header>
            <div class="dashboard-card-grid">
                @forelse($aiJobMatches as $match)
                    @php
                        $job = $match['job'];
                        $jobLink = (!empty($job) && !empty($job->slug)) ? route('jobs.show', $job->slug) : '#';
                    @endphp
                    <article class="dashboard-card">
                        <p class="dashboard-eyebrow">{{ optional($job?->company)->name ?? __('Confidential company') }}</p>
                        <h3 class="dashboard-heading dashboard-heading--sm">{{ $job->title ?? __('Opportunity pending') }}</h3>
                        <ul class="match-meta">
                            <li>
                                <span>{{ __('Match score') }}</span>
                                <strong>{{ $match['score'] }}%</strong>
                            </li>
                            <li>
                                <span>{{ __('Key skills') }}</span>
                                <strong>{{ implode(', ', $match['matched_skills'] ?? $match['skill_matches'] ?? []) ?: __('Pending signal') }}</strong>
                            </li>
                            <li>
                                <span>{{ __('Upskill ideas') }}</span>
                                <strong>{{ implode(', ', $match['missing_skills'] ?? []) ?: __('None flagged') }}</strong>
                            </li>
                        </ul>
                        <a class="btn btn-secondary btn-pill" href="{{ $jobLink }}">{{ __('View job') }}</a>
                    </article>
                @empty
                    <div class="dashboard-empty">
                        <p class="dashboard-empty__title">{{ __('Personalised matches on the way') }}</p>
                        <p class="dashboard-empty__copy">{{ __('Update your profile and wishlist to unlock AI-matched opportunities.') }}</p>
                    </div>
                @endforelse
            </div>
        </section>

        <section class="candidate-section" id="candidate-insights">
            <header class="candidate-section__header">
                <div>
                    <p class="section-eyebrow">{{ __('AI career insights') }}</p>
                    <h2 class="heading-secondary">{{ __('A quick read on your trajectory') }}</h2>
                </div>
            </header>
            <article class="dashboard-card">
                @if($careerInsights)
                    @php
                        $currentRole = data_get($careerInsights, 'current_position.current_role', __('Not captured yet'));
                        $totalExperience = data_get($careerInsights, 'current_position.total_experience');
                    @endphp
                    <ul class="insights-list">
                        <li class="insight-row">
                            <span class="insight-label"><i class="fas fa-user-tie" aria-hidden="true"></i>{{ __('Current position') }}</span>
                            <span class="insight-value">{{ $currentRole }}</span>
                        </li>
                        <li class="insight-row">
                            <span class="insight-label"><i class="fas fa-hourglass-half" aria-hidden="true"></i>{{ __('Total experience') }}</span>
                            <span class="insight-value">{{ $totalExperience !== null ? $totalExperience . ' ' . __('years') : __('N/A') }}</span>
                        </li>
                        <li class="insight-row">
                            <span class="insight-label"><i class="fas fa-lightbulb" aria-hidden="true"></i>{{ __('Skill analysis') }}</span>
                            <span class="insight-value insight-value--focus">{{ data_get($careerInsights, 'skill_analysis.summary', __('N/A')) }}</span>
                        </li>
                        <li class="insight-row">
                            <span class="insight-label"><i class="fas fa-route" aria-hidden="true"></i>{{ __('Career progression') }}</span>
                            <span class="insight-value">{{ data_get($careerInsights, 'career_progression.summary', __('N/A')) }}</span>
                        </li>
                        <li class="insight-row">
                            <span class="insight-label"><i class="fas fa-dollar-sign" aria-hidden="true"></i>{{ __('Salary insights') }}</span>
                            <span class="insight-value insight-value--highlight">{{ data_get($careerInsights, 'salary_insights.summary', __('N/A')) }}</span>
                        </li>
                        <li class="insight-row">
                            <span class="insight-label"><i class="fas fa-graduation-cap" aria-hidden="true"></i>{{ __('Learning recommendations') }}</span>
                            <span class="insight-value insight-value--focus">{{ data_get($careerInsights, 'learning_recommendations.summary', __('N/A')) }}</span>
                        </li>
                        <li class="insight-row">
                            <span class="insight-label"><i class="fas fa-chart-line" aria-hidden="true"></i>{{ __('Industry trends') }}</span>
                            <span class="insight-value">{{ data_get($careerInsights, 'industry_trends.summary', __('N/A')) }}</span>
                        </li>
                        <li class="insight-row">
                            <span class="insight-label"><i class="fas fa-rocket" aria-hidden="true"></i>{{ __('Next opportunities') }}</span>
                            <span class="insight-value insight-value--highlight">{{ data_get($careerInsights, 'next_opportunities.summary', __('N/A')) }}</span>
                        </li>
                        <li class="insight-row">
                            <span class="insight-label"><i class="fas fa-balance-scale" aria-hidden="true"></i>{{ __('Strengths & weaknesses') }}</span>
                            <span class="insight-value insight-value--focus">{{ data_get($careerInsights, 'strength_weakness.summary', __('N/A')) }}</span>
                        </li>
                    </ul>
                @else
                    <div class="dashboard-empty">
                        <p class="dashboard-empty__title">{{ __('Insights will appear once ready') }}</p>
                        <p class="dashboard-empty__copy">{{ __('Complete more profile fields so Athena can compose your career pulse.') }}</p>
                    </div>
                @endif
            </article>
        </section>

        <section class="candidate-section" id="candidate-ai">
            <header class="candidate-section__header">
                <div>
                    <p class="section-eyebrow">{{ __('Your AI toolkit') }}</p>
                    <h2 class="heading-secondary">{{ __('Explore Athena assistants and builders') }}</h2>
                </div>
            </header>
            @include('frontend.home.sections.ai-features-cards', ['homepageSponsorSlots' => []])
        </section>

        @if(!empty($socialBackbone))
            <section class="candidate-section" id="candidate-community">
                <header class="candidate-section__header">
                    <div>
                        <p class="section-eyebrow">{{ __('Community footprint') }}</p>
                        <h2 class="heading-secondary">{{ __('Social data backbone snapshot') }}</h2>
                    </div>
                </header>
                @include('frontend.candidate-dashboard.sections.social-backbone', ['socialBackbone' => $socialBackbone, 'socialBackboneMeta' => $socialBackboneMeta])
            </section>
        @endif
    </div>
@endsection

@if(!empty($socialBackbone))
    @push('scripts')
        <script>
            window.WomenRise = window.WomenRise || {};
            window.WomenRise.socialBackbone = {
                payload: @json($socialBackbone),
                meta: @json($socialBackboneMeta ?? []),
                endpoint: @json(route('api.v1.social.backbone')),
            };
        </script>
    @endpush
@endif

