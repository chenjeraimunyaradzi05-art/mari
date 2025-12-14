@extends('frontend.layouts.master')

@section('title', 'Public Sector Dashboard')
@section('meta_description', 'Track agencies, procurement missions, and civic AI playbooks in Athena’s public sector portal.')

@php
    $themes = $aiPlaybook['themes'] ?? [];
    $actions = $aiPlaybook['actions'] ?? [];
@endphp

@push('styles')
    <link rel="stylesheet" href="{{ asset('css/public-sector.css') }}">
@endpush

@section('contents')
<div class="civic-shell">
    <div class="container">
        <section class="civic-hero">
            <div>
                <div class="civic-pill"><i class="fas fa-shield-alt"></i> Public Sector Dashboard</div>
                <h1 class="civic-hero__title">Government, procurement, and civic labs curated for bold women.</h1>
                <p class="text-muted">Track live initiatives, follow agencies, and tap AI to unlock equitable public sector roles.</p>
                <div class="mt-3 d-flex gap-2 flex-wrap">
                    <a href="{{ route('public-sector.opportunities.index') }}" class="btn btn-primary" style="background: var(--civic-violet); border-color: var(--civic-violet);">Browse opportunities</a>
                    <a href="{{ route('public-sector.opportunities.index', ['featured' => 1]) }}" class="btn btn-outline-primary">Featured roles</a>
                    <a href="{{ route('public-sector.agency.dashboard') }}" class="btn btn-outline-secondary">For Agencies</a>
                </div>
            </div>
            <div class="civic-signal-grid">
                <div class="signal-card">
                    <p class="signal-label">Closing this week</p>
                    <div class="signal-value">{{ $opportunitySignals['closing_soon'] ?? 0 }}</div>
                    <p class="small text-muted mb-0">Submit expressions of interest today.</p>
                </div>
                <div class="signal-card">
                    <p class="signal-label">Hybrid-friendly</p>
                    <div class="signal-value">{{ $opportunitySignals['hybrid_friendly'] ?? 0 }}</div>
                    <p class="small text-muted mb-0">Roles with remote + flex credentials.</p>
                </div>
                <div class="signal-card">
                    <p class="signal-label">Executive pathways</p>
                    <div class="signal-value">{{ $opportunitySignals['executive_paths'] ?? 0 }}</div>
                    <p class="small text-muted mb-0">Roles shaping $100M+ portfolios.</p>
                </div>
            </div>
        </section>

        <section class="civic-section">
            <div class="section-header d-flex justify-content-between align-items-end">
                <div>
                    <h2 class="section-title">Procurement Pipeline</h2>
                    <p class="text-muted mb-0">Live tenders and mission briefings open for women-led businesses.</p>
                </div>
                <a href="{{ route('public-sector.pipeline') }}" class="btn btn-link p-0">View full pipeline <i class="fas fa-arrow-right"></i></a>
            </div>
            <div class="row g-3">
                <div class="col-md-4">
                    <div class="civic-card h-100 text-center py-4">
                        <div class="display-4 fw-bold text-primary mb-2">{{ $procurementStats['open'] ?? 0 }}</div>
                        <h3 class="h5 mb-1">Open Tenders</h3>
                        <p class="text-muted small mb-0">Active requests for proposal</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="civic-card h-100 text-center py-4">
                        <div class="display-4 fw-bold text-info mb-2">{{ $procurementStats['briefing'] ?? 0 }}</div>
                        <h3 class="h5 mb-1">Mission Briefings</h3>
                        <p class="text-muted small mb-0">Early engagement sessions</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="civic-card h-100 text-center py-4">
                        <div class="display-4 fw-bold text-secondary mb-2">{{ $procurementStats['discovery'] ?? 0 }}</div>
                        <h3 class="h5 mb-1">Discovery Phase</h3>
                        <p class="text-muted small mb-0">Future opportunities shaping up</p>
                    </div>
                </div>
            </div>

            @if($missionBriefings->isNotEmpty())
            <div class="mt-4">
                <h3 class="h5 mb-3">Active Mission Briefings</h3>
                <div class="row g-3">
                    @foreach($missionBriefings as $briefing)
                        <div class="col-md-4">
                            <article class="civic-card h-100">
                                <p class="civic-card__eyebrow">{{ $briefing->agency?->name }}</p>
                                <h4 class="h6 mb-2">{{ $briefing->title }}</h4>
                                <p class="small text-muted mb-2">{{ \Illuminate\Support\Str::limit($briefing->summary ?? 'Join the briefing session to shape this mission.', 80) }}</p>
                                <span class="badge bg-info text-dark">Briefing Phase</span>
                            </article>
                        </div>
                    @endforeach
                </div>
            </div>
            @endif
        </section>

        <section class="civic-section">
            <div class="section-header">
                <h2 class="section-title">Featured opportunities</h2>
                <p class="text-muted mb-0">AI-ranked missions aligned to procurement reform, digital inclusion, and climate resilience.</p>
            </div>
            <div class="opportunity-grid">
                @forelse($featuredOpportunities as $opportunity)
                    <article class="civic-card">
                        <p class="civic-card__eyebrow text-uppercase">{{ $opportunity->agency?->name }}</p>
                        <h3 class="civic-card__title">{{ $opportunity->title }}</h3>
                        <p class="mb-2 text-muted">{{ \Illuminate\Support\Str::limit($opportunity->summary, 160) }}</p>
                        <p class="mb-1 fw-semibold"><i class="fas fa-map-marker-alt" style="color: var(--civic-rose);"></i> {{ $opportunity->location }}</p>
                        <p class="mb-1"><i class="fas fa-briefcase"></i> {{ $opportunity->role_level ?? 'Leadership' }} · {{ $opportunity->work_arrangement ?? 'Hybrid' }}</p>
                        <p class="mb-1"><i class="fas fa-calendar"></i> {{ optional($opportunity->closes_at)->format('M j') ?? $opportunity->closing_window ?? 'Rolling intake' }}</p>
                        <div class="civic-card__tags">
                            @foreach(collect($opportunity->tags ?? [])->take(3) as $tag)
                                <span class="civic-tag">#{{ \Illuminate\Support\Str::slug($tag, '-') }}</span>
                            @endforeach
                        </div>
                        <a class="civic-card__cta" href="{{ route('public-sector.opportunities.show', $opportunity) }}">
                            View brief <i class="fas fa-arrow-right"></i>
                        </a>
                    </article>
                @empty
                    <p class="text-muted">No public sector opportunities have been published yet.</p>
                @endforelse
            </div>
        </section>

        <section class="civic-section">
            <div class="section-header">
                <h2 class="section-title">Agency spotlights</h2>
                <p class="text-muted mb-0">Follow to receive procurement riffs, lab drop dates, and civic wins in your feed.</p>
            </div>
            <div class="agency-grid">
                @forelse($agencies as $agency)
                    <article class="civic-card">
                        <p class="civic-card__eyebrow text-uppercase">{{ $agency->category }} agency</p>
                        <h3 class="civic-card__title">{{ $agency->name }}</h3>
                        <p class="text-muted">{{ $agency->tagline }}</p>
                        <ul class="list-unstyled small text-muted mb-2">
                            <li><i class="fas fa-location-arrow"></i> {{ $agency->hq_city }}, {{ $agency->hq_country }}</li>
                            <li><i class="fas fa-microphone-lines"></i> Focus: {{ collect($agency->focus_areas ?? [])->take(3)->implode(', ') ?: 'Civic innovation' }}</li>
                        </ul>
                        <button class="agency-follow" data-agency="{{ $agency->slug }}" data-endpoint="{{ route('public-sector.agencies.follow', $agency) }}" type="button">
                            <span class="agency-follow__label">Follow agency</span>
                        </button>
                    </article>
                @empty
                    <p class="text-muted">We’ll surface spotlight agencies once data syncs from the civic directory.</p>
                @endforelse
            </div>
        </section>

        <section class="civic-section">
            <div class="section-header">
                <h2 class="section-title">Programs & labs</h2>
                <p class="text-muted mb-0">Pair funding, wraparound support, and AI copilots to accelerate your public work.</p>
            </div>
            <div class="program-grid">
                @forelse($programs as $program)
                    <article class="civic-card">
                        <p class="civic-card__eyebrow">{{ $program->agency?->name }}</p>
                        <h3 class="civic-card__title">{{ $program->title }}</h3>
                        <p class="mb-2 text-muted">{{ \Illuminate\Support\Str::limit($program->summary, 160) }}</p>
                        <p class="mb-1"><i class="fas fa-graduation-cap"></i> {{ ucfirst($program->program_type) }} · {{ ucfirst($program->delivery_mode ?? 'hybrid') }}</p>
                        <p class="mb-1"><i class="fas fa-clock"></i> Next cohort {{ optional($program->next_intake_date)->format('M j') ?? 'Rolling' }}</p>
                        <div class="civic-card__tags">
                            @foreach(collect($program->tags ?? [])->take(3) as $tag)
                                <span class="civic-tag">#{{ \Illuminate\Support\Str::slug($tag, '-') }}</span>
                            @endforeach
                        </div>
                        @if($program->application_url)
                            <a class="civic-card__cta" href="{{ $program->application_url }}" target="_blank" rel="noopener">Apply now <i class="fas fa-external-link-alt"></i></a>
                        @endif
                    </article>
                @empty
                    <p class="text-muted">Lab programs will appear once agencies publish their next intake.</p>
                @endforelse
            </div>
        </section>

        <section class="civic-section">
            <div class="row g-4">
                <div class="col-lg-6">
                    <div class="ai-playbook h-100">
                        <div class="civic-pill mb-3"><i class="fas fa-wand-magic-sparkles"></i> AI Playbook</div>
                        <h3 class="mb-3">Personalised civic plan</h3>
                        <p class="text-muted">Themes curated from your personas + agency momentum.</p>
                        <div class="row g-3">
                            <div class="col-12">
                                <strong class="text-uppercase small text-muted">Themes</strong>
                                <ul class="ai-list mt-2">
                                    @forelse($themes as $index => $theme)
                                        <li><span>{{ $index + 1 }}</span> {{ $theme }}</li>
                                    @empty
                                        <li><span>1</span> Spotlight procurement wins across your channels.</li>
                                    @endforelse
                                </ul>
                            </div>
                            <div class="col-12 mt-3">
                                <strong class="text-uppercase small text-muted">Next actions</strong>
                                <ul class="ai-list mt-2">
                                    @forelse($actions as $index => $action)
                                        <li><span>{{ $index + 1 }}</span> {{ $action }}</li>
                                    @empty
                                        <li><span>1</span> Invite two agencies to join your Public Sector Lab sprint.</li>
                                    @endforelse
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="civic-card h-100">
                        <p class="civic-card__eyebrow">Your engagement timeline</p>
                        <h3 class="civic-card__title">Latest intent signals</h3>
                        <ul class="engagement-list">
                            @forelse($recentEngagements as $engagement)
                                <li class="engagement-item">
                                    <p class="mb-1 fw-semibold">{{ $engagement->opportunity?->title ?? 'Interest captured' }}</p>
                                    <p class="mb-2 text-muted">{{ $engagement->ai_summary ?? $engagement->motivation ?? 'We captured your interest and routed it to the agency success team.' }}</p>
                                    <span class="badge bg-light text-dark">{{ optional($engagement->submitted_at)->diffForHumans() ?? 'Just now' }}</span>
                                </li>
                            @empty
                                <li class="engagement-item text-muted">No engagements recorded yet. Tap "Explore opportunities" to send your first signal.</li>
                            @endforelse
                        </ul>
                    </div>
                </div>
            </div>
        </section>

        <section
            class="civic-section impact-widget impact-widget--surface"
            id="partner-impact"
            data-impact-widget="partner-impact"
            data-impact-widget-id="partner-impact"
            data-impact-endpoint="{{ route('api.v1.impact.index', ['audience' => 'partner', 'timeframe' => 'monthly']) }}"
            data-impact-cache-key="impact:partner:monthly"
            data-impact-cache-ttl="900000"
            data-impact-audience="partner"
            data-impact-timeframe="monthly"
            data-impact-telemetry="impact.widget.partner"
        >
            <div class="impact-widget__header">
                <div>
                    <p class="section-eyebrow">Impact index</p>
                    <h2 class="section-title mb-1">Partner-level traction across Athena.</h2>
                    <p class="text-muted mb-0">Jobs, housing, grants, and radar actions update every 15 minutes so you can cite real numbers in civic briefings.</p>
                </div>
                <div class="impact-widget__meta" aria-live="polite">
                    <p class="impact-widget__meta-line" data-impact-window>Window syncing...</p>
                    <p class="impact-widget__meta-line" data-impact-generated>Last updated moments ago</p>
                    <button class="impact-widget__refresh" type="button" data-impact-refresh>
                        <span class="impact-widget__refresh-label">Refresh now</span>
                        <i class="fas fa-rotate"></i>
                    </button>
                </div>
            </div>

            <div class="impact-widget__grid" data-impact-grid role="list">
                @for ($i = 0; $i < 6; $i++)
                    <article class="impact-widget__card impact-widget__card--placeholder" aria-hidden="true" role="listitem">
                        <p class="impact-widget__label">Syncing partner metric...</p>
                        <p class="impact-widget__value">&mdash;</p>
                        <p class="impact-widget__description">Hydrating telemetry window</p>
                    </article>
                @endfor
            </div>

            <p class="impact-widget__footnote text-muted mb-0">
                Mirrors <code>impact:snapshots:capture</code> and the <code>/api/v1/impact?audience=partner</code> endpoint for monthly overview.
            </p>
        </section>

        <section class="civic-section">
            <div class="section-header">
                <h2 class="section-title">Social pulse</h2>
                <p class="text-muted mb-0">Real-time wins from agencies, founders, and community partners.</p>
            </div>
            <div class="social-grid">
                @forelse($socialHighlights as $post)
                    <article class="civic-card social-card">
                        <div class="social-card__meta">
                            <img class="social-card__avatar" src="{{ $post->profile?->avatar_url ?? asset('frontend/assets/imgs/template/avatar-default.png') }}" alt="{{ $post->profile?->display_name ?? 'Profile' }} avatar">
                            <div>
                                <strong>{{ $post->profile?->display_name }}</strong>
                                <p class="mb-0 text-muted">{{ $post->profile?->username ? '@'.$post->profile->username : 'Profile' }}</p>
                            </div>
                        </div>
                        <p class="mb-2">{{ \Illuminate\Support\Str::limit($post->caption, 180) }}</p>
                        <div class="civic-card__tags">
                            @foreach(collect($post->tags ?? [])->take(3) as $tag)
                                <span class="civic-tag">#{{ \Illuminate\Support\Str::slug($tag, '-') }}</span>
                            @endforeach
                        </div>
                        <a class="civic-card__cta" href="{{ route('social.posts.show', $post) }}">Open post <i class="fas fa-arrow-up-right-from-square"></i></a>
                    </article>
                @empty
                    <p class="text-muted">No social content found yet. Start the conversation from the feed.</p>
                @endforelse
            </div>
        </section>

        <section class="civic-section">
            <div class="section-header">
                <h2 class="section-title">Impact telemetry</h2>
                <p class="text-muted mb-0">Live metrics across procurement, policy, and community programs.</p>
            </div>
            <div class="insight-grid">
                @forelse($insights as $insight)
                    <article class="insight-card">
                        <p class="text-uppercase small text-muted">{{ ucfirst($insight->insight_type) }}</p>
                        <div class="insight-value">{{ $insight->metric_value }}</div>
                        <p class="mb-2 fw-semibold">{{ $insight->metric_label }}</p>
                        <p class="mb-1 text-muted">{{ $insight->summary }}</p>
                        @if($insight->change_label)
                            <span class="badge bg-light text-dark">{{ $insight->change_label }} · {{ $insight->change_percent }}% ({{ $insight->trend }})</span>
                        @endif
                    </article>
                @empty
                    <p class="text-muted">Insights will appear once data is captured.</p>
                @endforelse
            </div>
        </section>
    </div>
</div>
@endsection

@push('scripts')
<script>
    document.addEventListener('DOMContentLoaded', () => {
        const csrf = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

        document.querySelectorAll('.agency-follow').forEach((button) => {
            const endpoint = button.dataset.endpoint;
            const label = button.querySelector('.agency-follow__label');
            const defaultText = label ? label.textContent : 'Follow agency';
            const followingText = 'Following';

            button.addEventListener('click', async () => {
                if (!endpoint || button.dataset.loading === 'true') {
                    return;
                }

                button.dataset.loading = 'true';
                button.disabled = true;
                label && (label.textContent = 'Working...');

                try {
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': csrf,
                            'Accept': 'application/json',
                        },
                        body: JSON.stringify({}),
                        credentials: 'same-origin',
                    });

                    if (!response.ok) {
                        throw new Error('Request failed');
                    }

                    const data = await response.json();
                    if (data.success) {
                        const isFollowing = Boolean(data.is_following);
                        button.classList.toggle('is-active', isFollowing);
                        button.disabled = false;
                        label && (label.textContent = isFollowing ? followingText : defaultText);
                        button.dataset.loading = 'false';
                        return;
                    }

                    throw new Error(data.message || 'Unable to follow agency');
                } catch (error) {
                    console.error(error);
                    label && (label.textContent = 'Try again');
                    setTimeout(() => {
                        label && (label.textContent = defaultText);
                        button.disabled = false;
                        button.dataset.loading = 'false';
                    }, 1800);
                }
            });
        });
    });
</script>
@endpush

