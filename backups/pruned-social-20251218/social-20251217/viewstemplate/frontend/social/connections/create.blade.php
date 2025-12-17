@extends('frontend.social.layout')

@section('social-content')
@php
    $memberLabel = member_label();
    $membersLabel = member_label('members');
    $overviewQuickStats = [
        [
            'label' => 'Connections',
            'value' => $counts['connections'] ?? 0,
            'hint' => 'Collaborators lighting up your orbit',
            'icon' => 'fas fa-hand-holding-heart',
            'tone' => 'rose',
        ],
        [
            'label' => 'Groups',
            'value' => $counts['groups'] ?? 0,
            'hint' => 'Circles amplifying your glow',
            'icon' => 'fas fa-people-group',
            'tone' => 'indigo',
        ],
    ];

    $snapshotStats = [
        [
            'label' => 'Connections',
            'value' => $counts['connections'] ?? 0,
            'hint' => 'Accepted partners in your network',
            'icon' => 'fas fa-user-group',
            'tone' => 'rose',
        ],
        [
            'label' => 'Pending invites',
            'value' => $counts['pendingInvites'] ?? 0,
            'hint' => 'Awaiting that sparkling yes',
            'icon' => 'fas fa-paper-plane',
            'tone' => 'sunrise',
        ],
        [
            'label' => 'Unread messages',
            'value' => $counts['unreadMessages'] ?? 0,
            'hint' => 'Circle back within 24 hours',
            'icon' => 'fas fa-comment-dots',
            'tone' => 'indigo',
        ],
        [
            'label' => 'New alerts',
            'value' => $counts['newAlerts'] ?? 0,
            'hint' => 'Glowing callouts to review',
            'icon' => 'fas fa-bell',
            'tone' => 'mint',
        ],
    ];

    $allSnapshotZero = collect($snapshotStats)->every(fn ($stat) => ($stat['value'] ?? 0) === 0);

    $socialNavItems = [
        [
            'label' => 'Feed',
            'icon' => 'fas fa-rss',
            'route' => route('member.social.feed'),
            'active' => request()->routeIs('member.social.feed'),
        ],
        [
            'label' => 'Connections',
            'icon' => 'fas fa-user-group',
            'route' => route('member.social.connections'),
            'active' => request()->routeIs('member.social.connections.*'),
        ],
        [
            'label' => 'Groups',
            'icon' => 'fas fa-circle-nodes',
            'route' => route('member.social.groups'),
            'active' => request()->routeIs('member.social.groups.*'),
        ],
    ];

    $contactSyncProviders = collect($contactSyncProviders ?? [])->map(function ($provider) {
        return [
            'key' => $provider['key'] ?? '',
            'label' => $provider['label'] ?? '',
            'scopes' => $provider['scopes'] ?? [],
        ];
    })->filter(function ($provider) {
        return filled($provider['key']) && filled($provider['label']);
    })->values();

    $contactSyncLimit = $contactSyncLimit ?? 0;
    $contactSyncLimitLabel = $contactSyncLimit ? number_format($contactSyncLimit) : null;
    $contactSyncEndpoint = $contactSyncEndpoint ?? '';
    $contactSuggestionsRoute = $contactSuggestionsRoute ?? '';
    $contactSyncEnabled = $contactSyncProviders->isNotEmpty() && filled($contactSyncEndpoint);
    $inviteTemplateOptions = collect($inviteTemplates ?? []);
    $mentorshipCohortOptions = collect($mentorshipCohorts ?? []);
    $metricsFilter = $metricsFilter ?? [];
    $personaMetrics = $personaMetrics ?? [];
    $metricsRangeOptions = $metricsFilter['available_ranges'] ?? [];
    $selectedRange = $metricsFilter['range'] ?? 'day';
    $selectedRangeLabel = $metricsRangeOptions[$selectedRange] ?? 'Daily snapshot';
    $selectedMetricsDate = $metricsFilter['selected_date'] ?? now()->toDateString();
    $personaLabel = $metricsFilter['persona_label'] ?? $memberLabel;
    $heatmapDaily = collect($personaMetrics['heatmap']['daily'] ?? [])->sortKeys();
    $heatmapMaxValue = max(1, (int) ($personaMetrics['heatmap']['max_value'] ?? $heatmapDaily->max() ?? 1));
    $personaTrend = collect($personaMetrics['trend'] ?? []);
@endphp

<div class="connection-app space-y-12 px-6 py-10 lg:px-12">
    <section class="connection-app-masthead">
        <div class="connection-app-masthead__badge">
            <i class="fas fa-sparkles" aria-hidden="true"></i>
            <span>Connections hub</span>
        </div>
        <div class="connection-app-masthead__body">
            <div class="connection-app-masthead__copy">
                <h1 class="connection-app-masthead__title">Craft the relationships powering your next move</h1>
                <p class="connection-app-masthead__subtitle">Invite radiant collaborators, share your magic link, and keep your network glowing.</p>
            </div>
            <div class="connection-app-masthead__nav">
                <nav class="connection-app-tabs" aria-label="Social navigation">
                    @foreach($socialNavItems as $item)
                        <a href="{{ $item['route'] }}" class="connection-app-tab{{ $item['active'] ? ' is-active' : '' }}" @if($item['active']) aria-current="page" @endif>
                            <i class="{{ $item['icon'] }}" aria-hidden="true"></i>
                            <span>{{ $item['label'] }}</span>
                        </a>
                    @endforeach
                </nav>
                <label class="connection-app-search">
                    <i class="fas fa-search" aria-hidden="true"></i>
                    <input type="search" name="connection-global-search" placeholder="Search people, posts, groups..." aria-label="Search your social spaces">
                </label>
            </div>
        </div>
    </section>

    <section class="connection-app-overview space-y-6">
        <div class="connection-app-overview__layout">
            <div class="connection-app-overview__quick">
                @foreach($overviewQuickStats as $stat)
                    <div class="connection-app-overview__card">
                        <span class="connection-app-overview__icon connection-app-overview__icon--{{ $stat['tone'] }}">
                            <i class="{{ $stat['icon'] }}" aria-hidden="true"></i>
                        </span>
                        <div class="connection-app-overview__meta">
                            <span class="connection-app-overview__label">{{ $stat['label'] }}</span>
                            <span class="connection-app-overview__value">{{ number_format($stat['value']) }}</span>
                            <span class="connection-app-overview__hint">{{ $stat['hint'] }}</span>
                        </div>
                    </div>
                @endforeach
            </div>
            <aside class="connection-app-focus-card">
                <div class="connection-app-focus-card__badge">Grow your network</div>
                <h3 class="connection-app-focus-card__title">Daily Focus</h3>
                <p class="connection-app-focus-card__copy">Send two connection invites and follow up on pending leads to keep your network warm.</p>
                <a href="{{ route('member.social.connections') }}#pending-invites" class="connection-app-focus-card__cta">
                    <i class="fas fa-inbox" aria-hidden="true"></i>
                    <span>Review pending invites</span>
                </a>
            </aside>
        </div>

        <div class="connection-app-snapshot">
            <div class="connection-app-snapshot__header">
                <span class="connection-app-snapshot__title">Network Snapshot</span>
                <span class="connection-app-snapshot__status">
                    <i class="fas fa-bolt" aria-hidden="true"></i>
                    Live
                </span>
            </div>
            <div class="connection-app-snapshot__grid">
                @foreach($snapshotStats as $stat)
                    <div class="connection-app-snapshot__card">
                        <span class="connection-app-snapshot__icon connection-app-snapshot__icon--{{ $stat['tone'] }}">
                            <i class="{{ $stat['icon'] }}" aria-hidden="true"></i>
                        </span>
                        <div class="connection-app-snapshot__meta">
                            <span class="connection-app-snapshot__label">{{ $stat['label'] }}</span>
                            <span class="connection-app-snapshot__value">{{ number_format($stat['value']) }}</span>
                            <p class="connection-app-snapshot__hint">{{ $stat['hint'] }}</p>
                        </div>
                    </div>
                @endforeach
            </div>
            @if($allSnapshotZero)
                <div class="connections-quick-grid connections-quick-grid--prompt connection-app-snapshot__prompts">
                    <div class="connections-quick-card connections-quick-card--prompt">
                        <span class="connections-quick-icon connections-quick-icon--indigo">
                            <i class="fas fa-envelope-heart"></i>
                        </span>
                        <div class="connections-quick-copy">
                            <span class="connections-quick-title">Send your first invite</span>
                            <span>Use the heartfelt invite form below to reach your first collaborator.</span>
                        </div>
                    </div>
                    <div class="connections-quick-card connections-quick-card--prompt">
                        <span class="connections-quick-icon connections-quick-icon--rose">
                            <i class="fas fa-link"></i>
                        </span>
                        <div class="connections-quick-copy">
                            <span class="connections-quick-title">Share your magic link</span>
                            <span>Copy your profile link so new partners can explore your story instantly.</span>
                        </div>
                    </div>
                    <div class="connections-quick-card connections-quick-card--prompt">
                        <span class="connections-quick-icon connections-quick-icon--mint">
                            <i class="fas fa-seedling"></i>
                        </span>
                        <div class="connections-quick-copy">
                            <span class="connections-quick-title">Join a vibrant group</span>
                            <span>Hop into a community circle to meet aligned collaborators quickly.</span>
                        </div>
                    </div>
                </div>
            @endif
        </div>
    </section>

    <section class="space-y-8 rounded-3xl bg-white/80 p-8 shadow-xl shadow-slate-200/60" aria-labelledby="connection-health-title">
        <div class="flex flex-wrap items-start justify-between gap-6">
            <div class="space-y-3">
                <p class="text-xs font-semibold uppercase tracking-[0.35em] text-rose-500">Persona health</p>
                <div>
                    <h2 id="connection-health-title" class="text-2xl font-semibold text-slate-900">{{ $personaLabel ?? 'Your persona' }} network health</h2>
                    <p class="text-sm text-slate-500">{{ $selectedRangeLabel }} captured {{ \Carbon\Carbon::parse($selectedMetricsDate)->format('M j, Y') }}</p>
                </div>
            </div>
            <form method="GET" class="flex flex-wrap items-end gap-4" aria-label="Update metrics timeframe">
                @foreach(request()->except(['date', 'range']) as $param => $value)
                    <input type="hidden" name="{{ $param }}" value="{{ $value }}">
                @endforeach
                <label class="flex flex-col text-sm font-semibold text-slate-600">
                    <span class="mb-1 text-xs uppercase tracking-[0.3em] text-slate-400">Date</span>
                    <input type="date" name="date" value="{{ $selectedMetricsDate }}" max="{{ now()->toDateString() }}" class="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-800 shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200">
                </label>
                <label class="flex flex-col text-sm font-semibold text-slate-600">
                    <span class="mb-1 text-xs uppercase tracking-[0.3em] text-slate-400">Window</span>
                    <select name="range" class="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-800 shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200">
                        @foreach($metricsRangeOptions as $key => $label)
                            <option value="{{ $key }}" @selected($selectedRange === $key)>{{ $label }}</option>
                        @endforeach
                    </select>
                </label>
                <button type="submit" class="connection-main-btn">
                    <i class="fas fa-rotate mr-2" aria-hidden="true"></i>
                    Refresh metrics
                </button>
            </form>
        </div>

        @if(!($personaMetrics['has_data'] ?? false))
            <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-slate-500">
                <p class="text-lg font-semibold text-slate-700">Metrics are still generating</p>
                <p class="mt-2 text-sm">Invite a few collaborators or check back tomorrow after our nightly sync finishes.</p>
            </div>
        @else
            <div class="grid gap-6 lg:grid-cols-3">
                <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-inner shadow-slate-100">
                    <div class="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                        <span>Total connections</span>
                        <span class="text-emerald-500">{{ $selectedRangeLabel }}</span>
                    </div>
                    <p class="mt-4 text-4xl font-semibold text-slate-900">{{ number_format($personaMetrics['connections'] ?? 0) }}</p>
                    <p class="mt-2 text-sm text-slate-500">As of {{ $personaMetrics['date_label'] ?? $selectedMetricsDate }}</p>
                    <dl class="mt-6 space-y-3 text-sm text-slate-600">
                        <div class="flex items-center justify-between">
                            <dt class="font-semibold">Pending invites</dt>
                            <dd>{{ number_format($counts['pendingInvites'] ?? 0) }}</dd>
                        </div>
                        <div class="flex items-center justify-between">
                            <dt class="font-semibold">Unread messages</dt>
                            <dd>{{ number_format($counts['unreadMessages'] ?? 0) }}</dd>
                        </div>
                    </dl>
                    @if(!empty($personaMetrics['last_updated']))
                        <p class="mt-4 text-xs text-slate-400">Last updated {{ \Carbon\Carbon::parse($personaMetrics['last_updated'])->diffForHumans() }}</p>
                    @endif
                </div>

                <div class="rounded-3xl border border-slate-100 bg-gradient-to-br from-rose-50 via-white to-violet-50 p-6 shadow-inner shadow-rose-100/60">
                    <div class="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                        <span>Invite funnel</span>
                        <span class="text-rose-500">Conversion {{ $personaMetrics['invite_conversion'] ?? 0 }}%</span>
                    </div>
                    <div class="mt-6 grid grid-cols-2 gap-4 text-sm">
                        <div class="rounded-2xl bg-white/90 p-4 shadow-sm">
                            <p class="text-xs uppercase tracking-[0.28em] text-slate-400">Sent</p>
                            <p class="mt-2 text-2xl font-semibold text-slate-900">{{ number_format($personaMetrics['invites']['sent'] ?? 0) }}</p>
                        </div>
                        <div class="rounded-2xl bg-white/90 p-4 shadow-sm">
                            <p class="text-xs uppercase tracking-[0.28em] text-slate-400">Accepted</p>
                            <p class="mt-2 text-2xl font-semibold text-slate-900">{{ number_format($personaMetrics['invites']['accepted'] ?? 0) }}</p>
                        </div>
                    </div>
                    @if(!empty($personaMetrics['funnel_bins']['stages']))
                        <ol class="mt-6 space-y-2 text-sm text-slate-600">
                            @foreach($personaMetrics['funnel_bins']['stages'] as $stage)
                                <li class="flex items-center justify-between rounded-2xl bg-white/80 px-4 py-2">
                                    <span class="font-semibold">{{ $stage['label'] ?? 'Stage' }}</span>
                                    <span>{{ number_format($stage['count'] ?? 0) }}</span>
                                </li>
                            @endforeach
                        </ol>
                    @else
                        <p class="mt-6 text-sm text-slate-500">Funnel breakdown will appear as soon as you send a few invites.</p>
                    @endif
                </div>

                <div class="rounded-3xl border border-slate-100 bg-slate-900/90 p-6 text-white shadow-inner shadow-slate-900/20">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Messaging civility</p>
                            <p class="mt-2 text-4xl font-semibold">{{ $personaMetrics['civility']['score'] ?? '—' }}</p>
                        </div>
                        <span class="inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-sm font-semibold">
                            <i class="fas fa-shield-heart"></i>
                            {{ $personaMetrics['civility']['label'] ?? 'No data' }}
                        </span>
                    </div>
                    <p class="mt-4 text-sm text-slate-200">Weighted across {{ $selectedRangeLabel }} conversations. Stay above 4.2 for a glowing badge.</p>
                    @if($personaTrend->isNotEmpty())
                        <div class="mt-6">
                            <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Recent trajectory</p>
                            <ul class="mt-2 space-y-2 text-sm">
                                @foreach($personaTrend as $point)
                                    <li class="flex items-center justify-between">
                                        <span>{{ $point['date'] ?? '' }}</span>
                                        <span>{{ number_format($point['civility'] ?? 0, 1) }}</span>
                                    </li>
                                @endforeach
                            </ul>
                        </div>
                    @endif
                </div>
            </div>

            <div class="grid gap-6 lg:grid-cols-3">
                <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">7-day heatmap</p>
                            <p class="text-sm text-slate-500">Connection activity pulses</p>
                        </div>
                        <span class="text-xs font-semibold text-slate-400">Darker = busier day</span>
                    </div>
                    @if($heatmapDaily->isEmpty())
                        <p class="mt-6 text-sm text-slate-500">Heatmap will unlock once we have at least two days of signal.</p>
                    @else
                        <div class="mt-6 grid grid-cols-7 gap-3" role="list" aria-label="Weekly connection heatmap">
                            @foreach($heatmapDaily as $date => $value)
                                @php
                                    $count = (int) $value;
                                    $intensity = $heatmapMaxValue > 0 ? max(0.18, min(0.95, $count / $heatmapMaxValue)) : 0.18;
                                    $background = $count === 0
                                        ? 'rgba(148, 163, 184, 0.25)'
                                        : 'rgba(244, 114, 182,' . number_format($intensity, 2) . ')';
                                @endphp
                                <div
                                    class="flex h-16 flex-col items-center justify-center rounded-2xl text-xs font-semibold text-slate-800"
                                    style="background-color: {{ $background }};"
                                    aria-label="{{ \Carbon\Carbon::parse($date)->format('l, M j') }}: {{ $count }} actions">
                                    <span>{{ \Carbon\Carbon::parse($date)->format('D') }}</span>
                                    <span class="text-sm">{{ $count }}</span>
                                </div>
                            @endforeach
                        </div>
                    @endif
                </div>
                <div class="rounded-3xl border border-rose-100 bg-rose-50/60 p-6 text-slate-800 shadow-sm">
                    <p class="text-xs font-semibold uppercase tracking-[0.3em] text-rose-400">Momentum prompts</p>
                    <ul class="mt-4 space-y-3 text-sm">
                        <li class="flex items-start gap-3">
                            <span class="text-rose-500"><i class="fas fa-bolt"></i></span>
                            <span>Follow up with anyone who opened but has not replied within 48 hours.</span>
                        </li>
                        <li class="flex items-start gap-3">
                            <span class="text-rose-500"><i class="fas fa-sun"></i></span>
                            <span>Send a gratitude note to the most active collaborator on your heatmap.</span>
                        </li>
                        <li class="flex items-start gap-3">
                            <span class="text-rose-500"><i class="fas fa-droplet"></i></span>
                            <span>Schedule a short voice memo ritual after high-volume days to stay grounded.</span>
                        </li>
                    </ul>
                </div>
            </div>
        @endif
    </section>

    <div class="connection-create-page space-y-16">
    <section class="connection-create-hero relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-rose-400 via-rose-200/70 to-violet-200 text-slate-900 shadow-[0_40px_80px_-60px_rgba(236,72,153,0.55)]">
        <div class="connection-create-hero__halo"></div>
        <span class="connection-create-hero__sparkle connection-create-hero__sparkle--one"></span>
        <span class="connection-create-hero__sparkle connection-create-hero__sparkle--two"></span>
        <div class="relative z-10 flex flex-col gap-10 p-8 lg:p-12">
            <div class="space-y-8">
                <div class="max-w-2xl space-y-6 text-slate-900">
                    <div class="flex flex-wrap items-center gap-3">
                        <span class="connection-create-chip"><i class="fas fa-sparkles"></i> feminine networking flow</span>
                        <span class="connection-create-chip"><i class="fas fa-butterfly"></i> curated matches</span>
                        <span class="connection-create-chip"><i class="fas fa-heart"></i> warm intros</span>
                    </div>
                    <div class="space-y-4">
                        <h1 class="connection-create-title text-4xl leading-tight md:text-5xl">
                            Invite radiant collaborators and grow your inner circle
                        </h1>
                        <p class="text-base leading-relaxed text-slate-700 md:text-lg">
                            Blend thoughtful invites, shimmering share links, and a curated finder designed to spotlight soulful collaborators who vibe with your mission.
                        </p>
                    </div>
                    <div class="connections-quick-grid connections-quick-grid--prompt connection-hero-prompts">
                        <div class="connections-quick-card connections-quick-card--prompt">
                            <span class="connections-quick-icon connections-quick-icon--rose"><i class="fas fa-envelope-open-heart"></i></span>
                            <div class="connections-quick-copy">
                                <span class="connections-quick-title">Lead with care</span>
                                <span>Reference a recent win or value you admire so your invite feels intentional.</span>
                            </div>
                        </div>
                        <div class="connections-quick-card connections-quick-card--prompt">
                            <span class="connections-quick-icon connections-quick-icon--indigo"><i class="fas fa-link"></i></span>
                            <div class="connections-quick-copy">
                                <span class="connections-quick-title">Share the sparkle link</span>
                                <span>Send your profile privately so collaborators see exactly what you choose.</span>
                            </div>
                        </div>
                        <div class="connections-quick-card connections-quick-card--prompt">
                            <span class="connections-quick-icon connections-quick-icon--mint"><i class="fas fa-compass"></i></span>
                            <div class="connections-quick-copy">
                                <span class="connections-quick-title">Curate your list</span>
                                <span>Use the finder filters to plan who to reach out to next without exposing others.</span>
                            </div>
                        </div>
                    </div>
                </div>
                <a href="{{ route('member.social.connections.discover') }}" class="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.28em] text-rose-600 transition hover:text-violet-600">
                    <i class="fas fa-compass"></i>
                    Inspiration in Discover
                </a>
            </div>
            <div class="grid gap-6 lg:grid-cols-[2.3fr_1fr]">
                <div class="connection-share-box" data-share-wrapper>
                    <span class="connection-share-box__label">Share your profile link</span>
                    <span class="connection-share-box__value" data-share-value>{{ $profileLink }}</span>
                    <div class="flex flex-wrap items-center gap-3">
                        <button type="button" class="connection-main-btn connection-main-btn--outline" data-action="copy-share-link" data-share-link="{{ $profileLink }}" aria-label="Copy your profile link">
                            <i class="fas fa-link mr-2"></i>
                            Copy magic link
                        </button>
                        <span class="text-xs font-semibold uppercase tracking-[0.3em] text-violet-500" data-share-tagline>Send it with sparkle</span>
                    </div>
                    <p class="connection-share-feedback hidden" data-share-feedback></p>
                    <div class="connections-quick-grid connections-quick-grid--prompt connection-share-prompts">
                        <div class="connections-quick-card connections-quick-card--prompt">
                            <span class="connections-quick-icon connections-quick-icon--indigo"><i class="fas fa-copy"></i></span>
                            <div class="connections-quick-copy">
                                <span class="connections-quick-title">Copy &amp; drop in DM</span>
                                <span>Paste the link into a heartfelt note or voice memo for an instant warm intro.</span>
                            </div>
                        </div>
                        <div class="connections-quick-card connections-quick-card--prompt">
                            <span class="connections-quick-icon connections-quick-icon--rose"><i class="fas fa-share-nodes"></i></span>
                            <div class="connections-quick-copy">
                                <span class="connections-quick-title">Pair with an invite</span>
                                <span>Mention one recent win from your profile so they know why you reached out.</span>
                            </div>
                        </div>
                        <div class="connections-quick-card connections-quick-card--prompt">
                            <span class="connections-quick-icon connections-quick-icon--mint"><i class="fas fa-eye"></i></span>
                            <div class="connections-quick-copy">
                                <span class="connections-quick-title">Preview before sending</span>
                                <span>Open the link in a new tab, skim for updates, then share with confidence.</span>
                            </div>
                        </div>
                    </div>
                    <p class="connection-share-note">Tip: share privately with trusted collaborators. We never surface other {{ strtolower($membersLabel) }}&rsquo; profiles &mdash; recipients only see what you send.</p>
                </div>
                <div class="connection-create-card connection-create-card--aurora space-y-3 text-sm text-slate-600">
                    <div class="flex items-center gap-3 text-slate-700">
                        <span class="connection-create-icon connection-create-icon--aurora text-lg"><i class="fas fa-crystal-ball"></i></span>
                        <div>
                            <p class="font-semibold uppercase tracking-[0.28em] text-emerald-500">Glow tip</p>
                            <p>Blend a personal invite with a profile share for the warmest introduction.</p>
                        </div>
                    </div>
                    <p class="leading-relaxed">
                        When a future collaborator lands on your profile, they will see your impact, key wins, and how you love to partner. Drop a note, share the link, and keep your follow-up ritual polished below.
                    </p>
                    <ul class="connection-glow-actions">
                        <li><i class="fas fa-pen"></i> Personalize the first line so they feel the invite was handcrafted for them.</li>
                        <li><i class="fas fa-bell"></i> Add a calendar nudge to check back in within 48 hours if they have not replied.</li>
                    </ul>
                </div>
            </div>
        </div>
    </section>

    <section class="connection-contact-sync-grid">
        <div class="connection-create-card connection-create-card--mint contact-sync-card">
            <div class="flex items-start gap-4">
                <span class="connection-create-icon connection-create-icon--mint text-lg"><i class="fas fa-cloud-arrow-down"></i></span>
                <div>
                    <h2 class="connection-create-card__title">Import the contacts who already adore you</h2>
                    <p class="connection-create-card__subtitle">Start a consent-first sync with Google or Outlook so we can highlight warm matches ready for an invite.</p>
                </div>
            </div>
            @if($contactSyncProviders->isNotEmpty())
                <div class="contact-sync-chip-row">
                    @foreach($contactSyncProviders as $provider)
                        @php
                            $providerIcon = match($provider['key']) {
                                'google' => 'fab fa-google',
                                'outlook' => 'fab fa-microsoft',
                                default => 'fas fa-address-book',
                            };
                            $scopes = collect($provider['scopes'] ?? [])->filter()->map(function ($scope) {
                                return \Illuminate\Support\Str::of($scope)->afterLast('/')->headline();
                            })->implode(', ');
                        @endphp
                        <span class="contact-sync-chip">
                            <i class="{{ $providerIcon }}" aria-hidden="true"></i>
                            <span class="contact-sync-chip__label">{{ $provider['label'] }}</span>
                            @if($scopes)
                                <span class="contact-sync-chip__meta">{{ $scopes }}</span>
                            @endif
                        </span>
                    @endforeach
                </div>
            @else
                <p class="contact-sync-empty">Contact sync is rolling out shortly. We will email you once Google and Outlook are ready.</p>
            @endif
            <div class="contact-sync-actions">
                <button type="button" class="connection-main-btn" data-action="open-contact-sync" @unless($contactSyncEnabled) disabled aria-disabled="true" @endunless>
                    <i class="fas fa-cloud-arrow-down mr-2"></i>
                    Start contact sync
                </button>
                @if($contactSyncLimitLabel)
                    <span class="contact-sync-hint">Up to {{ $contactSyncLimitLabel }} syncs each day</span>
                @endif
                @unless($contactSyncEnabled)
                    <span class="contact-sync-hint">Contact sync setup is in progress.</span>
                @endunless
            </div>
            <p class="contact-sync-footnote">We open a consent window in a new tab, hash every email/phone, and clear unmatched contacts after 30 days.</p>
        </div>
        <div class="connection-create-card connection-create-card--twilight contact-sync-privacy">
            <div class="flex items-start gap-3">
                <span class="connection-create-icon connection-create-icon--twilight text-lg"><i class="fas fa-shield-heart"></i></span>
                <div>
                    <h2 class="connection-create-card__title">How we steward your address book</h2>
                    <p class="connection-create-card__subtitle">Every step honours consent, privacy, and your feminine networking pace.</p>
                </div>
            </div>
            <ul class="contact-sync-list">
                <li><i class="fas fa-lock"></i> Contacts are salted + hashed before storage. We never keep raw address book data.</li>
                <li><i class="fas fa-hourglass-half"></i> Entries expire after 30 days unless that friend joins your orbit.</li>
                <li><i class="fas fa-envelope-heart"></i> Suggestions show up privately so you choose when to send an invite.</li>
            </ul>
            <p class="contact-sync-footnote">Once someone opts in, we will surface them in your suggestions for a quick follow-up.</p>
        </div>
    </section>

    <section class="grid gap-8 lg:grid-cols-[1.7fr_1fr]" id="connection-invite-stage">
        <div class="connection-create-card connection-create-card--sunrise space-y-6">
            <div class="flex items-start gap-4">
                <span class="connection-create-icon connection-create-icon--sunrise text-lg"><i class="fas fa-envelope-heart"></i></span>
                <div>
                    <h2 class="connection-create-card__title">Send a heartfelt invite</h2>
                    <p class="connection-create-card__subtitle">Choose a profile from the finder or drop in an email address. Either way, your message stays soulful and intentional.</p>
                </div>
            </div>
            <ol class="connection-invite-steps">
                <li data-step="1">Pick who you want to reach (email works best for first touches).</li>
                <li data-step="2">Share a quick win or reason you admire their work.</li>
                <li data-step="3">Set a reminder to follow up with grace in a few days.</li>
            </ol>
            <form
                method="POST"
                action="{{ $storeRoute }}"
                class="space-y-5"
                data-connection-invite-form
                data-invite-endpoint="{{ $storeRoute }}"
                data-invite-channel="email"
            >
                @csrf
                <input type="hidden" name="target_user_id" value="" data-invite-target-field>
                <input type="hidden" name="invite_type" value="manual_invite" data-invite-type-field>
                @if($inviteTemplateOptions->isNotEmpty() || $mentorshipCohortOptions->isNotEmpty())
                    <div class="grid gap-4 md:grid-cols-2">
                        @if($inviteTemplateOptions->isNotEmpty())
                            <label class="connection-form-group">
                                <span class="connection-field-label">Invite template</span>
                                <div class="relative">
                                    <select name="template_key" class="connection-input" data-template-select>
                                        <option value="">Personal note (custom)</option>
                                        @foreach($inviteTemplateOptions as $template)
                                            <option value="{{ $template['key'] }}">{{ $template['label'] }}</option>
                                        @endforeach
                                    </select>
                                    <i class="fas fa-stamp connection-input-icon"></i>
                                </div>
                                <span class="connection-form-hint" data-template-hint>Mentorship-ready prompts + nudges layer in automatically.</span>
                            </label>
                        @endif
                        <label class="connection-form-group">
                            <span class="connection-field-label">Mentorship cohort (optional)</span>
                            <div class="relative">
                                <select name="mentorship_cohort_id" class="connection-input" @if($mentorshipCohortOptions->isEmpty()) disabled aria-disabled="true" @endif>
                                    <option value="">{{ $mentorshipCohortOptions->isNotEmpty() ? 'No cohort yet' : 'Cohort list is loading soon' }}</option>
                                    @foreach($mentorshipCohortOptions as $cohort)
                                        <option value="{{ $cohort->id }}">
                                            {{ $cohort->name }}@if($cohort->focus_area) &mdash; {{ $cohort->focus_area }}@endif
                                        </option>
                                    @endforeach
                                </select>
                                <i class="fas fa-people-roof connection-input-icon"></i>
                            </div>
                            <span class="connection-form-hint">Link an invite to track cohort matches + onboarding.</span>
                        </label>
                    </div>
                @endif
                @if($inviteTemplateOptions->isNotEmpty())
                    <div class="connection-create-card connection-create-card--mint space-y-3 hidden" data-template-preview>
                        <div class="flex items-start gap-3">
                            <span class="connection-create-icon connection-create-icon--mint text-lg"><i class="fas fa-swatchbook"></i></span>
                            <div>
                                <p class="connection-create-card__title text-base" data-template-preview-name>Template selected</p>
                                <p class="connection-create-card__subtitle" data-template-preview-type></p>
                            </div>
                        </div>
                        <p class="text-sm text-slate-700" data-template-preview-message></p>
                        <div class="connection-inline-actions">
                            <span class="connection-note-chip">
                                <i class="fas fa-bell"></i>
                                Nudges: <span data-template-preview-nudges>&mdash;</span>
                            </span>
                            <span class="connection-note-chip">
                                <i class="fas fa-book-open"></i>
                                Bundle: <span data-template-preview-bundle>&mdash;</span>
                            </span>
                        </div>
                    </div>
                @endif
                <div class="grid gap-4 md:grid-cols-2">
                    <label class="connection-form-group">
                        <span class="connection-field-label">Contact email</span>
                        <div class="relative">
                            <input type="email" name="invite_email" class="connection-input connection-input--finder" placeholder="Add their best email" autocomplete="email">
                            <i class="fas fa-feather connection-input-icon"></i>
                        </div>
                        <span class="connection-form-hint">We recommend using a personal note for the first outreach.</span>
                    </label>
                    <label class="connection-form-group">
                        <span class="connection-field-label">Invite vibe</span>
                        <div class="relative">
                            <select name="invite_context" class="connection-input">
                                <option value="Collaboration">Collaborate on a launch</option>
                                <option value="Coffee chat">Cozy coffee chat</option>
                                <option value="Shout out">Share a spotlight moment</option>
                                <option value="Mentor">Invite to mentor / advise</option>
                            </select>
                            <i class="fas fa-sparkles connection-input-icon"></i>
                        </div>
                        <span class="connection-form-hint">Pick the energy you want to set for this introduction.</span>
                    </label>
                </div>
                <label class="connection-form-group">
                    <span class="connection-field-label">Personal note</span>
                    <textarea name="invite_note" rows="4" maxlength="280" class="connection-textarea" placeholder="Tell them why your worlds should collide"></textarea>
                    <span class="connection-form-hint">Lead with gratitude or a shared interest&mdash;keep it specific and warm.</span>
                </label>
                <label class="connection-form-group">
                    <span class="connection-field-label">Mentorship context (optional)</span>
                    <input type="text" name="match_context" class="connection-input" placeholder="Example: Accountability pod for Product Ops cohort">
                    <span class="connection-form-hint">Shares privately with the mentee + mentor when the invite is accepted.</span>
                </label>
                <p class="connection-finder__feedback hidden" data-selection-feedback></p>
                <div class="flex flex-wrap items-center gap-3">
                    <button type="submit" class="connection-main-btn" data-submit-invite>
                        <i class="fas fa-paper-plane mr-2"></i>
                        Send invite
                    </button>
                    <button type="button" class="connection-main-btn connection-main-btn--outline" data-action="reset-invite-selection">
                        <i class="fas fa-undo mr-2"></i>
                        Clear selection
                    </button>
                </div>
                <div class="connection-inline-actions">
                    <span class="connection-note-chip"><i class="fas fa-clock"></i> Schedule a follow-up reminder</span>
                    <span class="connection-note-chip"><i class="fas fa-image"></i> Attach a portfolio link or case study</span>
                </div>
                <p class="invite-feedback hidden" data-feedback></p>
            </form>
        </div>
        <div class="connection-create-card connection-create-card--twilight space-y-4">
            <div class="flex items-start gap-3">
                <span class="connection-create-icon connection-create-icon--twilight text-lg"><i class="fas fa-pen-nib"></i></span>
                <div>
                    <h2 class="connection-create-card__title">Need a prompt?</h2>
                    <p class="connection-create-card__subtitle">Use this love-soaked script, tweak the details, and send your invite with confidence.</p>
                </div>
            </div>
            <div class="connections-quick-grid connections-quick-grid--prompt">
                <div class="connections-quick-card connections-quick-card--prompt">
                    <span class="connections-quick-icon connections-quick-icon--indigo"><i class="fas fa-highlighter"></i></span>
                    <div class="connections-quick-copy">
                        <span class="connections-quick-title">Highlight alignment</span>
                        <span>Swap in one project or value you both care about for instant resonance.</span>
                    </div>
                </div>
                <div class="connections-quick-card connections-quick-card--prompt">
                    <span class="connections-quick-icon connections-quick-icon--sunrise"><i class="fas fa-mug-hot"></i></span>
                    <div class="connections-quick-copy">
                        <span class="connections-quick-title">Close with a next step</span>
                        <span>Offer a quick coffee chat or async brainstorm so it is easy to say yes.</span>
                    </div>
                </div>
            </div>
            <textarea id="personal_note_template" rows="7" class="connection-textarea" placeholder="Hey radiant soul! I have been admiring your work and would love to connect. Here is how I think our worlds align...">Hey radiant soul! I have been admiring your work and would love to connect. I am exploring new collaborations around storytelling-led launches and your energy feels like a perfect match. Fancy weaving some magic together?</textarea>
            <button type="button" class="connection-main-btn connection-main-btn--outline w-full" data-action="copy-note-template" data-note-target="#personal_note_template">
                <i class="fas fa-copy mr-2"></i>
                Copy this message
            </button>
            <p class="invite-feedback hidden" data-note-feedback></p>
        </div>
    </section>

    <section class="connection-create-card connection-create-card--aurora connection-finder space-y-8" data-connection-finder data-search-route="{{ $searchRoute }}">
        <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div class="max-w-xl space-y-3 text-slate-700">
                <h2 class="connection-create-card__title">Prepare your outreach list</h2>
                <p class="connection-create-card__subtitle">Use the filters to map the kind of collaborator you want to reach. We keep profiles private&mdash;these prompts help you craft intentional invites instead.</p>
            </div>
            <div class="connection-finder__chips flex flex-wrap gap-3">
                @foreach($finderVibes as $index => $chip)
                    <button type="button" class="connection-finder-chip" data-finder-vibe="{{ $chip['value'] }}" data-chip-index="{{ $index }}">
                        <i class="fas fa-sparkles"></i>
                        {{ $chip['label'] }}
                    </button>
                @endforeach
            </div>
        </div>
        <form class="connection-finder__form grid gap-4 lg:grid-cols-[1.4fr_1.1fr_auto]" data-finder-form>
            <div class="connection-finder__search-field">
                <i class="fas fa-search"></i>
                <input type="search" name="keyword" class="connection-input connection-input--finder" placeholder="Search by name, role, or vibe" data-input="keyword" autocomplete="off">
            </div>
            <div class="connection-finder__search-field">
                <i class="fas fa-location-dot"></i>
                <input type="text" name="location" class="connection-input connection-input--finder" placeholder="Filter by city or region" data-input="location" autocomplete="off">
            </div>
            <button type="submit" class="connection-main-btn connection-main-btn--outline" data-action="finder-refresh">
                <i class="fas fa-wand-magic mr-2"></i>
                Refresh matches
            </button>
        </form>
        <div class="grid gap-8 xl:grid-cols-[2fr_1fr] xl:items-start">
            <div class="connection-finder__results is-grid" data-finder-results>
                <div class="connection-finder__empty" data-empty-state>
                    <i class="fas fa-moon-stars"></i>
                    <p>No matches yet—try a keyword or tap a vibe chip to conjure fresh energy.</p>
                </div>
            </div>
            <aside class="connection-finder__summary space-y-4">
                <div class="connection-finder__summary-pill">
                    <span class="connection-finder__summary-label">Fresh matches</span>
                    <span class="connection-finder__summary-value" data-summary-key="matches">0</span>
                    <span class="connection-finder__summary-hint">You&rsquo;ll add people manually&mdash;use filters to plan your outreach list.</span>
                </div>
                <div class="connection-finder__summary-pill" id="pending-invites">
                    <span class="connection-finder__summary-label">Pending invites</span>
                    <span class="connection-finder__summary-value" data-count-key="pendingInvites">{{ number_format($counts['pendingInvites'] ?? 0) }}</span>
                    <span class="connection-finder__summary-hint">Glowing invites waiting for their yes.</span>
                </div>
                <div class="connection-finder__summary-pill">
                    <span class="connection-finder__summary-label">Unread messages</span>
                    <span class="connection-finder__summary-value" data-count-key="unreadMessages">{{ number_format($counts['unreadMessages'] ?? 0) }}</span>
                    <span class="connection-finder__summary-hint">Circle back within 24 hours to keep energy flowing.</span>
                </div>
                <p class="connection-finder__privacy-note">Only the people you invite will see your profile. Keep notes on who you&rsquo;ve contacted so the right collaborations open up.</p>
            </aside>
        </div>
    </section>

    <section class="space-y-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="space-y-2">
                <h2 class="connection-create-card__title text-3xl">Keep your follow-up compass aligned</h2>
                <p class="text-sm text-slate-600">Pop these reminders into your weekly reset so your new connections feel adored from day one.</p>
            </div>
            <a href="{{ route('member.social.connections.discover') }}" class="connection-main-btn connection-main-btn--outline">
                <i class="fas fa-compass mr-2"></i>
                Discover more people
            </a>
        </div>
        <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            @foreach($ritualSteps as $step)
                <div class="connection-ritual-card h-full">
                    <span class="connection-ritual-icon"><i class="{{ $step['icon'] }}"></i></span>
                    <h3 class="connection-ritual-title">{{ $step['title'] }}</h3>
                    <p class="connection-ritual-text">{{ $step['description'] }}</p>
                </div>
            @endforeach
        </div>
    </section>
    @if($contactSyncEnabled)
        <div
            class="contact-sync-modal"
            data-contact-sync-modal
            data-endpoint="{{ $contactSyncEndpoint }}"
            data-suggestions-endpoint="{{ $contactSuggestionsRoute }}"
            data-limit="{{ $contactSyncLimit }}"
            aria-hidden="true"
        >
            <div class="contact-sync-modal__overlay" data-contact-sync-overlay></div>
            <div class="contact-sync-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="contactSyncModalTitle">
                <button type="button" class="contact-sync-modal__close" data-action="close-contact-sync" aria-label="Close contact sync window">
                    <i class="fas fa-xmark"></i>
                </button>
                <div class="contact-sync-modal__content">
                    <p class="contact-sync-modal__eyebrow">Gentle sync</p>
                    <h3 class="contact-sync-modal__title" id="contactSyncModalTitle">Choose a provider to begin</h3>
                    <p class="contact-sync-modal__subtitle">We redirect you to grant read-only access, hash everything with our private salt, and only keep matches to suggest women already inside our universe.</p>
                    @if($contactSyncLimitLabel)
                        <p class="contact-sync-modal__limit">Limit: {{ $contactSyncLimitLabel }} syncs per day.</p>
                    @endif
                    <div class="contact-sync-provider-grid" role="list">
                        @foreach($contactSyncProviders as $provider)
                            @php
                                $providerIcon = match($provider['key']) {
                                    'google' => 'fab fa-google',
                                    'outlook' => 'fab fa-microsoft',
                                    default => 'fas fa-address-book',
                                };
                            @endphp
                            <button
                                type="button"
                                class="contact-sync-provider"
                                data-contact-sync-provider="{{ $provider['key'] }}"
                                data-provider-label="{{ $provider['label'] }}"
                                role="listitem"
                            >
                                <span class="contact-sync-provider__icon"><i class="{{ $providerIcon }}" aria-hidden="true"></i></span>
                                <span class="contact-sync-provider__body">
                                    <span class="contact-sync-provider__label">{{ $provider['label'] }}</span>
                                    @if(!empty($provider['scopes']))
                                        <span class="contact-sync-provider__scopes">{{ implode(', ', $provider['scopes']) }}</span>
                                    @endif
                                </span>
                                <span class="contact-sync-provider__status"><i class="fas fa-circle"></i> Ready</span>
                            </button>
                        @endforeach
                    </div>
                    <label class="contact-sync-consent">
                        <input type="checkbox" data-contact-sync-consent>
                        <span>I consent to import my contacts for friend suggestions. Entries are hashed and removed after 30 days.</span>
                    </label>
                    <button type="button" class="connection-main-btn w-full" data-contact-sync-start disabled>
                        <i class="fas fa-cloud-arrow-down mr-2"></i>
                        Start sync
                    </button>
                    <p class="invite-feedback hidden" data-contact-sync-feedback></p>
                </div>
            </div>
        </div>
    @endif
</div>
</div>
@endsection



@push('scripts')
<script>
(function () {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    const inviteTemplateConfigs = @json($inviteTemplateOptions->values()->all());
    const finderPrivacyPrompts = [
        {
            icon: 'fa-envelope-heart',
            title: 'Invite someone you admire',
            message: 'Add their email and send a heartfelt note directly from this page.',
            tone: 'indigo',
        },
        {
            icon: 'fa-location-dot',
            title: 'Consider their timezone',
            message: 'Suggest a chat window that respects where they are based.',
            tone: 'rose',
        },
        {
            icon: 'fa-user-shield',
            title: 'Keep connections private',
            message: 'Matches appear once someone accepts—your outreach stays intentional and secure.',
            tone: 'mint',
        },
    ];

    document.addEventListener('DOMContentLoaded', () => {
        initializeShareLinkCopy();
        initializeNoteCopy();
        initializeInviteForm();
        initializeFinder();
        initializeResetSelection();
        initializeContactSyncModal();
        initializeTemplatePicker();
    });

    function initializeShareLinkCopy() {
        document.querySelectorAll('[data-action="copy-share-link"]').forEach((button) => {
            if (button.dataset.shareCopyBound === 'true') {
                return;
            }
            button.dataset.shareCopyBound = 'true';
            if (!button.dataset.originalHtml) {
                button.dataset.originalHtml = button.innerHTML;
            }

            button.addEventListener('click', async () => {
                const wrapper = button.closest('[data-share-wrapper]');
                const feedback = wrapper?.querySelector('[data-share-feedback]');
                const tagline = wrapper?.querySelector('[data-share-tagline]');
                if (tagline && !tagline.dataset.originalText) {
                    tagline.dataset.originalText = tagline.textContent;
                }

                const linkSource = button.getAttribute('data-share-link') || wrapper?.querySelector('[data-share-value]')?.textContent;
                const link = (linkSource || '').trim();

                if (!link) {
                    updateShareButtonVisual(button, tagline, 'error');
                    revealFeedback(feedback, 'Profile link not available yet. Save your updates and try again.', 'error');
                    return;
                }

                const success = await copyTextToClipboard(link);
                if (success) {
                    updateShareButtonVisual(button, tagline, 'success');
                    revealFeedback(feedback, 'Magic link copied. Share it with someone dazzling.', 'success');
                } else {
                    updateShareButtonVisual(button, tagline, 'error');
                    revealFeedback(feedback, 'Unable to copy right now. You can highlight the link and copy manually.', 'error');
                }
            });
        });
    }

    function initializeNoteCopy() {
        document.querySelectorAll('[data-action="copy-note-template"]').forEach((button) => {
            button.addEventListener('click', async () => {
                const targetSelector = button.getAttribute('data-note-target');
                const target = document.querySelector(targetSelector);
                const feedback = button.parentElement?.querySelector('[data-note-feedback]');
                if (!target) {
                    revealFeedback(feedback, 'Template not found. Refresh and try again.', 'error');
                    return;
                }
                const payload = target.value || target.textContent || '';
                const success = await copyTextToClipboard(payload);
                if (success) {
                    revealFeedback(feedback, 'Prompt copied. Personalize it before you send.', 'success');
                } else {
                    revealFeedback(feedback, 'Clipboard request blocked. Copy manually instead.', 'error');
                }
            });
        });
    }

    function initializeResetSelection() {
        const resetButton = document.querySelector('[data-action="reset-invite-selection"]');
        const feedback = document.querySelector('[data-selection-feedback]');
        const inviteForm = document.querySelector('[data-connection-invite-form]');
        if (!resetButton || !inviteForm) {
            return;
        }
        resetButton.addEventListener('click', () => {
            inviteForm.querySelector('[data-invite-target-field]').value = '';
            inviteForm.querySelector('[data-invite-type-field]').value = 'manual_invite';
            const emailInput = inviteForm.querySelector('input[name="invite_email"]');
            if (emailInput) {
                emailInput.placeholder = 'Add their best email';
                emailInput.disabled = false;
            }
            document.querySelectorAll('[data-card-user-id]').forEach((card) => card.classList.remove('is-selected'));
            if (feedback) {
                feedback.classList.add('hidden');
                feedback.classList.remove('text-error');
                feedback.textContent = '';
            }
        });
    }

    function initializeInviteForm() {
        const form = document.querySelector('[data-connection-invite-form]');
        if (!form) {
            return;
        }
        const endpoint = form.getAttribute('data-invite-endpoint') || form.action;
        const channel = form.getAttribute('data-invite-channel') || 'email';
        const targetField = form.querySelector('[data-invite-target-field]');
        const inviteTypeField = form.querySelector('[data-invite-type-field]');
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const submitBtn = form.querySelector('[data-submit-invite]');
            const feedback = form.querySelector('[data-feedback]');
            const selectionFeedback = form.querySelector('[data-selection-feedback]');
            const formData = new FormData(form);
            const payload = {
                invite_email: trimValue(formData.get('invite_email')),
                invite_note: trimValue(formData.get('invite_note')),
                invite_type: trimValue(formData.get('invite_type')) || 'manual_invite',
                invite_context: trimValue(formData.get('invite_context')),
            };
            const templateKey = trimValue(formData.get('template_key'));
            const cohortId = trimValue(formData.get('mentorship_cohort_id'));
            const matchContext = trimValue(formData.get('match_context'));
            if (!payload.invite_email) {
                revealFeedback(feedback, 'Add an email address so we know where to deliver your invite.', 'error');
                return;
            }
            const recipients = [{
                email: payload.invite_email,
                note: payload.invite_note || undefined,
                context: payload.invite_context || undefined,
                type: payload.invite_type || 'manual_invite',
            }];
            const requestBody = {
                recipients,
                channel: channel || undefined,
            };
            if (templateKey) {
                requestBody.template_key = templateKey;
            }
            if (cohortId) {
                requestBody.mentorship_cohort_id = cohortId;
            }
            if (matchContext) {
                recipients[0].match_context = matchContext;
            }
            if (payload.invite_note) {
                requestBody.message = payload.invite_note;
            }
            toggleButton(submitBtn, true, 'Sending...');
            try {
                const { data } = window.axios
                    ? await window.axios.post(endpoint, requestBody)
                    : await fallbackJsonPost(endpoint, requestBody);

                revealFeedback(feedback, buildInviteSuccessMessage(data?.summary, channel), 'success');
                if (selectionFeedback) {
                    selectionFeedback.classList.add('hidden');
                }

                adjustCounts(data?.summary);
                form.reset();
                if (targetField) {
                    targetField.value = '';
                }
                if (inviteTypeField) {
                    inviteTypeField.value = 'manual_invite';
                }
                const emailInput = form.querySelector('input[name="invite_email"]');
                if (emailInput) {
                    emailInput.placeholder = 'Add their best email';
                    emailInput.disabled = false;
                }
                document.querySelectorAll('[data-card-user-id]').forEach((card) => card.classList.remove('is-selected'));
                document.dispatchEvent(new CustomEvent('connection-invite:completed', {
                    detail: {
                        summary: data?.summary,
                    },
                }));
            } catch (error) {
                revealFeedback(feedback, resolveErrorMessage(error, 'Invite could not be delivered right now.'), 'error');
            } finally {
                toggleButton(submitBtn, false);
            }
        });
    }

    function initializeFinder() {
        const finder = document.querySelector('[data-connection-finder]');
        if (!finder) {
            return;
        }
        const resultsEl = finder.querySelector('[data-finder-results]');
        const form = finder.querySelector('[data-finder-form]');
        const keywordInput = finder.querySelector('[data-input="keyword"]');
        const locationInput = finder.querySelector('[data-input="location"]');
        const chips = finder.querySelectorAll('[data-finder-vibe]');
        const emptyState = finder.querySelector('[data-empty-state]');
        const summaryMatches = finder.querySelector('[data-summary-key="matches"]');
        const inviteForm = document.querySelector('[data-connection-invite-form]');
        const selectionFeedback = document.querySelector('[data-selection-feedback]');
        const inviteTypeField = inviteForm?.querySelector('[data-invite-type-field]');
        const targetField = inviteForm?.querySelector('[data-invite-target-field]');
        const emailInput = inviteForm?.querySelector('input[name="invite_email"]');
        let debounceTimer;
        const state = {
            keyword: '',
            location: '',
            vibe: '',
            isLoading: false,
        };

        const performSearch = (options = {}) => {
            const { silent = false } = options;
            if (state.isLoading) {
                return;
            }
            state.isLoading = true;
            if (summaryMatches) {
                summaryMatches.textContent = '0';
            }
            if (!silent && selectionFeedback) {
                selectionFeedback.classList.add('hidden');
                selectionFeedback.textContent = '';
            }
            renderPrivacyPrompts(resultsEl, state);
            emptyState?.classList.add('hidden');
            state.isLoading = false;
        };

        const debouncedSearch = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => performSearch(), 240);
        };

        form?.addEventListener('submit', (event) => {
            event.preventDefault();
            state.keyword = keywordInput?.value.trim() || '';
            state.location = locationInput?.value.trim() || '';
            performSearch();
        });

        keywordInput?.addEventListener('input', () => {
            state.keyword = keywordInput.value.trim();
            debouncedSearch();
        });

        locationInput?.addEventListener('input', () => {
            state.location = locationInput.value.trim();
            debouncedSearch();
        });

        chips.forEach((chip) => {
            chip.addEventListener('click', () => {
                const isActive = chip.classList.toggle('is-active');
                chips.forEach((otherChip) => {
                    if (otherChip !== chip) {
                        otherChip.classList.remove('is-active');
                    }
                });
                state.vibe = isActive ? chip.getAttribute('data-finder-vibe') || '' : '';
                performSearch();
            });
        });

        document.addEventListener('connection-invite:completed', () => {
            performSearch({ silent: true });
        });

        performSearch({ silent: true });
    }

    function renderPrivacyPrompts(container, state = {}) {
        if (!container) {
            return;
        }

        const prompts = finderPrivacyPrompts.map(prompt => ({ ...prompt }));
        const keyword = state.keyword ? escapeHtml(state.keyword) : '';
        const location = state.location ? escapeHtml(state.location) : '';
        const vibe = state.vibe ? escapeHtml(state.vibe.replace(/_/g, ' ')) : '';

        if (keyword && prompts[0]) {
            prompts[0].message = `Mention how you discovered them (${keyword}) so your note feels intentional.`;
        }

        if (location && prompts[1]) {
            prompts[1].message = `Suggest a chat time that works across ${location} to show you value their schedule.`;
        }

        if (vibe && prompts[2]) {
            prompts[2].message = `Keep details private and reference the vibe “${vibe}” so they know why you thought of them.`;
        }

        container.innerHTML = `
            <div class="connections-quick-grid connections-quick-grid--prompt">
                ${prompts.map(buildQuickPromptCard).join('')}
            </div>
            <p class="connection-finder__privacy-note">For privacy, curated profiles appear only after someone accepts your invite. Use the flows above to reach out intentionally.</p>
        `;
    }

    function initializeContactSyncModal() {
        const modal = document.querySelector('[data-contact-sync-modal]');
        const openers = document.querySelectorAll('[data-action="open-contact-sync"]');
        if (!modal || openers.length === 0) {
            return;
        }
        const endpoint = modal.getAttribute('data-endpoint');
        if (!endpoint) {
            openers.forEach((button) => button.setAttribute('disabled', 'disabled'));
            return;
        }
        const overlay = modal.querySelector('[data-contact-sync-overlay]');
        const closeButtons = modal.querySelectorAll('[data-action="close-contact-sync"]');
        const providerButtons = modal.querySelectorAll('[data-contact-sync-provider]');
        const consentCheckbox = modal.querySelector('[data-contact-sync-consent]');
        const startButton = modal.querySelector('[data-contact-sync-start]');
        const feedback = modal.querySelector('[data-contact-sync-feedback]');
        const providerLabels = new Map();
        providerButtons.forEach((button) => {
            const key = button.getAttribute('data-contact-sync-provider');
            const label = button.getAttribute('data-provider-label') || 'your provider';
            if (key) {
                providerLabels.set(key, label);
            }
        });

        const state = {
            isOpen: false,
            provider: '',
            isSubmitting: false,
        };

        const updateStartState = () => {
            const hasConsent = consentCheckbox ? consentCheckbox.checked : true;
            const canSubmit = Boolean(state.provider) && hasConsent && !state.isSubmitting;
            if (startButton) {
                startButton.disabled = !canSubmit;
            }
        };

        const openModal = () => {
            if (state.isOpen) {
                return;
            }
            state.isOpen = true;
            modal.classList.add('is-visible');
            modal.removeAttribute('aria-hidden');
            document.body.classList.add('contact-sync-modal-open');
            clearFeedback(feedback);
            updateStartState();
        };

        const closeModal = () => {
            if (!state.isOpen) {
                return;
            }
            state.isOpen = false;
            modal.classList.remove('is-visible');
            modal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('contact-sync-modal-open');
            state.provider = '';
            state.isSubmitting = false;
            providerButtons.forEach((button) => button.classList.remove('is-selected'));
            if (consentCheckbox) {
                consentCheckbox.checked = false;
            }
            clearFeedback(feedback);
            updateStartState();
        };

        openers.forEach((button) => {
            button.addEventListener('click', () => {
                if (button.disabled) {
                    return;
                }
                openModal();
            });
        });

        closeButtons.forEach((button) => button.addEventListener('click', closeModal));
        overlay?.addEventListener('click', closeModal);
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && state.isOpen) {
                closeModal();
            }
        });

        providerButtons.forEach((button) => {
            button.addEventListener('click', () => {
                if (state.isSubmitting) {
                    return;
                }
                const key = button.getAttribute('data-contact-sync-provider');
                if (!key) {
                    return;
                }
                state.provider = key;
                providerButtons.forEach((candidate) => candidate.classList.toggle('is-selected', candidate === button));
                updateStartState();
            });
        });

        consentCheckbox?.addEventListener('change', updateStartState);

        startButton?.addEventListener('click', async () => {
            if (!state.provider || state.isSubmitting) {
                return;
            }
            state.isSubmitting = true;
            toggleButton(startButton, true, 'Preparing...');
            clearFeedback(feedback);
            try {
                const { data } = window.axios
                    ? await window.axios.post(endpoint, { provider: state.provider })
                    : await fallbackJsonPost(endpoint, { provider: state.provider });
                const session = data?.session;
                const providerLabel = providerLabels.get(state.provider) || 'your provider';
                const successMessage = session?.auth_url
                    ? `We opened ${providerLabel} in a new tab. Complete consent to finish syncing.`
                    : `Contact sync via ${providerLabel} is now active.`;
                revealFeedback(feedback, successMessage, 'success');
                if (session?.auth_url) {
                    window.open(session.auth_url, '_blank', 'noopener');
                }
            } catch (error) {
                revealFeedback(feedback, resolveErrorMessage(error, 'We could not start the sync yet.'), 'error');
            } finally {
                state.isSubmitting = false;
                toggleButton(startButton, false);
                updateStartState();
            }
        });

        updateStartState();
    }

    function initializeTemplatePicker() {
        const select = document.querySelector('[data-template-select]');
        if (!select) {
            return;
        }

        const previewCard = document.querySelector('[data-template-preview]');
        const previewName = previewCard?.querySelector('[data-template-preview-name]');
        const previewType = previewCard?.querySelector('[data-template-preview-type]');
        const previewMessage = previewCard?.querySelector('[data-template-preview-message]');
        const previewNudges = previewCard?.querySelector('[data-template-preview-nudges]');
        const previewBundle = previewCard?.querySelector('[data-template-preview-bundle]');
        const noteField = document.querySelector('textarea[name="invite_note"]');
        const hint = document.querySelector('[data-template-hint]');
        const hasTemplates = Array.isArray(inviteTemplateConfigs) && inviteTemplateConfigs.length > 0;

        if (!hasTemplates) {
            if (hint) {
                hint.textContent = 'Templates are rolling out shortly.';
            }
            select.disabled = true;
            return;
        }

        if (hint && !hint.dataset.defaultText) {
            hint.dataset.defaultText = hint.textContent || '';
        }

        let noteTouched = Boolean(noteField?.value?.trim());
        noteField?.addEventListener('input', () => {
            noteTouched = Boolean(noteField.value.trim());
        });

        const applySelection = () => {
            const selectedKey = select.value.trim();
            const template = getTemplateConfigByKey(selectedKey);

            applyTemplatePreview(template, {
                previewCard,
                previewName,
                previewType,
                previewMessage,
                previewNudges,
                previewBundle,
            });

            if (hint) {
                hint.textContent = template
                    ? 'Template nudges + onboarding bundles attach automatically.'
                    : hint.dataset.defaultText || '';
            }

            if (!noteField || noteTouched) {
                return;
            }

            if (template?.default_message) {
                noteField.value = template.default_message;
            } else {
                noteField.value = '';
            }
        };

        select.addEventListener('change', applySelection);

        const inviteForm = select.closest('form');
        inviteForm?.addEventListener('reset', () => {
            window.setTimeout(() => {
                noteTouched = false;
                applySelection();
            }, 0);
        });

        applySelection();
    }

    function getTemplateConfigByKey(key) {
        if (!key || !Array.isArray(inviteTemplateConfigs)) {
            return null;
        }
        return inviteTemplateConfigs.find((template) => template.key === key) || null;
    }

    function applyTemplatePreview(template, refs = {}) {
        const {
            previewCard,
            previewName,
            previewType,
            previewMessage,
            previewNudges,
            previewBundle,
        } = refs;

        if (!previewCard) {
            return;
        }

        if (!template) {
            previewCard.classList.add('hidden');
            if (previewMessage) {
                previewMessage.textContent = '';
            }
            return;
        }

        previewCard.classList.remove('hidden');
        if (previewName) {
            previewName.textContent = template.label || 'Template selected';
        }
        if (previewType) {
            previewType.textContent = formatTemplateType(template.type);
        }
        if (previewMessage) {
            previewMessage.textContent = template.default_message || 'Use this template as a warm starting point.';
        }
        if (previewNudges) {
            previewNudges.textContent = formatTemplateNudges(template.nudge_offsets);
        }
        if (previewBundle) {
            previewBundle.textContent = formatTemplateBundle(template.onboarding);
        }
    }

    function formatTemplateType(type) {
        if (!type) {
            return 'Personal note';
        }
        return type
            .toString()
            .replace(/[_\-]+/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    function formatTemplateNudges(offsets) {
        if (!Array.isArray(offsets) || offsets.length === 0) {
            return 'Custom follow-up';
        }
        const formatted = offsets
            .map((offset) => formatHours(Number(offset)))
            .filter(Boolean);
        if (formatted.length === 0) {
            return `${offsets.length} nudge${offsets.length === 1 ? '' : 's'}`;
        }
        return `${offsets.length} nudge${offsets.length === 1 ? '' : 's'} @ ${formatted.join(', ')}`;
    }

    function formatTemplateBundle(onboarding) {
        if (!onboarding) {
            return 'Bundle attaches after acceptance';
        }
        const bundle = onboarding.resource_bundle;
        if (bundle?.title) {
            return bundle.title;
        }
        if (Array.isArray(bundle?.links) && bundle.links.length > 0) {
            return `${bundle.links.length} shared resource${bundle.links.length === 1 ? '' : 's'}`;
        }
        if (Number.isFinite(onboarding.check_in_days) && onboarding.check_in_days > 0) {
            const days = onboarding.check_in_days;
            return `Check-in in ${days} day${days === 1 ? '' : 's'}`;
        }
        return 'Mentorship bundle ready';
    }

    function formatHours(hours) {
        if (!Number.isFinite(hours) || hours <= 0) {
            return '';
        }
        if (hours >= 24) {
            const days = hours / 24;
            if (Number.isInteger(days)) {
                return `${days} day${days === 1 ? '' : 's'}`;
            }
            return `${days.toFixed(1)} days`;
        }
        return `${hours} hr${hours === 1 ? '' : 's'}`;
    }

    function adjustCounts(nextState) {
        if (!nextState) {
            incrementCount('pendingInvites', 1);
            return;
        }
        if (typeof nextState === 'string') {
            if (nextState === 'created') {
                incrementCount('pendingInvites', 1);
            }
            if (nextState === 'connected') {
                incrementCount('connections', 1);
                incrementCount('pendingInvites', -1);
            }
            return;
        }
        if (typeof nextState === 'number' && Number.isFinite(nextState)) {
            if (nextState > 0) {
                incrementCount('pendingInvites', nextState);
            }
            return;
        }
        if (typeof nextState === 'object') {
            const inviteCount = Number(nextState.count ?? (Array.isArray(nextState.recipients) ? nextState.recipients.length : 0)) || 0;
            if (inviteCount > 0) {
                incrementCount('pendingInvites', inviteCount);
            }
        }
    }

    function incrementCount(key, delta) {
        const el = document.querySelector(`[data-count-key="${key}"]`);
        if (!el) {
            return;
        }
        const current = parseInt((el.textContent || '0').replace(/[^0-9-]/g, ''), 10) || 0;
        const next = Math.max(0, current + delta);
        el.textContent = next.toLocaleString();
    }

    function revealFeedback(target, message, tone) {
        if (!target) {
            return;
        }
        target.textContent = message;
        target.classList.remove('hidden', 'text-emerald-500', 'text-rose-500', 'text-error');
        if (tone === 'success') {
            target.classList.add('text-emerald-500');
        }
        if (tone === 'error') {
            target.classList.add('text-rose-500');
        }
    }

    function clearFeedback(target) {
        if (!target) {
            return;
        }
        target.textContent = '';
        target.classList.add('hidden');
        target.classList.remove('text-emerald-500', 'text-rose-500', 'text-error');
    }

    function updateShareButtonVisual(button, tagline, state) {
        if (!button) {
            return;
        }

        if (!button.dataset.originalHtml) {
            button.dataset.originalHtml = button.innerHTML;
        }

        if (tagline && !tagline.dataset.originalText) {
            tagline.dataset.originalText = tagline.textContent;
        }

        const existingTimer = button.dataset.resetTimer;
        if (existingTimer) {
            clearTimeout(Number(existingTimer));
            delete button.dataset.resetTimer;
        }

        if (state === 'success') {
            button.innerHTML = '<i class="fas fa-check mr-2"></i> Magic link copied';
            button.setAttribute('data-copy-state', 'success');
            if (tagline) {
                tagline.textContent = 'Link ready to share';
            }
        } else if (state === 'error') {
            button.innerHTML = '<i class="fas fa-triangle-exclamation mr-2"></i> Copy not available';
            button.setAttribute('data-copy-state', 'error');
            if (tagline) {
                tagline.textContent = 'Copy manually if needed';
            }
        } else {
            button.innerHTML = button.dataset.originalHtml;
            button.removeAttribute('data-copy-state');
            if (tagline) {
                tagline.textContent = tagline.dataset.originalText || '';
            }
            return;
        }

        const timeout = window.setTimeout(() => {
            button.innerHTML = button.dataset.originalHtml;
            button.removeAttribute('data-copy-state');
            if (tagline) {
                tagline.textContent = tagline.dataset.originalText || '';
            }
            delete button.dataset.resetTimer;
        }, state === 'success' ? 2500 : 4000);

        button.dataset.resetTimer = `${timeout}`;
    }

    function toggleButton(button, isLoading, loadingText = 'Sending...') {
        if (!button) {
            return;
        }
        button.disabled = isLoading;
        if (isLoading) {
            button.setAttribute('data-original-html', button.innerHTML);
            button.innerHTML = `<i class="fas fa-spinner-third fa-spin mr-2"></i> ${loadingText}`;
        } else {
            const original = button.getAttribute('data-original-html');
            if (original) {
                button.innerHTML = original;
                button.removeAttribute('data-original-html');
            }
        }
    }

    function buildInviteSuccessMessage(summary, fallbackChannel = 'email') {
        if (!summary) {
            return 'Invite sent with sparkle.';
        }
        const count = Number(summary.count ?? (Array.isArray(summary.recipients) ? summary.recipients.length : 0)) || 1;
        const channel = (summary.channel || fallbackChannel || 'email').replace(/_/g, ' ');
        if (count > 1) {
            return `${count} invites sent via ${channel}.`;
        }
        return `Invite sent via ${channel}.`;
    }

    function resolveErrorMessage(error, fallback = 'Something went wrong.') {
        if (!error) {
            return fallback;
        }
        if (typeof error === 'string' && error.trim()) {
            return error;
        }
        const response = error.response?.data || error.data || error;
        if (response?.errors) {
            const firstKey = Object.keys(response.errors)[0];
            if (firstKey) {
                const value = response.errors[firstKey];
                if (Array.isArray(value) && value.length > 0) {
                    return value[0];
                }
                if (typeof value === 'string' && value.trim()) {
                    return value;
                }
            }
        }
        if (typeof response?.message === 'string' && response.message.trim()) {
            return response.message;
        }
        if (typeof error.message === 'string' && error.message.trim()) {
            return error.message;
        }
        return fallback;
    }

    async function fallbackJsonPost(url, payload) {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-CSRF-TOKEN': csrfToken,
            },
            body: JSON.stringify(payload),
        });
        const data = await safeJson(response);
        if (!response.ok) {
            const error = new Error('Request failed');
            error.response = {
                data,
                status: response.status,
            };
            throw error;
        }
        return { data };
    }

    async function safeJson(response) {
        try {
            return await response.json();
        } catch (error) {
            return null;
        }
    }

    async function copyTextToClipboard(text) {
        const content = typeof text === 'string' ? text : '';
        if (!content.trim()) {
            return false;
        }
        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(content);
                return true;
            } catch (error) {
                // Fallback below
            }
        }
        try {
            const textarea = document.createElement('textarea');
            textarea.value = content;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'absolute';
            textarea.style.opacity = '0';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            const succeeded = document.execCommand('copy');
            document.body.removeChild(textarea);
            return succeeded;
        } catch (error) {
            return false;
        }
    }

    function trimValue(value) {
        return typeof value === 'string' ? value.trim() : value;
    }

    function buildQuickPromptCard({ icon = 'fa-sparkles', title = '', message = '', tone = '' } = {}) {
        const iconClass = tone ? ` connections-quick-icon--${tone}` : '';

        return `
            <div class="connections-quick-card connections-quick-card--prompt">
                <span class="connections-quick-icon${iconClass}">
                    <i class="fas ${icon}"></i>
                </span>
                <div class="connections-quick-copy">
                    <span class="connections-quick-title">${escapeHtml(title)}</span>
                    <span>${escapeHtml(message)}</span>
                </div>
            </div>
        `;
    }

    function escapeHtml(value) {
        if (value === null || value === undefined) {
            return '';
        }
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
})();
</script>
@endpush

