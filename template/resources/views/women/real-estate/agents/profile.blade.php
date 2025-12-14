@extends('women.real-estate.layouts.console')



@section('console-content')
    @if (session('status'))
        <div class="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-800 shadow-sm shadow-emerald-100">
            <span class="font-semibold">✓ Success!</span> {{ session('status') }}
        </div>
    @endif

    @if ($errors->any())
        <div class="mb-6 error-box">
            <p class="error-box-title">We spotted a few things</p>
            <ul class="error-box-list">
                @foreach ($errors->all() as $error)
                    <li>{{ $error }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    @php
        $focusList = $profile->transaction_focus ?? [];
        if (is_string($focusList)) {
            $focusList = array_filter(array_map('trim', explode(',', $focusList)));
        }
        $focusList = array_slice(array_values($focusList), 0, 3);

        $regionList = $profile->service_regions ?? [];
        if (is_string($regionList)) {
            $regionList = array_filter(array_map('trim', explode(',', $regionList)));
        }
        $regionList = array_slice(array_values($regionList), 0, 3);

        $pulse = $pulseSnapshot ?? [];
        $pulseMetrics = $pulse['metrics'] ?? [];
        $pulseBookings = $pulse['bookings'] ?? [];
        $pulseFeed = collect($pulse['feed'] ?? [])->take(4);
        $pulseArchetypes = collect($pulse['archetypes'] ?? [])->take(3);

        $formatPercent = static function ($value, int $decimals = 0) {
            if ($value === null || $value === '') {
                return '—';
            }

            return number_format((float) $value, $decimals) . '%';
        };

        $formatNumber = static function ($value, int $decimals = 0, string $suffix = '') {
            if ($value === null || $value === '') {
                return '—';
            }

            $formatted = $decimals > 0
                ? number_format((float) $value, $decimals)
                : number_format((float) $value);

            return $formatted . $suffix;
        };

        $formatMinutes = static function ($value) {
            if ($value === null || $value === '') {
                return '—';
            }

            return number_format((float) $value) . ' min';
        };

        $pulseFeed = $pulseFeed->map(static function ($entry) {
            $timestamp = isset($entry['timestamp']) ? \Illuminate\Support\Carbon::parse($entry['timestamp']) : null;

            return [
                'label' => $entry['label'] ?? 'Signal',
                'message' => $entry['message'] ?? 'Activity detected',
                'ago' => $timestamp ? $timestamp->diffForHumans(null, true) . ' ago' : 'live',
            ];
        });

        $profileHeadline = $profile->headline ?: 'Women-first property advocate';
        $initialSource = trim($profileHeadline) !== '' ? $profileHeadline : 'WR';
        if (function_exists('mb_substr')) {
            $heroInitial = strtoupper(mb_substr($initialSource, 0, 1));
        } else {
            $heroInitial = strtoupper(substr($initialSource, 0, 1));
        }
        $heroInitial = $heroInitial ?: 'W';
        $heroAvatarUrl = optional(optional($profile->user)->socialProfile)->avatar_url
            ?? ($profile->photo_url ?? null);

        $bioPreview = trim($profile->bio ?? '');
        if ($bioPreview === '') {
            $bioPreview = 'Share your mission so women can instantly feel the care, advocacy, and negotiating power you bring to every inspection.';
        } elseif (function_exists('mb_strlen') && function_exists('mb_substr')) {
            if (mb_strlen($bioPreview) > 160) {
                $bioPreview = rtrim(mb_substr($bioPreview, 0, 157)) . '…';
            }
        } elseif (strlen($bioPreview) > 160) {
            $bioPreview = rtrim(substr($bioPreview, 0, 157)) . '…';
        }

        $heroHighlights = [
            [
                'label' => 'Renter onboarding',
                'icon' => 'home',
                'text' => 'Browse rental properties and find your perfect rental.',
                'route' => route('women.real-estate.rentals.index'),
                'variant' => 'rose',
            ],
            [
                'label' => 'Househunter profile',
                'icon' => 'profile',
                'text' => 'Set up your househunter profile and get matched properties.',
                'route' => route('women.real-estate.househunter-profile'),
                'variant' => 'blue',
            ],
            [
                'label' => 'AI matches',
                'icon' => 'sparkles',
                'text' => 'View your AI-powered property matches and recommendations.',
                'route' => route('women.real-estate.househunter-matches'),
                'variant' => 'purple',
            ],
        ];

        $heroCtas = [
            [
                'label' => 'Register househunter',
                'route' => route('women.real-estate.househunter-profile'),
                'style' => 'primary',
            ],
            [
                'label' => 'Register renter',
                'route' => route('women.real-estate.rentals.index'),
                'style' => 'secondary',
            ],
        ];

        $profileFoundationHighlights = [
            [
                'label' => 'Signature headline',
                'text' => 'Lead with the promise you deliver for women-only buyers so AI intros stay on-message.',
                'icon' => 'pen',
                'variant' => 'rose',
            ],
            [
                'label' => 'Bio warmth',
                'text' => 'Layer mission, wins, and empathy cues so women feel seen before they enquire.',
                'icon' => 'sparkles',
                'variant' => 'purple',
            ],
            [
                'label' => 'Booking signals',
                'text' => 'Broadcast availability and Calendly links to capture ready buyers instantly.',
                'icon' => 'calendar',
                'variant' => 'amber',
            ],
        ];

        $propertyPhotoHighlights = [
            [
                'label' => 'Lifestyle energy',
                'text' => 'Capture lived-in shots that show how women will actually gather, cook, and unwind.',
                'icon' => 'camera',
                'variant' => 'rose',
            ],
            [
                'label' => 'Detail moments',
                'text' => 'Spotlight storage, balconies, and wellness corners so AI storytellers can tailor buyers.',
                'icon' => 'sparkles',
                'variant' => 'purple',
            ],
            [
                'label' => 'Light-first angles',
                'text' => 'Shoot at golden hour or bright mornings to flood every frame with warmth.',
                'icon' => 'sun',
                'variant' => 'amber',
            ],
        ];

        $floorPlanHighlights = [
            [
                'label' => 'Clear flow',
                'text' => 'Layer arrows for circulation so planners can understand traffic at a glance.',
                'icon' => 'layers',
                'variant' => 'blue',
            ],
            [
                'label' => 'Orientation cues',
                'text' => 'Mark north, natural light, and outdoor access to help families map routines.',
                'icon' => 'map-pin',
                'variant' => 'teal',
            ],
            [
                'label' => 'Accessibility notes',
                'text' => 'Call out wide corridors, single-level living, or lift access for carers.',
                'icon' => 'document',
                'variant' => 'amber',
            ],
        ];

        $videoTourHighlights = [
            [
                'label' => 'Guided storytelling',
                'text' => 'Narrate safety, schools, and community vibe as you walk through each zone.',
                'icon' => 'video',
                'variant' => 'rose',
            ],
            [
                'label' => 'Contextual cues',
                'text' => 'Pan to windows, storage, and multi-use spaces to help buyers imagine daily life.',
                'icon' => 'sun',
                'variant' => 'purple',
            ],
            [
                'label' => 'Easy follow-ups',
                'text' => 'Close with availability reminders or Calendly overlays to convert curiosity.',
                'icon' => 'calendar',
                'variant' => 'blue',
            ],
        ];

        $verificationHighlights = [
            [
                'label' => 'Trust signals',
                'text' => 'Verified advocates rank higher across WomenRise searches and AI briefs.',
                'icon' => 'shield',
                'variant' => 'rose',
            ],
            [
                'label' => 'Auto-save progress',
                'text' => 'Step away anytime; we cache every document the moment you upload.',
                'icon' => 'refresh',
                'variant' => 'purple',
            ],
            [
                'label' => 'On-call assistant',
                'text' => 'Ask the WomenRise assistant about requirements, timing, or next actions.',
                'icon' => 'chat',
                'variant' => 'blue',
            ],
        ];

        $verificationSteps = [
            ['label' => 'About You', 'description' => 'Practice basics & mission.'],
            ['label' => 'License & Coverage', 'description' => 'Regulator, insurance, footprint.'],
            ['label' => 'Supporting Documents', 'description' => 'Upload proofs securely.'],
            ['label' => 'Client References', 'description' => 'Women-led testimonials.'],
            ['label' => 'Review & Submit', 'description' => 'Consent & final handoff.'],
        ];
    @endphp

    <div class="wr-console-hero">
        <div class="wr-console-hero-grid">
            <section class="hero-spotlight">
                <div class="hero-spotlight-ribbon">
                    <span class="wr-console-pill">WomenRise Owner Console</span>
                    <span class="spark-label">Live pulse</span>
                </div>
                <div class="space-y-4">
                    <div>
                        <p class="hero-subheading">Profile OS for women-forward agents</p>
                        <h1 class="wr-console-headline">Women-focused Agent Profile</h1>
                        <p class="wr-console-subtitle">
                            Showcase your credentials so women see who is advocating for them across every listing and negotiation.
                        </p>
                    </div>

                    @if (! empty($focusList))
                        <div class="hero-chip-row">
                            @foreach ($focusList as $focus)
                                <span class="tag-pill">{{ $focus }}</span>
                            @endforeach
                        </div>
                    @endif

                    <div class="hero-actions">
                        <a href="#agent-profile-form" class="btn-primary">Update profile</a>
                        <a href="{{ route('women.real-estate.listings.index') }}" class="btn-outline">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12 3v8l-12 3V6" />
                            </svg>
                            Back to Listings
                        </a>
                    </div>
                </div>

                <div class="hero-metrics-grid">
                    <article class="live-metric-card">
                        <div class="orbit-icon orbit-icon-rose">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M12 6v12m6-6H6" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </div>
                        <p class="metric-label">AI Match Confidence</p>
                        <p class="metric-value" data-pulse-field="metrics.match_confidence" data-pulse-format="percent" data-pulse-decimals="0">
                            {{ $formatPercent($pulseMetrics['match_confidence'] ?? null, 0) }}
                        </p>
                        <span class="metric-hint">women-first matching engine</span>
                    </article>
                    <article class="live-metric-card">
                        <div class="orbit-icon orbit-icon-violet">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M5 12h14M5 7h9M5 17h9" stroke-linecap="round" />
                            </svg>
                        </div>
                        <p class="metric-label">Women Leads Live</p>
                        <p class="metric-value" data-pulse-field="metrics.live_leads" data-pulse-format="number">
                            {{ $formatNumber($pulseMetrics['live_leads'] ?? null) }}
                        </p>
                        <span class="metric-hint">refreshes every few seconds</span>
                    </article>
                    <article class="live-metric-card">
                        <div class="orbit-icon orbit-icon-indigo">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M12 6v6l4 2" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </div>
                        <p class="metric-label">Avg. Response</p>
                        <p class="metric-value" data-pulse-field="metrics.response_time_minutes" data-pulse-format="minutes">
                            {{ $formatMinutes($pulseMetrics['response_time_minutes'] ?? null) }}
                        </p>
                        <span class="metric-hint">goal &lt; 15 min</span>
                    </article>
                    <article class="live-metric-card">
                        <div class="orbit-icon orbit-icon-rose">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M4 7h16M4 12h10M4 17h7" stroke-linecap="round" />
                            </svg>
                        </div>
                        <p class="metric-label">Warm Referrals</p>
                        <p class="metric-value" data-pulse-field="metrics.warm_referrals" data-pulse-format="number">
                            {{ $formatNumber($pulseMetrics['warm_referrals'] ?? null) }}
                        </p>
                        <span class="metric-hint">AI vetted intros</span>
                    </article>
                </div>

                <div class="hero-highlight-grid" role="list">
                    @foreach ($heroHighlights as $highlight)
                        <a href="{{ $highlight['route'] }}" class="hero-highlight-card hero-highlight-card--{{ $highlight['variant'] ?? 'rose' }}" role="listitem" aria-label="{{ $highlight['label'] }}">
                            <div class="icon-orbit">
                                @include('women.real-estate.partials.highlight-icon', ['icon' => $highlight['icon'] ?? 'default'])
                            </div>
                            <div>
                                <p class="hero-highlight-label">{{ $highlight['label'] }}</p>
                                <p class="hero-highlight-text">{{ $highlight['text'] }}</p>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75 21 10.5m0 0-3.75 3.75M21 10.5H3" />
                            </svg>
                        </a>
                    @endforeach
                </div>

                <div class="hero-cta-row" role="group" aria-label="Registration actions">
                    @foreach ($heroCtas as $cta)
                        <a href="{{ $cta['route'] }}" class="{{ $cta['style'] === 'secondary' ? 'hero-cta-secondary' : 'hero-cta-primary' }}">
                            {{ $cta['label'] }}
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75 21 10.5m0 0-3.75 3.75M21 10.5H3" />
                            </svg>
                        </a>
                    @endforeach
                </div>
            </section>

            <aside class="hero-profile-card">
                <div class="hero-avatar">
                    @if (! empty($heroAvatarUrl))
                        <img src="{{ $heroAvatarUrl }}" alt="{{ $profileHeadline }}" loading="lazy">
                    @else
                        <span>{{ $heroInitial }}</span>
                    @endif
                </div>
                <div class="space-y-3">
                    <p class="hero-card-label">Profile V3</p>
                    <h3 class="hero-card-title">{{ $profileHeadline }}</h3>
                    <p class="hero-card-body">{{ $bioPreview }}</p>
                </div>

                <ul class="hero-card-stats">
                    <li>
                        <div class="stat-label">Experience</div>
                        <div class="stat-value">{{ number_format((int) ($profile->experience_years ?? 0)) }} yrs</div>
                    </li>
                    <li>
                        <div class="stat-label">Regions</div>
                        <div class="stat-value">
                            {{ ! empty($regionList) ? implode(' • ', $regionList) : 'Add regions' }}
                        </div>
                    </li>
                    <li>
                        <div class="stat-label">Availability</div>
                        <div class="stat-value text-rose-600">
                            {{ $profile->availability_status ? ucfirst($profile->availability_status) : 'Set your status' }}
                        </div>
                    </li>
                </ul>

                <div class="hero-card-footer">
                    <div>
                        <p class="hero-card-label">Next AI sync</p>
                        <p class="hero-card-body">Every 3 min · real-time alerts inside console</p>
                    </div>
                </div>
            </aside>
        </div>
    </div>

    <input type="hidden" data-pulse-endpoint value="{{ route('women.real-estate.agents.pulse') }}">

    <div class="wr-console-shell space-y-8">
        <div class="wr-console-card-shell">
            <div class="wr-console-card ai-intel-card space-y-6">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <span class="section-badge">LIVE INTELLIGENCE</span>
                        <h2 class="mt-4 bg-gradient-to-r from-rose-600 to-violet-600 bg-clip-text text-2xl font-bold text-transparent">AI real-time buyer signals</h2>
                        <p class="mt-2 text-sm text-slate-600">See who is circling your listings right now, powered by WomenRise predictive data for women-led households.</p>
                    </div>
                    <div class="ai-intel-score">
                        <p class="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">Pulse score</p>
                        <p class="ai-intel-score-value" data-pulse-field="metrics.pulse_score" data-pulse-format="percent" data-pulse-decimals="1">
                            {{ $formatPercent($pulseMetrics['pulse_score'] ?? null, 1) }}
                        </p>
                        <p class="ai-intel-score-hint">Synced every 3 seconds</p>
                    </div>
                </div>

                <div class="ai-intel-grid">
                    <div class="ai-pod">
                        <p class="metric-label">Live archetypes</p>
                        <p class="metric-value" data-pulse-field="archetypes" data-pulse-format="length">
                            {{ $formatNumber($pulseArchetypes->count()) }}
                        </p>
                        <p class="metric-hint" data-pulse-field="archetypes" data-pulse-format="labels" data-pulse-fallback="Signals update once leads flow in">
                            {{ $pulseArchetypes->pluck('label')->implode(' • ') ?: 'Signals update once leads flow in' }}
                        </p>
                    </div>
                    <div class="ai-pod space-y-2">
                        <p class="metric-label">Watchlist overlap</p>
                        <p class="metric-value" data-pulse-field="metrics.watchlist_overlap" data-pulse-format="percent" data-pulse-scale="100">
                            @if (isset($pulseMetrics['watchlist_overlap']))
                                {{ number_format((float) $pulseMetrics['watchlist_overlap'] * 100, 0) . '%' }}
                            @else
                                —
                            @endif
                        </p>
                        <p class="metric-hint">Women-led budgets tracking your stock</p>
                        <div class="upload-progress mt-3">
                            <div class="upload-progress-bar" style="width: {{ isset($pulseMetrics['watchlist_overlap']) ? number_format($pulseMetrics['watchlist_overlap'] * 100, 0) : 0 }}%" data-progress-field="metrics.watchlist_overlap" data-progress-scale="100"></div>
                        </div>
                    </div>
                    <div class="ai-pod space-y-3">
                        <p class="metric-label">AI feed</p>
                        <ul class="ai-feed" data-pulse-feed>
                            @forelse ($pulseFeed as $entry)
                                <li>
                                    <div class="ai-feed-dot"></div>
                                    <div>
                                        <span>{{ $entry['ago'] }}</span>
                                        <p>{{ $entry['message'] }}</p>
                                    </div>
                                </li>
                            @empty
                                <li class="text-sm text-slate-600">No live activity yet.</li>
                            @endforelse
                        </ul>
                        <button type="button" class="btn-secondary w-full justify-center" data-ai-trigger>Refresh insights</button>
                        <div class="booking-panel" data-booking-panel>
                            <div class="booking-grid">
                                <div class="booking-chip">
                                    <p class="booking-chip-label">Scheduled</p>
                                    <p class="booking-chip-value" data-pulse-field="bookings.scheduled_tours" data-pulse-format="number" data-pulse-fallback="0">
                                        {{ $formatNumber($pulseBookings['scheduled_tours'] ?? 0) }}
                                    </p>
                                </div>
                                <div class="booking-chip">
                                    <p class="booking-chip-label">Pending</p>
                                    <p class="booking-chip-value" data-pulse-field="bookings.pending_tours" data-pulse-format="number" data-pulse-fallback="0">
                                        {{ $formatNumber($pulseBookings['pending_tours'] ?? 0) }}
                                    </p>
                                </div>
                                <div class="booking-chip">
                                    <p class="booking-chip-label">Engaged</p>
                                    <p class="booking-chip-value" data-pulse-field="bookings.engaged_leads" data-pulse-format="number" data-pulse-fallback="0">
                                        {{ $formatNumber($pulseBookings['engaged_leads'] ?? 0) }}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <p class="booking-status-label">Next tour</p>
                                <p class="booking-status-value" data-pulse-field="bookings.next_tour_at_human" data-pulse-format="text" data-pulse-fallback="No tour on the calendar">
                                    {{ $pulseBookings['next_tour_at_human'] ?? 'No tour on the calendar' }}
                                </p>
                                <p class="text-xs text-slate-500" data-pulse-field="bookings.next_tour_from_now" data-pulse-format="text" data-pulse-prefix="in " data-pulse-fallback="">
                                    {{ ! empty($pulseBookings['next_tour_from_now']) ? 'in ' . $pulseBookings['next_tour_from_now'] : '' }}
                                </p>
                            </div>
                            <div>
                                <p class="booking-status-label">Availability</p>
                                <p class="booking-status-value" data-pulse-field="bookings.availability_status" data-pulse-format="text" data-pulse-fallback="Set your status">
                                    {{ $pulseBookings['availability_status'] ? \Illuminate\Support\Str::headline($pulseBookings['availability_status']) : 'Set your status' }}
                                </p>
                            </div>
                            <a
                                href="{{ $pulseBookings['calendly_url'] ?? '#' }}"
                                class="btn-primary w-full justify-center {{ empty($pulseBookings['calendly_url']) ? 'pointer-events-none opacity-60' : '' }}"
                                @if (! empty($pulseBookings['calendly_url'])) target="_blank" rel="noreferrer" @endif
                                data-pulse-calendar
                                {{ empty($pulseBookings['calendly_url']) ? 'aria-disabled=true' : '' }}
                            >
                                {{ empty($pulseBookings['calendly_url']) ? 'Add your booking link' : 'Open booking calendar' }}
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="wr-console-card-shell">
            <div class="wr-console-card console-section verification-panel space-y-6">
                <div class="section-heading justify-between">
                    <div class="flex items-center gap-4">
                        <div class="icon-orbit">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round" />
                                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </div>
                        <div class="section-copy">
                            <span class="section-badge">Verification status</span>
                            <h2 class="mt-3 text-2xl font-bold text-slate-900">WomenRise verification</h2>
                            <p class="mt-1 text-sm text-slate-600">{{ $verificationTimeline['description'] }}</p>
                        </div>
                    </div>
                    <div class="flex flex-col items-start gap-2 text-right sm:items-end">
                        <span class="verification-chip {{ $verificationTimeline['badge_class'] }}">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            {{ $verificationTimeline['status_label'] }}
                        </span>
                        <p class="text-xs uppercase tracking-[0.3em] text-slate-500">Synced hourly</p>
                    </div>
                </div>

                <div class="gradient-divider"></div>

                <div class="verification-grid">
                    <div class="verification-card">
                        <dt>Current Stage</dt>
                        <dd>{{ $verificationTimeline['stage_label'] ?? '—' }}</dd>
                        <p class="metric-card-hint text-xs text-slate-500">Move through each review gate</p>
                    </div>
                    <div class="verification-card">
                        <dt>Last Reviewed</dt>
                        <dd>
                            @if ($verificationTimeline['last_reviewed_formatted'])
                                {{ $verificationTimeline['last_reviewed_formatted'] }}
                                <span class="block text-sm font-medium text-slate-500">{{ $verificationTimeline['last_reviewed_diff'] }}</span>
                            @else
                                <span class="text-slate-400">Awaiting review</span>
                            @endif
                        </dd>
                    </div>
                    <div class="verification-card">
                        <dt>Next Reverification</dt>
                        <dd>
                            @if ($verificationTimeline['next_reverification_formatted'])
                                {{ $verificationTimeline['next_reverification_formatted'] }}
                                <span class="block text-sm font-medium text-slate-500">{{ $verificationTimeline['next_reverification_diff'] }}</span>
                            @else
                                <span class="text-slate-400">Not scheduled</span>
                            @endif
                        </dd>
                    </div>
                </div>

                @if (! empty($verificationTimeline['callout']))
                    @php
                        $variant = $verificationTimeline['callout_variant'] ?? 'info';
                        $calloutStyles = [
                            'success' => 'info-box-success',
                            'warning' => 'info-box-warning',
                            'danger' => 'info-box-danger',
                            'info' => 'info-box-info',
                        ];
                        $calloutClass = $calloutStyles[$variant] ?? $calloutStyles['info'];
                    @endphp
                    <div class="glow-card info-box {{ $calloutClass }}">
                        {{ $verificationTimeline['callout'] }}
                    </div>
                @endif
            </div>
        </div>

        <div class="wr-console-card-shell">
            <div class="wr-console-card console-section space-y-8">
                <div class="section-heading">
                    <div class="icon-orbit">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
                            <path stroke-linecap="round" stroke-linejoin="round" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                    </div>
                    <div class="section-copy">
                        <span class="section-badge">Profile foundation</span>
                        <h2 class="mt-3 text-2xl font-bold text-slate-900">Tell women buyers what you stand for</h2>
                        <p class="mt-1 text-sm text-slate-600">Inject warmth, clarity, and booking signals so our AI can champion you across the network.</p>
                    </div>
                </div>

                @if ($profileFoundationHighlights !== [])
                    <div class="hero-highlight-grid mt-2" role="list" aria-label="Profile foundation prompts">
                        @foreach ($profileFoundationHighlights as $card)
                            <article class="hero-highlight-card hero-highlight-card--{{ $card['variant'] ?? 'rose' }}" role="listitem">
                                <div class="icon-orbit">
                                    @include('women.real-estate.partials.highlight-icon', ['icon' => $card['icon'] ?? 'default'])
                                </div>
                                <div>
                                    <p class="hero-highlight-label">{{ $card['label'] }}</p>
                                    <p class="hero-highlight-text">{{ $card['text'] }}</p>
                                </div>
                            </article>
                        @endforeach
                    </div>
                @endif

                <form action="{{ route('women.real-estate.agents.profile.update') }}" method="post" class="space-y-8" id="agent-profile-form">
                    @csrf
                    @method('PUT')

                    <div class="glow-grid">
                        <div class="glow-card space-y-6">
                            <div class="form-grid-2">
                                <div class="profile-field-card">
                                    <div class="profile-field-card__header">
                                        <div class="icon-orbit--mini">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13l-3.177.956.956-3.177a4.5 4.5 0 011.13-1.897L16.862 4.487zm0 0L19.5 7.125" />
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p class="profile-field-card__label">Headline</p>
                                            <p class="profile-field-card__hint">Trusted women-only property advocate</p>
                                        </div>
                                    </div>
                                    <div class="profile-field-card__body">
                                        <label for="headline" class="form-label sr-only">Headline</label>
                                        <input type="text" id="headline" name="headline" value="{{ old('headline', $profile->headline) }}" class="form-input" placeholder="Trusted women-only property advocate">
                                    </div>
                                </div>
                                <div class="profile-field-card">
                                    <div class="profile-field-card__header">
                                        <div class="icon-orbit--mini">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2" />
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 5.25h16.5v13.5H3.75z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p class="profile-field-card__label">Experience (years)</p>
                                            <p class="profile-field-card__hint">Show the years you have been championing women buyers.</p>
                                        </div>
                                    </div>
                                    <div class="profile-field-card__body">
                                        <label for="experience_years" class="form-label sr-only">Experience (years)</label>
                                        <input type="number" id="experience_years" name="experience_years" value="{{ old('experience_years', $profile->experience_years) }}" min="0" max="60" class="form-input">
                                    </div>
                                </div>
                            </div>

                            <div class="profile-field-card">
                                <div class="profile-field-card__header">
                                    <div class="icon-orbit--mini">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 20.25c4.97 0 9-4.03 9-9s-4.03-9-9-9-9 4.03-9 9c0 3.76 2.16 6.99 5.28 8.46.32.15.48.46.48.75v1.29c0 .66.66 1.12 1.29.9 1.17-.42 2.25-.88 3.48-.88Z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p class="profile-field-card__label">Biography</p>
                                        <p class="profile-field-card__hint">Share your mission and success stories for women clients. Help women buyers understand your approach and values.</p>
                                    </div>
                                </div>
                                <div class="profile-field-card__body">
                                    <label for="bio" class="form-label sr-only">Biography</label>
                                    <textarea id="bio" name="bio" rows="5" class="form-textarea" placeholder="Share your mission and success stories for women clients.">{{ old('bio', $profile->bio) }}</textarea>
                                    <p class="form-group-desc">Help women buyers understand your approach and values.</p>
                                </div>
                            </div>
                        </div>

                        <div class="glow-card space-y-6">
                            <div class="form-grid-2">
                                <div class="profile-field-card">
                                    <div class="profile-field-card__header">
                                        <div class="icon-orbit--mini">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h12M6 12h12M6 18h7" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p class="profile-field-card__label">Transaction Focus</p>
                                            <p class="profile-field-card__hint">rentals, first_home, investments</p>
                                            <p class="profile-field-card__hint text-xs uppercase tracking-wide text-slate-500">Comma or line separated values.</p>
                                        </div>
                                    </div>
                                    <div class="profile-field-card__body">
                                        <label for="transaction_focus" class="form-label sr-only">Transaction Focus</label>
                                        <textarea id="transaction_focus" name="transaction_focus" rows="3" class="form-textarea" placeholder="rentals, first_home, investments">{{ old('transaction_focus', $profile->transaction_focus ? implode(', ', $profile->transaction_focus) : '') }}</textarea>
                                        <p class="form-group-desc">Comma or line separated values (e.g., rentals, first_home, investments)</p>
                                    </div>
                                </div>
                                <div class="profile-field-card">
                                    <div class="profile-field-card__header">
                                        <div class="icon-orbit--mini">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 21.75s7.5-6.188 7.5-11.25A7.5 7.5 0 0 0 12 3a7.5 7.5 0 0 0-7.5 7.5c0 5.063 7.5 11.25 7.5 11.25Z" />
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p class="profile-field-card__label">Service Regions</p>
                                            <p class="profile-field-card__hint">NSW, VIC, QLD</p>
                                            <p class="profile-field-card__hint text-xs uppercase tracking-wide text-slate-500">Where you operate.</p>
                                        </div>
                                    </div>
                                    <div class="profile-field-card__body">
                                        <label for="service_regions" class="form-label sr-only">Service Regions</label>
                                        <textarea id="service_regions" name="service_regions" rows="3" class="form-textarea" placeholder="NSW, VIC, QLD">{{ old('service_regions', $profile->service_regions ? implode(', ', $profile->service_regions) : '') }}</textarea>
                                        <p class="form-group-desc">Where you operate (e.g., NSW, VIC, QLD)</p>
                                    </div>
                                </div>
                            </div>

                            <div class="form-grid-2">
                                <div class="profile-field-card">
                                    <div class="profile-field-card__header">
                                        <div class="icon-orbit--mini">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 7.5v3l2.25 1.5" />
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M3 8.25h18v8.25A2.25 2.25 0 0118.75 18H5.25A2.25 2.25 0 013 15.75V8.25z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p class="profile-field-card__label">Availability Status</p>
                                            <p class="profile-field-card__hint">Available for new clients</p>
                                        </div>
                                    </div>
                                    <div class="profile-field-card__body">
                                        <label for="availability_status" class="form-label sr-only">Availability Status</label>
                                        <select id="availability_status" name="availability_status" class="form-select">
                                            <option value="">Select your status...</option>
                                            @foreach (['available' => 'Available for new clients', 'waitlist' => 'Taking on waitlist', 'offline' => 'Currently offline'] as $status => $label)
                                                <option value="{{ $status }}" @selected(old('availability_status', $profile->availability_status) === $status)>
                                                    {{ $label }}
                                                </option>
                                            @endforeach
                                        </select>
                                    </div>
                                </div>
                                <div class="profile-field-card">
                                    <div class="profile-field-card__header">
                                        <div class="icon-orbit--mini">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M4.5 7.5h15" />
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 6h13.5A2.25 2.25 0 0121 8.25v10.5A2.25 2.25 0 0118.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p class="profile-field-card__label">Calendly / Booking URL</p>
                                            <p class="profile-field-card__hint">https://calendly.com/yourname</p>
                                            <p class="profile-field-card__hint text-xs uppercase tracking-wide text-slate-500">Give buyers instant access to your live schedule.</p>
                                        </div>
                                    </div>
                                    <div class="profile-field-card__body">
                                        <label for="calendly_url" class="form-label sr-only">Calendly / Booking URL</label>
                                        <input type="url" id="calendly_url" name="calendly_url" value="{{ old('calendly_url', $profile->calendly_url) }}" class="form-input" placeholder="https://calendly.com/yourname">
                                        <p class="form-group-desc">Give buyers instant access to your live schedule.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="hero-cta-row flex justify-end" role="group" aria-label="Profile form actions">
                        <a href="{{ route('women.real-estate.listings.index') }}" class="hero-cta-secondary">
                            Cancel
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </a>
                        <button type="submit" class="hero-cta-primary">
                            Save Profile
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <div class="wr-console-card-shell">
            <div class="wr-console-card console-section media-stack space-y-8">
                <div class="section-heading justify-between">
                    <div class="flex items-start gap-4">
                        <div class="icon-orbit">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M4 17h16M4 7l4-4h8l4 4M8 17l4 4 4-4" />
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 11h6" />
                            </svg>
                        </div>
                        <div class="section-copy">
                            <span class="section-badge">Property listings</span>
                            <h2 class="mt-3 bg-gradient-to-r from-rose-600 to-violet-600 bg-clip-text text-2xl font-bold text-transparent">Manage Property Photos</h2>
                            <p class="mt-2 text-sm text-slate-600">Add high-quality photos to showcase properties and help women buyers visualize their future home.</p>
                        </div>
                    </div>
                    <p class="upload-instruction max-w-xs text-right text-slate-500">Use lifestyle, detail, and exterior shots so our AI storytellers can feature your stock.</p>
                </div>

                @if ($propertyPhotoHighlights !== [])
                    <div class="hero-highlight-grid" role="list" aria-label="Photo guidance">
                        @foreach ($propertyPhotoHighlights as $card)
                            <article class="hero-highlight-card hero-highlight-card--{{ $card['variant'] ?? 'rose' }}" role="listitem">
                                <div class="icon-orbit">
                                    @include('women.real-estate.partials.highlight-icon', ['icon' => $card['icon'] ?? 'default'])
                                </div>
                                <div>
                                    <p class="hero-highlight-label">{{ $card['label'] }}</p>
                                    <p class="hero-highlight-text">{{ $card['text'] }}</p>
                                </div>
                            </article>
                        @endforeach
                    </div>
                @endif

                <div class="space-y-4">
                    <div class="media-upload-card">
                        <div class="media-upload-card__header">
                            <div>
                                <p class="media-upload-card__title">Upload Property Photos</p>
                                <p class="media-upload-card__hint">Add high-impact frames that help women picture life inside the home.</p>
                            </div>
                            <span class="media-upload-card__meta">PNG · JPG · JPEG · 10MB max</span>
                        </div>
                        <div class="file-upload-area">
                            <input type="file" id="property_photos" name="property_photos[]" multiple accept="image/*" class="file-upload-input">
                            <label for="property_photos" class="cursor-pointer flex flex-col items-center text-center">
                                <div class="icon-orbit mb-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                </div>
                                <p class="text-sm font-medium text-slate-900">Click to upload or drag and drop</p>
                                <p class="mt-1 text-xs text-slate-500">PNG, JPG, JPEG up to 10MB per image</p>
                            </label>
                        </div>
                        <div class="media-upload-card__footer mt-3">
                            <p class="form-group-desc">Professional photos increase buyer interest by 47%. Use good lighting and include wide shots, details, and outdoor views.</p>
                        </div>
                    </div>

                    @if (false)
                        <!-- Photos preview grid will be populated dynamically -->
                        <div class="gallery-grid">
                            <div class="media-preview">
                                <img src="" alt="" class="media-thumbnail">
                                <div class="media-overlay">
                                    <button type="button" class="media-remove-btn">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    @endif
                </div>
            </div>
        </div>

        <div class="wr-console-card-shell">
            <div class="wr-console-card console-section media-stack space-y-8">
                <div class="section-heading justify-between">
                    <div class="flex items-start gap-4">
                        <div class="icon-orbit">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M4 12h16M4 17h16" />
                                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7v10m8-10v10" />
                            </svg>
                        </div>
                        <div class="section-copy">
                            <span class="section-badge">Property details</span>
                            <h2 class="mt-3 bg-gradient-to-r from-rose-600 to-violet-600 bg-clip-text text-2xl font-bold text-transparent">House Plans & Floor Layouts</h2>
                            <p class="mt-2 text-sm text-slate-600">Upload floor plans and architectural drawings to help women buyers understand the layout and flow of each property.</p>
                        </div>
                    </div>
                    <p class="upload-instruction max-w-xs text-right text-slate-500">Overlay dimensions and natural light callouts so planners can instantly assess fit.</p>
                </div>

                @if ($floorPlanHighlights !== [])
                    <div class="hero-highlight-grid" role="list" aria-label="Floor plan guidance">
                        @foreach ($floorPlanHighlights as $card)
                            <article class="hero-highlight-card hero-highlight-card--{{ $card['variant'] ?? 'rose' }}" role="listitem">
                                <div class="icon-orbit">
                                    @include('women.real-estate.partials.highlight-icon', ['icon' => $card['icon'] ?? 'default'])
                                </div>
                                <div>
                                    <p class="hero-highlight-label">{{ $card['label'] }}</p>
                                    <p class="hero-highlight-text">{{ $card['text'] }}</p>
                                </div>
                            </article>
                        @endforeach
                    </div>
                @endif

                <div class="space-y-4">
                    <div class="media-upload-card">
                        <div class="media-upload-card__header">
                            <div>
                                <p class="media-upload-card__title">Upload Floor Plans</p>
                                <p class="media-upload-card__hint">Give buyers a clear sense of flow, dimensions, and natural light windows.</p>
                            </div>
                            <span class="media-upload-card__meta">PDF · PNG · JPG · 20MB max</span>
                        </div>
                        <div class="file-upload-area">
                            <input type="file" id="floor_plans" name="floor_plans[]" multiple accept=".pdf,.png,.jpg,.jpeg" class="file-upload-input">
                            <label for="floor_plans" class="cursor-pointer flex flex-col items-center text-center">
                                <div class="icon-orbit mb-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <p class="text-sm font-medium text-slate-900">Click to upload or drag and drop</p>
                                <p class="mt-1 text-xs text-slate-500">PDF, PNG, JPG up to 20MB per file</p>
                            </label>
                        </div>
                        <div class="media-upload-card__footer mt-3">
                            <p class="form-group-desc">Clear floor plans help buyers instantly understand room placement, square footage, and property flow. Include dimensions when possible.</p>
                        </div>
                    </div>

                    @if (false)
                        <!-- Floor plans preview will be populated dynamically -->
                        <div class="gallery-grid-2">
                            <div class="media-preview">
                                <img src="" alt="" class="media-thumbnail">
                                <div class="media-overlay">
                                    <button type="button" class="media-remove-btn">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    @endif
                </div>
            </div>
        </div>

        <div class="wr-console-card-shell">
            <div class="wr-console-card console-section media-stack space-y-8">
                <div class="section-heading justify-between">
                    <div class="flex items-start gap-4">
                        <div class="icon-orbit">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14" />
                                <rect width="12" height="14" x="3" y="5" rx="2" />
                            </svg>
                        </div>
                        <div class="section-copy">
                            <span class="section-badge">Video tours</span>
                            <h2 class="mt-3 bg-gradient-to-r from-rose-600 to-violet-600 bg-clip-text text-2xl font-bold text-transparent">Property Tour Videos</h2>
                            <p class="mt-2 text-sm text-slate-600">Upload up to 4 video tours (max 30 minutes each) to give women buyers an immersive virtual walkthrough experience.</p>
                        </div>
                    </div>
                    <p class="upload-instruction max-w-xs text-right text-slate-500">Include voice-over snippets about safety, schools, and community vibes.</p>
                </div>

                @if ($videoTourHighlights !== [])
                    <div class="hero-highlight-grid" role="list" aria-label="Video tour guidance">
                        @foreach ($videoTourHighlights as $card)
                            <article class="hero-highlight-card hero-highlight-card--{{ $card['variant'] ?? 'rose' }}" role="listitem">
                                <div class="icon-orbit">
                                    @include('women.real-estate.partials.highlight-icon', ['icon' => $card['icon'] ?? 'default'])
                                </div>
                                <div>
                                    <p class="hero-highlight-label">{{ $card['label'] }}</p>
                                    <p class="hero-highlight-text">{{ $card['text'] }}</p>
                                </div>
                            </article>
                        @endforeach
                    </div>
                @endif

                <div class="space-y-6">
                    @for ($i = 1; $i <= 4; $i++)
                        <div class="media-upload-card media-upload-card--compact space-y-4">
                            <div class="media-upload-card__header">
                                <div>
                                    <p class="media-upload-card__title">Video {{ $i }} (up to 30 minutes)</p>
                                    <p class="media-upload-card__hint">Give a women-first walkthrough that narrates safety, storage, and community cues.</p>
                                </div>
                                <span class="media-upload-card__chip">Optional</span>
                            </div>

                            <div class="file-upload-area">
                                <input type="file" id="property_video_{{ $i }}" name="property_videos[]" accept="video/mp4,video/mpeg,video/quicktime,video/x-msvideo" class="file-upload-input">
                                <label for="property_video_{{ $i }}" class="cursor-pointer flex flex-col items-center text-center">
                                    <div class="icon-orbit mb-3">
                                        @include('women.real-estate.partials.highlight-icon', ['icon' => 'video'])
                                    </div>
                                    <p class="text-sm font-medium text-slate-900">Click to upload or drag and drop</p>
                                    <p class="mt-1 text-xs text-slate-500">MP4, MOV, AVI up to 500MB</p>
                                </label>
                            </div>

                            @if (false)
                                <!-- Video preview -->
                                <div class="media-preview">
                                    <video class="media-thumbnail" controls>
                                        <source src="" type="video/mp4">
                                    </video>
                                    <div class="media-overlay">
                                        <button type="button" class="media-remove-btn">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            @endif
                        </div>
                    @endfor

                    <div class="media-tip-card">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                        </svg>
                        <p><strong>Pro Tip:</strong> Videos increase buyer engagement by 80%. Create a compelling walkthrough highlighting key features, natural light, storage, and unique selling points.</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="wr-console-card-shell">
            <div class="wr-console-card console-section wizard-shell space-y-6">
                <div class="section-heading justify-between">
                    <div class="flex items-start gap-4">
                        <div class="icon-orbit">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2" />
                                <circle cx="12" cy="12" r="9" />
                            </svg>
                        </div>
                        <div class="section-copy">
                            <span class="section-badge">Womenrise verification</span>
                            <h2 class="mt-3 text-2xl font-bold text-slate-900">Complete your trust signals</h2>
                            <p class="mt-1 text-sm text-slate-600">Finish the five-step checklist so women buyers immediately see your verified advocacy.</p>
                        </div>
                    </div>
                    <div class="max-w-sm text-sm text-slate-500">
                        Your progress saves automatically. Return anytime to update documents or ask the assistant for help.
                    </div>
                </div>

                <div class="gradient-divider"></div>

                <livewire:agents.verification-wizard />
            </div>
        </div>
    </div>
    </div>
@endsection

@push('scripts')
    @once
        <script>
            document.addEventListener('DOMContentLoaded', () => {
                const endpointInput = document.querySelector('[data-pulse-endpoint]');
                const pulseEndpoint = endpointInput ? endpointInput.value : null;
                const initialPulse = @json($pulseSnapshot);

                const getValueByPath = (obj, path) => {
                    if (! obj || ! path) {
                        return undefined;
                    }
                    return path.split('.').reduce((carry, key) => {
                        if (carry === undefined || carry === null) {
                            return undefined;
                        }
                        return carry[key];
                    }, obj);
                };

                const formatRelative = (timestamp) => {
                    if (! timestamp) {
                        return 'live';
                    }
                    const target = new Date(timestamp);
                    if (Number.isNaN(target.getTime())) {
                        return 'live';
                    }
                    const diffMs = Date.now() - target.getTime();
                    const minutes = Math.floor(diffMs / 60000);
                    if (minutes < 1) {
                        return 'now';
                    }
                    if (minutes < 60) {
                        return `${minutes} min`;
                    }
                    const hours = Math.floor(minutes / 60);
                    if (hours < 24) {
                        return `${hours} hr`;
                    }
                    const days = Math.floor(hours / 24);
                    return `${days} d`;
                };

                const renderFeed = (payload) => {
                    const host = document.querySelector('[data-pulse-feed]');
                    if (! host) {
                        return;
                    }
                    const entries = Array.isArray(payload?.feed) ? payload.feed.slice(0, 4) : [];
                    host.innerHTML = '';
                    if (entries.length === 0) {
                        host.innerHTML = '<li class="text-sm text-slate-600">No live activity yet.</li>';
                        return;
                    }
                    entries.forEach((entry) => {
                        const item = document.createElement('li');
                        const dot = document.createElement('div');
                        dot.className = 'ai-feed-dot';
                        const wrap = document.createElement('div');
                        const stamp = document.createElement('span');
                        const relative = formatRelative(entry.timestamp);
                        stamp.textContent = relative === 'now' || relative === 'live' ? relative : `${relative} ago`;
                        const copy = document.createElement('p');
                        copy.textContent = entry.message ?? 'Activity detected';
                        wrap.appendChild(stamp);
                        wrap.appendChild(copy);
                        item.appendChild(dot);
                        item.appendChild(wrap);
                        host.appendChild(item);
                    });
                };

                const renderPulse = (payload) => {
                    if (! payload) {
                        return;
                    }

                    document.querySelectorAll('[data-pulse-field]').forEach((node) => {
                        const field = node.dataset.pulseField;
                        const format = node.dataset.pulseFormat || 'text';
                        const fallback = node.dataset.pulseFallback || '—';
                        const scale = Number(node.dataset.pulseScale || '1');
                        const decimals = parseInt(node.dataset.pulseDecimals || '0', 10);
                        const suffix = node.dataset.pulseSuffix || '';
                        const prefix = node.dataset.pulsePrefix || '';
                        let raw = getValueByPath(payload, field);

                        if (format === 'length' && Array.isArray(raw)) {
                            raw = raw.length;
                        }

                        let text = fallback;
                        if (raw === null || raw === undefined || raw === '') {
                            text = fallback;
                        } else if (format === 'text') {
                            text = `${prefix}${raw}${suffix}`.trim();
                        } else if (format === 'minutes') {
                            const numeric = Number(raw);
                            text = Number.isFinite(numeric) ? `${Math.round(numeric)} min` : fallback;
                        } else if (format === 'labels') {
                            if (Array.isArray(raw) && raw.length) {
                                const labels = raw
                                    .map((item) => item?.label)
                                    .filter(Boolean)
                                    .join(' • ');
                                text = labels || fallback;
                            } else {
                                text = fallback;
                            }
                        } else if (format === 'number') {
                            let numeric = Number(raw);
                            if (Number.isFinite(numeric)) {
                                numeric *= scale;
                                text = `${prefix}${decimals > 0 ? numeric.toFixed(decimals) : Math.round(numeric)}${suffix}`;
                            }
                        } else if (format === 'percent') {
                            let numeric = Number(raw);
                            if (Number.isFinite(numeric)) {
                                numeric *= scale;
                                const fixed = decimals > 0 ? numeric.toFixed(decimals) : Math.round(numeric);
                                const finalSuffix = suffix || '%';
                                text = `${prefix}${fixed}${finalSuffix}`;
                            }
                        } else {
                            text = `${raw}`;
                        }

                        node.textContent = text || fallback;
                    });

                    document.querySelectorAll('[data-progress-field]').forEach((bar) => {
                        const field = bar.dataset.progressField;
                        const scale = Number(bar.dataset.progressScale || '1');
                        const raw = getValueByPath(payload, field);
                        let numeric = Number(raw);
                        if (! Number.isFinite(numeric)) {
                            return;
                        }
                        numeric *= scale;
                        numeric = Math.max(0, Math.min(100, numeric));
                        bar.style.width = `${numeric}%`;
                    });

                    renderFeed(payload);

                    const calendarLink = document.querySelector('[data-pulse-calendar]');
                    if (calendarLink) {
                        const href = payload?.bookings?.calendly_url;
                        if (href) {
                            calendarLink.href = href;
                            calendarLink.removeAttribute('aria-disabled');
                            calendarLink.classList.remove('pointer-events-none', 'opacity-60');
                            calendarLink.setAttribute('target', '_blank');
                            calendarLink.setAttribute('rel', 'noreferrer');
                            calendarLink.textContent = 'Open booking calendar';
                        } else {
                            calendarLink.href = '#';
                            calendarLink.setAttribute('aria-disabled', 'true');
                            calendarLink.classList.add('pointer-events-none', 'opacity-60');
                            calendarLink.removeAttribute('target');
                            calendarLink.removeAttribute('rel');
                            calendarLink.textContent = 'Add your booking link';
                        }
                    }
                };

                if (initialPulse) {
                    renderPulse(initialPulse);
                }

                const triggerButton = document.querySelector('[data-ai-trigger]');

                const fetchPulse = async () => {
                    if (! pulseEndpoint) {
                        return;
                    }
                    try {
                        triggerButton?.classList.add('animate-pulse');
                        const response = await fetch(pulseEndpoint, {
                            headers: {
                                Accept: 'application/json',
                            },
                            credentials: 'same-origin',
                        });
                        if (! response.ok) {
                            throw new Error(`Pulse request failed: ${response.status}`);
                        }
                        const data = await response.json();
                        renderPulse(data);
                    } catch (error) {
                        console.error('Unable to refresh agent pulse', error);
                    } finally {
                        if (triggerButton) {
                            setTimeout(() => triggerButton.classList.remove('animate-pulse'), 400);
                        }
                    }
                };

                if (triggerButton) {
                    triggerButton.addEventListener('click', fetchPulse);
                }

                if (pulseEndpoint) {
                    setInterval(fetchPulse, 20000);
                }
            });
        </script>
    @endonce
@endpush

