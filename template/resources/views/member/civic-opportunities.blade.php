@extends('frontend.layouts.master')

@section('title', 'Civic Opportunities')
@section('meta_description', 'Member-facing view of public-sector missions, civic volunteer briefs, and Athena AI launchers.')

@push('styles')
    <link rel="stylesheet" href="{{ asset('css/public-sector.css') }}">
@endpush

@section('contents')
<div class="civic-shell">
    <div class="container">
        <section class="civic-hero">
            <div>
                <div class="civic-pill"><i class="fas fa-seedling"></i> Civic lab</div>
                <h1 class="civic-hero__title">Mission briefs you can act on today.</h1>
                <p class="text-muted">Pipeline cards from partnering agencies translated for members, freelancers, and founders ready to deliver public good.</p>
                <div class="mt-3 d-flex gap-2 flex-wrap">
                    <a href="{{ route('public-sector.dashboard') }}" class="btn btn-outline-primary">Learn about agencies</a>
                    <a href="{{ route('grants.index') }}" class="btn btn-primary" style="background: var(--civic-violet); border-color: var(--civic-violet);">Explore grants</a>
                </div>
            </div>
            <div class="civic-signal-grid">
                <div class="signal-card">
                    <p class="signal-label">Published missions</p>
                    <div class="signal-value">{{ $opportunities->count() }}</div>
                    <p class="small text-muted mb-0">Open to Athena members.</p>
                </div>
                <div class="signal-card">
                    <p class="signal-label">Your saved intents</p>
                    <div class="signal-value">{{ $signups->count() }}</div>
                    <p class="small text-muted mb-0">Already shared with agencies.</p>
                </div>
                <div class="signal-card">
                    <p class="signal-label">AI-ready briefs</p>
                    <div class="signal-value">{{ $opportunities->filter(fn ($item) => $item->missionBrief)->count() }}</div>
                    <p class="small text-muted mb-0">Launch Athena with context payloads.</p>
                </div>
            </div>
        </section>

        <section class="civic-section">
            <div class="section-header">
                <h2 class="section-title">Member-facing pipeline</h2>
                <p class="text-muted mb-0">Filter-free cards so you can scan impact, budget, and readiness quickly.</p>
            </div>
            <div class="opportunity-grid">
                @forelse($opportunities as $opportunity)
                    @php
                        $signup = $signups->get($opportunity->id);
                    @endphp
                    <article class="civic-card">
                        <p class="civic-card__eyebrow text-uppercase">{{ $opportunity->agency?->name ?? 'Agency' }}</p>
                        <h3 class="civic-card__title">{{ $opportunity->title }}</h3>
                        <p class="mb-2 text-muted">{{ $opportunity->delivery_region ?? 'Nationwide' }} · {{ $opportunity->budget_band ?? 'Budget in discovery' }}</p>
                        <p class="mb-1"><i class="fas fa-layer-group"></i> Stage: {{ $opportunity->stageLabel() }}</p>
                        <p class="mb-1"><i class="fas fa-calendar"></i> Opens {{ optional($opportunity->opens_at)->format('M j, Y') ?? 'soon' }}</p>
                        <div class="civic-card__tags">
                            <span class="civic-tag">{{ $opportunity->category ?? 'Civic' }}</span>
                            <span class="civic-tag">{{ $opportunity->compliance_risk === 'low' ? 'Low risk' : ucwords($opportunity->compliance_risk.' risk') }}</span>
                        </div>
                        <div class="mt-3 d-flex flex-wrap gap-2">
                            @if($opportunity->missionBrief)
                                <button class="btn btn-sm btn-outline-primary" type="button"
                                    data-ai-context-endpoint="{{ route('mission-briefs.ai-context', $opportunity->missionBrief) }}">
                                    <i class="fas fa-wand-magic-sparkles"></i> Ask Athena
                                </button>
                            @endif
                            <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#member-brief-{{ $opportunity->id }}">
                                View mission brief
                            </button>
                        </div>
                        <div class="collapse mt-3" id="member-brief-{{ $opportunity->id }}">
                            @if($opportunity->missionBrief)
                                <p class="text-muted small mb-2">{{ $opportunity->missionBrief->headline ?? 'Mission overview' }}</p>
                                <p>{{ \Illuminate\Support\Str::limit($opportunity->missionBrief->executive_summary, 260) }}</p>
                                @if(is_array($opportunity->missionBrief->mission_objectives))
                                    <ul class="small text-muted mb-0">
                                        @foreach(array_slice($opportunity->missionBrief->mission_objectives, 0, 3) as $objective)
                                            <li>{{ $objective }}</li>
                                        @endforeach
                                    </ul>
                                @endif
                            @else
                                <p class="text-muted">Mission brief is being finalised by the agency.</p>
                            @endif
                        </div>
                        <div class="mt-4">
                            @if($signup)
                                <span class="badge bg-success">Intent sent ({{ $signup->status }})</span>
                            @else
                                <a href="{{ route('public-sector.opportunities.index') }}" class="btn btn-outline-primary btn-sm">Register interest</a>
                            @endif
                        </div>
                    </article>
                @empty
                    <p class="text-muted">We’ll populate this board as soon as agencies publish civic-friendly briefs.</p>
                @endforelse
            </div>
        </section>
    </div>
</div>
@endsection

@include('components.ai.mission-brief-launcher', ['aiConciergeUrl' => $aiConciergeUrl])
