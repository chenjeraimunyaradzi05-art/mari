@extends('frontend.layouts.master')

@php
    use Illuminate\Support\Str;

    $suppressFrontendHeader = true;
    $suppressSponsorPreview = true;
    $suppressConciergeBar = true;
    $suppressFooterNewsletter = true;

    $totalPrograms = $programs->total();
    $activeFilters = array_filter([
        'Search' => $filters['q'] ?? null,
        'Credential' => isset($filters['level']) && $filters['level'] !== ''
            ? ($filterOptions['levels'][$filters['level']] ?? Str::headline($filters['level']))
            : null,
        'Delivery' => isset($filters['mode']) && $filters['mode'] !== ''
            ? ($filterOptions['modes'][$filters['mode']] ?? Str::headline($filters['mode']))
            : null,
        'Tag' => filled($filters['tag'] ?? null) ? '#'.ltrim($filters['tag'], '#') : null,
    ]);
@endphp

@push('styles')
    <link rel="stylesheet" href="{{ asset('css/tafe-dashboard.css') }}">
@endpush

@section('contents')
<div class="tafe-shell">
    <div class="tafe-aurora" aria-hidden="true"></div>
    <div class="container">
        <main id="tafe-programs" class="tafe-main" tabindex="-1">
            <section class="tafe-programs-hero" aria-label="Programs overview">
                <div class="tafe-programs-hero__content">
                    <p class="tafe-eyebrow">TAFE &amp; University pathways</p>
                    <h1>Curated programs for women-led learning arcs</h1>
                    <p>Filter by credential, delivery mode, or mission tags to surface programs that sync with your AI copilots.</p>
                    <ul class="tafe-hero__meta">
                        <li>{{ number_format($totalPrograms) }} programs indexed</li>
                        <li>{{ request('filter') === 'ai-match' ? 'AI-match priority on' : 'All pathways visible' }}</li>
                        <li>{{ filled($filters['tag'] ?? null) ? '#'.ltrim($filters['tag'], '#') : 'No tag filter' }}</li>
                    </ul>
                    <div class="tafe-programs-hero__actions">
                        <a class="tafe-btn tafe-btn--primary" href="{{ route('education.tafe.dashboard') }}">Back to dashboard</a>
                        <a class="tafe-btn tafe-btn--ghost" href="#tafe-programs-filter">Jump to filters</a>
                    </div>
                </div>
                <div class="tafe-programs-hero__panel" aria-label="Active filters">
                    <p class="tafe-hero__signal-label">Active filters</p>
                    <div class="tafe-programs-hero__chips">
                        @forelse($activeFilters as $label => $value)
                            <span class="tafe-tag">{{ $label }}: {{ $value }}</span>
                        @empty
                            <span class="tafe-tag">All programs</span>
                        @endforelse
                    </div>
                    @if(request('filter') === 'ai-match')
                        <div class="tafe-callout tafe-programs-ai-callout">
                            <p class="mb-1"><strong>AI match spotlight</strong></p>
                            <p class="mb-0">We’re prioritising programs with the highest personalised confidence scores.</p>
                        </div>
                    @else
                        <p class="tafe-programs-hero__hint">Toggle <a href="{{ route('education.tafe.programs.index', array_merge($filters, ['filter' => 'ai-match'])) }}" class="tafe-link">AI-match view</a> to emphasise personalised picks.</p>
                    @endif
                </div>
            </section>

            <section id="tafe-programs-filter" class="tafe-card tafe-programs-filter" aria-label="Program filters">
                <header class="tafe-card__header">
                    <div>
                        <p class="tafe-eyebrow">Filter programs</p>
                        <h3>Shape the cohort you need</h3>
                    </div>
                    <span class="tafe-chip">Live update</span>
                </header>
                <form method="GET" class="tafe-programs-filter__form">
                    <div class="tafe-programs-filter__grid">
                        <label class="tafe-field">
                            <span>Search</span>
                            <input type="text" name="q" value="{{ $filters['q'] ?? '' }}" class="tafe-input" placeholder="Design, nursing, engineering...">
                        </label>
                        <label class="tafe-field">
                            <span>Credential level</span>
                            <select name="level" class="tafe-input">
                                <option value="">All levels</option>
                                @foreach($filterOptions['levels'] as $value => $label)
                                    <option value="{{ $value }}" @selected(($filters['level'] ?? '') === $value)>{{ $label }}</option>
                                @endforeach
                            </select>
                        </label>
                        <label class="tafe-field">
                            <span>Delivery mode</span>
                            <select name="mode" class="tafe-input">
                                <option value="">Any mode</option>
                                @foreach($filterOptions['modes'] as $value => $label)
                                    <option value="{{ $value }}" @selected(($filters['mode'] ?? '') === $value)>{{ $label }}</option>
                                @endforeach
                            </select>
                        </label>
                        <label class="tafe-field">
                            <span>Tag</span>
                            <input type="text" name="tag" value="{{ $filters['tag'] ?? '' }}" class="tafe-input" placeholder="#saas">
                        </label>
                    </div>
                    <div class="tafe-programs-filter__actions">
                        <button class="tafe-btn tafe-btn--primary">Apply filters</button>
                        <a class="tafe-btn tafe-btn--ghost" href="{{ route('education.tafe.programs.index') }}">Reset</a>
                    </div>
                </form>
            </section>

            <section class="tafe-grid tafe-programs-grid" aria-label="Program results">
                @forelse($programs as $program)
                    <article class="tafe-card tafe-program-card">
                        <div class="tafe-program-card__meta">
                            <span class="tafe-pill">{{ strtoupper(str_replace('_', ' ', $program->credential_level)) }}</span>
                            <span class="tafe-program-card__delivery">{{ ucfirst($program->delivery_mode) }}</span>
                        </div>
                        <h3>{{ $program->title }}</h3>
                        <p class="tafe-program-card__institution">{{ $program->institution->name }}</p>
                        <p>{{ Str::limit($program->summary, 160) }}</p>
                        @php
                            $matchScore = $program->calculated_match_score ?? $program->ai_match_score ?? 0;
                        @endphp
                        <div class="tafe-program-card__footer">
                            <div>
                                <p class="tafe-program-card__score">{{ number_format($matchScore, 1) }}%</p>
                                <span class="tafe-program-card__score-label">AI match</span>
                            </div>
                            <a class="tafe-btn tafe-btn--secondary" href="{{ route('education.tafe.programs.show', $program) }}">View program</a>
                        </div>
                    </article>
                @empty
                    <div class="tafe-empty-state">No programs match your filters yet. Adjust the filters to reveal more cohorts.</div>
                @endforelse
            </section>

            <div class="tafe-pagination">
                {{ $programs->withQueryString()->links() }}
            </div>
        </main>
    </div>
</div>
@endsection

