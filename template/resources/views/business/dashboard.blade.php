@extends('frontend.layouts.master')

@section('contents')
@php
    $palette = $profile->heroPalette();
    $metrics = collect($profile->metrics);
    $digestSnapshot = $digestSnapshot ?? [];
    $accent = $palette['accent'] ?? '#ec4899';
@endphp

<div class="business-dashboard" style="--bd-accent: {{ $accent }};">
    <div class="bd-shell">
        @if (session('business_post_shared'))
            <div class="bd-alert bd-alert--success">
                <span class="bd-alert__label">Update published</span>
                <p class="mb-0">Your note is live on the Business Network feed.</p>
            </div>
        @endif

        <section class="bd-hero" style="--bd-hero-accent: {{ $accent }};">
            <div class="bd-hero__header">
                <div>
                    <p class="bd-eyebrow">Business Network</p>
                    <h1 class="bd-hero__title">{{ $profile->venture_name }}</h1>
                    <p class="bd-hero__summary">{{ $profile->tagline ?? 'Designing a women-first business with soul, strategy, and community.' }}</p>
                    <div class="bd-chip-row">
                        <span class="bd-chip">{{ ucfirst($profile->stage) }} stage</span>
                        <span class="bd-chip">{{ $profile->focus_industry }}</span>
                        <span class="bd-chip">{{ $profile->team_size ?? 'Solo glow' }}</span>
                    </div>
                </div>
                <div class="bd-hero__cta-group">
                    <a href="{{ route('business.formation-studio') }}" class="bd-cta">
                        Launch formation studio
                    </a>
                    <a href="#feed" class="bd-ghost">Jump to feed</a>
                </div>
            </div>
            <div class="bd-hero__stats">
                <article class="bd-kpi-card">
                    <p class="bd-kpi-card__label">Pilot partners</p>
                    <h3 class="bd-kpi-card__value">{{ number_format($metrics->get('pilot_partners', 0)) }}</h3>
                    <p class="bd-kpi-card__helper">Goal · 3</p>
                </article>
                <article class="bd-kpi-card">
                    <p class="bd-kpi-card__label">Waitlist</p>
                    <h3 class="bd-kpi-card__value">{{ number_format($metrics->get('waitlist', 120)) }}</h3>
                    <p class="bd-kpi-card__helper">People cheering already</p>
                </article>
                <article class="bd-kpi-card">
                    <p class="bd-kpi-card__label">Content streak</p>
                    <h3 class="bd-kpi-card__value">{{ number_format($metrics->get('content_streak', 5)) }} days</h3>
                    <p class="bd-kpi-card__helper">Keep glowing</p>
                </article>
            </div>
        </section>

        <section class="bd-grid">
            <div class="bd-column bd-column--primary">
                <article class="bd-card">
                    <div class="bd-card__header">
                        <div>
                            <p class="bd-card__tag" style="color: {{ $accent }};">Venture playbook</p>
                            <h2 class="bd-card__title">{{ $aiPlaybook['north_star'] }}</h2>
                            <p class="bd-card__helper">Daily focus distilled by your AI coach.</p>
                        </div>
                        <span class="bd-pill bd-pill--ai">AI assisted</span>
                    </div>
                    <div class="bd-ai-actions">
                        @foreach ($aiPlaybook['actions'] as $action)
                            <div class="bd-ai-actions__item">
                                <p class="fw-semibold mb-1">{{ $action['title'] }}</p>
                                <p class="text-muted small mb-0">{{ $action['description'] }}</p>
                            </div>
                        @endforeach
                    </div>
                </article>

                <article class="bd-card">
                    <div class="bd-card__header">
                        <div>
                            <p class="bd-card__tag">Glow path</p>
                            <h2 class="bd-card__title">Milestones</h2>
                        </div>
                        <span class="bd-pill">{{ $profile->milestones->count() }} active</span>
                    </div>
                    <div class="bd-milestones">
                        @foreach ($profile->milestones->take(4) as $milestone)
                            <div class="bd-milestone">
                                <div>
                                    <p class="bd-milestone__category">{{ $milestone->category }}</p>
                                    <p class="bd-milestone__title">{{ $milestone->title }}</p>
                                    <p class="bd-milestone__copy">{{ $milestone->summary }}</p>
                                    <a href="{{ $milestone->cta_url }}" target="_blank" class="bd-link">{{ $milestone->cta_label }}</a>
                                </div>
                                <div class="bd-milestone__meta">
                                    <span class="bd-chip bd-chip--soft">Due {{ optional($milestone->due_date)->format('d M') ?? 'TBD' }}</span>
                                    <span class="bd-status">{{ ucfirst($milestone->statusLabel()) }}</span>
                                </div>
                            </div>
                        @endforeach
                    </div>
                </article>

                <article class="bd-card">
                    <div class="bd-card__header">
                        <div>
                            <p class="bd-card__tag">Signal boost</p>
                            <h2 class="bd-card__title">Share an update</h2>
                        </div>
                    </div>
                    <form class="bd-composer" method="POST" action="{{ route('business.updates.store') }}">
                        @csrf
                        <textarea name="caption" placeholder="Celebrate a win, ask for support, or drop a behind-the-scenes note." required></textarea>
                        <div class="bd-composer__footer">
                            <p class="text-muted small mb-0">AI moderation + hashtag suggestions run automatically.</p>
                            <div class="bd-composer__controls">
                                <select name="visibility" class="form-select form-select-sm">
                                    <option value="public">Public feed</option>
                                    <option value="followers">Followers only</option>
                                </select>
                                <button type="submit" class="btn btn-primary">Post</button>
                            </div>
                        </div>
                    </form>
                </article>

                <article class="bd-card" id="feed">
                    <div class="bd-card__header">
                        <div>
                            <p class="bd-card__tag">Live stories</p>
                            <h2 class="bd-card__title">Business feed</h2>
                        </div>
                        <span class="bd-pill">{{ count($posts) }} posts</span>
                    </div>
                    <div class="bd-feed">
                        @forelse ($posts as $post)
                            <div class="bd-feed__post">
                                <div class="bd-feed__post-header">
                                    <div>
                                        <p class="mb-0 fw-semibold">{{ $post->profile->display_name }}</p>
                                        <small class="text-muted">@{{ $post->profile->username }} · {{ optional($post->published_at)->diffForHumans() }}</small>
                                    </div>
                                    <span class="bd-chip bd-chip--soft">AI score {{ $post->ai_engagement_score ?? '—' }}</span>
                                </div>
                                <p class="bd-feed__post-copy">{!! nl2br(e($post->caption)) !!}</p>
                                <div class="bd-feed__meta">
                                    <span><i class="fas fa-heart"></i> {{ number_format($post->likes_count) }}</span>
                                    <span><i class="fas fa-comment"></i> {{ number_format($post->comments_count) }}</span>
                                    <span><i class="fas fa-bookmark"></i> {{ number_format($post->saves_count ?? 0) }}</span>
                                </div>
                            </div>
                        @empty
                            <p class="text-muted mb-0">The feed is warming up. Be the first to share an update!</p>
                        @endforelse
                    </div>
                </article>
            </div>

            <div class="bd-column bd-column--support">
                <livewire:business.digest-widget :profile-id="$profile->id" :snapshot="$digestSnapshot" :key="'business-digest-' . $profile->id" />

                <article class="bd-card">
                    <div class="bd-card__header">
                        <div>
                            <p class="bd-card__tag">Playbook shelf</p>
                            <h2 class="bd-card__title">Featured resources</h2>
                        </div>
                    </div>
                    <div class="bd-resource-grid">
                        @foreach ($resources as $resource)
                            <div class="bd-resource" style="--resource-accent: {{ $resource->hero_color ?? 'rgba(244,114,182,0.15)' }};">
                                <span class="bd-chip bd-chip--light">{{ $resource->badgeLabel() }}</span>
                                <p class="fw-semibold mb-1">{{ $resource->title }}</p>
                                <p class="text-muted small mb-2">{{ $resource->summary }}</p>
                                <a href="{{ $resource->cta_url }}" target="_blank" class="bd-link">{{ $resource->cta_label }} →</a>
                            </div>
                        @endforeach
                    </div>
                </article>

                <article class="bd-card">
                    <div class="bd-card__header">
                        <div>
                            <p class="bd-card__tag">Signals</p>
                            <h2 class="bd-card__title">Trending tags</h2>
                        </div>
                    </div>
                    <div class="bd-chip-cloud">
                        @foreach ($trendingTags as $tag)
                            <span class="bd-chip bd-chip--soft">{{ $tag }}</span>
                        @endforeach
                    </div>
                </article>

                <article class="bd-card">
                    <div class="bd-card__header">
                        <div>
                            <p class="bd-card__tag">Community</p>
                            <h2 class="bd-card__title">Women to follow</h2>
                        </div>
                    </div>
                    <div class="bd-recommendations">
                        @foreach ($recommendedProfiles as $recommended)
                            <div class="bd-recommendation">
                                <img src="{{ $recommended->avatar_url }}" alt="{{ $recommended->display_name }}" loading="lazy">
                                <div>
                                    <p class="mb-0 fw-semibold">{{ $recommended->display_name }}</p>
                                    <small class="text-muted">@{{ $recommended->username }}</small>
                                </div>
                                <a href="{{ route('social.profiles.show', $recommended->username) }}" class="bd-ghost">View</a>
                            </div>
                        @endforeach
                    </div>
                </article>
            </div>
        </section>
    </div>
</div>
@endsection

