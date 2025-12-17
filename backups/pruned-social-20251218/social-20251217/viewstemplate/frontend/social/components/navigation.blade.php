@php
    $metrics = $metrics ?? \App\Support\SocialMetrics::forUser(auth()->user());
    $counts = $metrics['counts'] ?? [
        'connections' => 0,
        'groups' => 0,
        'pendingInvites' => 0,
    ];

    $profileUsername = auth()->user()?->socialProfile?->username ?? (auth()->check() ? 'me' : null);

    $navItems = [
        [
            'label' => 'Feed',
            'icon' => 'fas fa-stream',
            'route' => route('social.posts.index'),
            'active' => request()->routeIs('social.posts.*'),
        ],
        [
            'label' => 'Profile',
            'icon' => 'fas fa-id-card',
            'route' => $profileUsername ? route('social.profiles.show', $profileUsername) : '#',
            'active' => request()->routeIs('social.profiles.*'),
        ],
        [
            'label' => 'Connections',
            'icon' => 'fas fa-user-friends',
            'route' => route('member.social.connections'),
            'active' => request()->routeIs('member.social.connections'),
            'badge' => $counts['pendingInvites'] ?? 0,
        ],
        [
            'label' => 'Groups',
            'icon' => 'fas fa-users',
            'route' => route('member.social.groups'),
            'active' => request()->routeIs('member.social.groups'),
            'badge' => $counts['groups'] ?? 0,
        ],
    ];

    $mentorRoles = array_filter(config('social.moderation.mentor_roles', []));
    if (auth()->check() && !empty($mentorRoles) && method_exists(auth()->user(), 'hasAnyRole') && auth()->user()->hasAnyRole($mentorRoles)) {
        $navItems[] = [
            'label' => 'Safety Desk',
            'icon' => 'fas fa-shield-alt',
            'route' => route('mentor.moderation.dashboard'),
            'active' => request()->routeIs('mentor.moderation.*'),
        ];
    }

    if (\App\Support\FeatureFlag::enabled('social.feed.enabled')) {
        $navItems[] = [
            'label' => 'Feed Filters',
            'icon' => 'fas fa-filter',
            'route' => route('social.feed.preview'),
            'active' => request()->routeIs('social.feed.preview'),
        ];
    }

    $heroName = auth()->user()?->preferred_name ?? auth()->user()?->first_name ?? __('friend');
    $signalStrength = (int) data_get($metrics, 'signals.strength', 82);
    $allyMomentum = (int) data_get($metrics, 'signals.allyMomentum', 68);
    $responseConfidence = (int) data_get($metrics, 'signals.responseMinutes', 12);
    $pendingInvites = (int) ($counts['pendingInvites'] ?? 0);

    $statCards = [
        [
            'label' => 'New allies',
            'icon' => 'fas fa-user-plus',
            'value' => (int) data_get($metrics, 'weekly.newConnections', 14),
            'description' => 'Joined this week',
            'progressWidth' => (int) data_get($metrics, 'weekly.newConnectionsPercent', 64),
            'progressColor' => '#f472b6',
        ],
        [
            'label' => 'Micro-group posts',
            'icon' => 'fas fa-comments',
            'value' => (int) data_get($metrics, 'weekly.groupPosts', 32),
            'description' => 'Signals amplified',
            'progressWidth' => (int) data_get($metrics, 'weekly.groupPostsPercent', 58),
            'progressColor' => '#c084fc',
        ],
        [
            'label' => 'Invites triaged',
            'icon' => 'fas fa-inbox',
            'value' => (int) data_get($metrics, 'weekly.invitesHandled', 21),
            'description' => 'Cleared by you',
            'progressWidth' => min(100, max(0, 100 - $pendingInvites)),
            'progressColor' => '#facc15',
        ],
        [
            'label' => 'Supportive reactions',
            'icon' => 'fas fa-hand-holding-heart',
            'value' => (int) data_get($metrics, 'weekly.supportiveReacts', 118),
            'description' => 'Past 7 days',
            'progressWidth' => (int) data_get($metrics, 'weekly.supportiveReactsPercent', 72),
            'progressColor' => '#34d399',
        ],
    ];
@endphp

<nav class="social-nav">
    <div class="social-nav__canvas"></div>
    <div class="social-nav__glow"></div>

    <div class="social-nav__inner">
        <section class="social-nav__hero mb-5">
            <div class="row g-4 align-items-stretch">
                <div class="col-12 col-xxl-7">
                    <div class="social-nav__hero-copy h-100" style="background:linear-gradient(135deg,#5a1e3a,#6f2d4a 45%,#7f3d5a);color:#fff;border:none;border-radius:2rem;padding:2rem;box-shadow:0 28px 60px -32px rgba(90,30,58,0.55);">
                        <header class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                            <div class="d-flex flex-wrap align-items-center gap-2">
                                <span class="badge rounded-pill bg-white text-dark text-uppercase fw-semibold" style="letter-spacing:0.3em;"><i class="fas fa-magic me-1"></i>Athena Pulse</span>
                                <span class="badge rounded-pill bg-white text-dark fw-semibold">
                                    <i class="fas fa-clock me-1" aria-hidden="true"></i>
                                    Updated {{ now()->format('g:i A') }}
                                </span>
                            </div>
                            <span class="badge rounded-pill bg-white text-dark fw-semibold"><i class="fas fa-sun me-1"></i>Morning window</span>
                        </header>
                        <div class="row g-4 align-items-start">
                            <div class="col-lg-7 d-flex flex-column gap-3">
                                <div>
                                    <h1 class="social-nav__headline mb-2" style="color:#fff;">Morning launch, {{ $heroName }}. Let's set the tone for courageous moves.</h1>
                                    <p class="social-nav__support mb-0" style="color:rgba(255,255,255,0.85);">Athena keeps the space soft and brave—blending capital conversations, wellbeing check-ins, and ally intel so every decision honours dignity.</p>
                                </div>
                                <div>
                                    <div class="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
                                        <p class="text-uppercase small fw-semibold mb-0" style="letter-spacing:0.25em;color:#fff;">Today's priorities</p>
                                        <span class="text-white-75 small">Fuel the feed before noon</span>
                                    </div>
                                    <ol class="list-unstyled row row-cols-1 row-cols-sm-2 row-cols-lg-1 row-cols-xxl-3 g-3 mb-0" style="color:#fff;">
                                        <li class="col">
                                            <div class="h-100 rounded-4 border-0 px-3 py-2 d-flex gap-3 align-items-start" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);">
                                                <span class="badge rounded-circle" style="background:rgba(99,102,241,0.2);color:#a5b4fc;">01</span>
                                                <div>
                                                    <p class="fw-semibold mb-1" style="color:#fff;">Surface two women-led wins into the feed carousel.</p>
                                                    <small class="text-white-75">Keeps the carousel celebratory.</small>
                                                </div>
                                            </div>
                                        </li>
                                        <li class="col">
                                            <div class="h-100 rounded-4 border-0 px-3 py-2 d-flex gap-3 align-items-start" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);">
                                                <span class="badge rounded-circle" style="background:rgba(239,68,68,0.2);color:#fca5a5;">02</span>
                                                <div>
                                                    <p class="fw-semibold mb-1" style="color:#fff;">Invite trusted allies into the wellbeing micro-group.</p>
                                                    <small class="text-white-75">Nurture the restorative circle.</small>
                                                </div>
                                            </div>
                                        </li>
                                        <li class="col">
                                            <div class="h-100 rounded-4 border-0 px-3 py-2 d-flex gap-3 align-items-start" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);">
                                                <span class="badge rounded-circle" style="background:rgba(148,163,184,0.2);color:#cbd5e1;">03</span>
                                                <div>
                                                    <p class="fw-semibold mb-1" style="color:#fff;">Clear pending invites so networking AI can unlock fresh matches.</p>
                                                    <small class="text-white-75">Fresh matches arrive once triaged.</small>
                                                </div>
                                            </div>
                                        </li>
                                    </ol>
                                </div>
                                <div class="d-flex flex-wrap align-items-center gap-3">
                                    <a href="{{ route('social.posts.index') }}" class="btn btn-light rounded-pill px-4 py-2 d-inline-flex align-items-center gap-2 fw-semibold text-dark">
                                        <i class="fas fa-bolt" aria-hidden="true"></i>
                                        <span>Open social feed</span>
                                    </a>
                                    <a href="{{ route('member.social.connections') }}" class="btn rounded-pill px-4 py-2 d-inline-flex align-items-center gap-2 text-nowrap fw-semibold" style="background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.25);">
                                        <i class="fas fa-user-plus" aria-hidden="true"></i>
                                        <span>Review pending invites</span>
                                    </a>
                                </div>
                            </div>
                            <div class="col-lg-5">
                                <div class="row g-3 row-cols-1 row-cols-sm-2 row-cols-md-3">
                                    <div class="col">
                                        <div class="rounded-4 border-0 p-3 h-100 d-flex flex-column justify-content-between" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);">
                                            <div>
                                                <p class="text-uppercase small fw-semibold mb-1" style="letter-spacing:0.18em;color:rgba(255,255,255,0.75);">Signal strength</p>
                                                <p class="fs-4 fw-bold mb-0" style="color:#fff;">{{ $signalStrength }}%</p>
                                            </div>
                                            <span class="badge rounded-circle align-self-start p-3" style="background:rgba(255,255,255,0.2);color:#34d399;"><i class="fas fa-sparkles" aria-hidden="true"></i></span>
                                        </div>
                                    </div>
                                    <div class="col">
                                        <div class="rounded-4 border-0 p-3 h-100 d-flex flex-column justify-content-between" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);">
                                            <div>
                                                <p class="text-uppercase small fw-semibold mb-1" style="letter-spacing:0.18em;color:rgba(255,255,255,0.75);">Ally momentum</p>
                                                <p class="fs-4 fw-bold mb-0" style="color:#fff;">{{ $allyMomentum }}%</p>
                                            </div>
                                            <span class="badge rounded-circle align-self-start p-3" style="background:rgba(255,255,255,0.2);color:#38bdf8;"><i class="fas fa-hand-holding-heart" aria-hidden="true"></i></span>
                                        </div>
                                    </div>
                                    <div class="col">
                                        <div class="rounded-4 border-0 p-3 h-100 d-flex flex-column justify-content-between" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);">
                                            <div>
                                                <p class="text-uppercase small fw-semibold mb-1" style="letter-spacing:0.18em;color:rgba(255,255,255,0.75);">Avg response</p>
                                                <p class="fs-4 fw-bold mb-0" style="color:#fff;">{{ $responseConfidence }}m</p>
                                            </div>
                                            <span class="badge rounded-circle align-self-start p-3" style="background:rgba(255,255,255,0.2);color:#facc15;"><i class="fas fa-stopwatch" aria-hidden="true"></i></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-12 col-xxl-5">
                    <div class="social-nav__hero-panel h-100" aria-label="Live signal board" style="background:linear-gradient(135deg,#2b185a,#461867 45%,#7f104e);color:#fff;border:none;border-radius:2rem;padding:2rem;box-shadow:0 28px 60px -32px rgba(98,0,138,0.55);">
                        <div class="row g-3 align-items-stretch h-100">
                            <div class="col-xl-7">
                                <div class="rounded-4 border-0 text-white p-4 h-100 position-relative overflow-hidden" style="background:linear-gradient(120deg,#1e0d3f,#3a1680 55%,#6525b6);">
                                    <div class="d-flex justify-content-between align-items-start gap-3">
                                        <div>
                                            <p class="text-uppercase small mb-1 text-white-50" style="letter-spacing:0.3em;">Network snapshot</p>
                                            <h3 class="h4 fw-semibold mb-0 text-white">Live community pulse</h3>
                                            <p class="mb-0 text-white-75">Athena AI is holding space and filtering noise in real time.</p>
                                        </div>
                                        <span class="badge bg-white text-dark fw-semibold">
                                            <i class="fas fa-wave-square me-1" aria-hidden="true"></i>
                                            Live
                                        </span>
                                    </div>
                                    <div class="progress mt-3" style="height:6px;background:rgba(255,255,255,0.25);">
                                        <div class="progress-bar bg-warning" style="width: {{ $signalStrength }}%;"></div>
                                    </div>
                                    <p class="small mt-2 mb-0 text-white-75">Signal guardians say the mix is {{ $signalStrength > 70 ? 'steady' : 'warming up' }}.</p>
                                </div>
                            </div>
                            <div class="col-xl-5">
                                <div class="rounded-4 border-0 h-100 p-4" style="background:linear-gradient(135deg,#3a1e5a,#4a2d6f 45%,#5a3d7f);color:#fff;">
                                    <div class="d-flex align-items-center justify-content-between mb-3">
                                        <p class="text-uppercase small fw-semibold mb-0 text-white" style="letter-spacing:0.2em;">Next moves</p>
                                        <span class="badge bg-white text-dark fw-semibold"><i class="fas fa-brain me-1"></i>AI cue</span>
                                    </div>
                                    <div class="d-flex flex-column gap-3">
                                        <div class="d-flex gap-3 align-items-start p-3 rounded-4 border-0" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);">
                                            <span class="badge rounded-circle p-3" style="background:rgba(52,211,153,0.2);color:#6ee7b7;"><i class="fas fa-feather" aria-hidden="true"></i></span>
                                            <div>
                                                <p class="fw-semibold mb-1" style="color:#fff;">Send a gratitude note to your most active connection.</p>
                                                <small class="text-white-75">Keeps warmth flowing through the orbit.</small>
                                            </div>
                                        </div>
                                        <div class="d-flex gap-3 align-items-start p-3 rounded-4 border-0" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);">
                                            <span class="badge rounded-circle p-3" style="background:rgba(99,102,241,0.2);color:#a5b4fc;"><i class="fas fa-reply-all" aria-hidden="true"></i></span>
                                            <div>
                                                <p class="fw-semibold mb-1" style="color:#fff;">Share a reel to keep the feed feminine-forward.</p>
                                                <small class="text-white-75">Signals stay curated when you post.</small>
                                            </div>
                                        </div>
                                        <div class="d-flex gap-3 align-items-start p-3 rounded-4 border-0" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);">
                                            <span class="badge rounded-circle p-3" style="background:rgba(239,68,68,0.2);color:#fca5a5;"><i class="fas fa-envelope-open" aria-hidden="true"></i></span>
                                            <div>
                                                <p class="fw-semibold mb-1" style="color:#fff;">Close out {{ number_format($pendingInvites) }} invites to keep networking AI accurate.</p>
                                                <small class="text-white-75">Unlocks new matches instantly.</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="mt-4">
                            <div class="d-grid gap-3 gap-xl-4" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));">
                                @foreach ($statCards as $card)
                                    <div class="rounded-4 p-3 border-0 h-100" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);">
                                        <div class="d-flex align-items-center justify-content-between mb-1">
                                            <p class="text-uppercase small fw-semibold mb-0" style="letter-spacing:0.15em;color:rgba(255,255,255,0.75);">{{ $card['label'] }}</p>
                                            <span class="badge rounded-circle" style="background:rgba(255,255,255,0.2);color:{{ $card['progressColor'] }};"><i class="{{ $card['icon'] }}" aria-hidden="true"></i></span>
                                        </div>
                                        <p class="fs-4 fw-bold mb-0" style="color:#fff;">{{ number_format($card['value']) }}</p>
                                        <p class="small mb-2" style="color:rgba(255,255,255,0.75);">{{ $card['description'] }}</p>
                                        <div class="progress" style="height:4px;background:rgba(255,255,255,0.25);">
                                            <div class="progress-bar" style="width: {{ $card['progressWidth'] }}%;background:{{ $card['progressColor'] }};"></div>
                                        </div>
                                    </div>
                                @endforeach
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <div class="social-nav__grid">
            <div class="social-nav__left">
                <div class="social-nav__brand">
                    <span class="social-nav__brand-icon">
                        <i class="fas fa-seedling"></i>
                    </span>
                    <div>
                        <h1 class="social-nav__title">Social Hub</h1>
                        <p class="social-nav__subtitle">Craft the relationships powering your next move</p>
                    </div>
                </div>

                <div class="social-nav__tabs" role="tablist" aria-label="Social navigation">
                    <div class="social-nav__tabs-scroll">
                        @foreach ($navItems as $item)
                            @php
                                $isActive = $item['active'];
                            @endphp
                            <a
                                href="{{ $item['route'] }}"
                                class="social-nav__tab {{ $isActive ? 'social-nav__tab--active' : '' }}"
                                role="tab"
                                aria-selected="{{ $isActive ? 'true' : 'false' }}"
                            >
                                <span class="social-nav__tab-icon">
                                    <i class="{{ $item['icon'] }}" aria-hidden="true"></i>
                                </span>
                                <span class="social-nav__tab-label">{{ $item['label'] }}</span>
                                @if (!empty($item['badge']))
                                    <span class="social-nav__tab-badge" aria-label="{{ $item['badge'] }} new">
                                        {{ $item['badge'] }}
                                    </span>
                                @endif
                            </a>
                        @endforeach
                    </div>
                </div>
            </div>

            <div class="social-nav__right">
                <div class="social-nav__search" role="search">
                    <i class="fas fa-search" aria-hidden="true"></i>
                    <input
                        type="search"
                        placeholder="Search people, posts, groups..."
                        aria-label="Search people, posts, or groups"
                    >
                </div>
                <div class="social-nav__stats" aria-label="Network snapshot">
                    <div class="social-nav__stat">
                        <span class="social-nav__stat-icon social-nav__stat-icon--rose">
                            <i class="fas fa-user-friends" aria-hidden="true"></i>
                        </span>
                        <div>
                            <p class="social-nav__stat-label">Connections</p>
                            <p class="social-nav__stat-value">{{ number_format($counts['connections'] ?? 0) }}</p>
                        </div>
                    </div>
                    <div class="social-nav__stat">
                        <span class="social-nav__stat-icon social-nav__stat-icon--indigo">
                            <i class="fas fa-users" aria-hidden="true"></i>
                        </span>
                        <div>
                            <p class="social-nav__stat-label">Groups</p>
                            <p class="social-nav__stat-value">{{ number_format($counts['groups'] ?? 0) }}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</nav>
