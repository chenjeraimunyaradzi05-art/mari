@extends('frontend.layouts.master')

@php
    use Illuminate\Support\Str;

    $suppressFrontendHeader = true;
    $suppressSponsorPreview = true;
    $suppressConciergeBar = true;
    $suppressFooterNewsletter = true;

    $pillLabel = Str::upper(str_replace('_', ' ', $program->credential_level));
    $duration = $program->duration_weeks ? $program->duration_weeks.' weeks' : 'Flexible pace';
    $tuition = $program->tuition_from_aud
        ? 'AU$'.number_format($program->tuition_from_aud).($program->tuition_to_aud ? ' - AU$'.number_format($program->tuition_to_aud) : '')
        : 'Upon request';
    $matchScoreDisplay = number_format($matchScore ?? $program->ai_match_score ?? 0, 1);
@endphp

@push('styles')
    <link rel="stylesheet" href="{{ asset('css/tafe-dashboard.css') }}">
@endpush

@section('contents')
<div class="tafe-shell">
    <div class="tafe-aurora" aria-hidden="true"></div>
    <div class="container">
        <main class="tafe-main" id="tafe-program-show" tabindex="-1">
            <section class="tafe-hero" aria-label="Program hero">
                <div>
                    <p class="tafe-eyebrow">{{ $program->institution->name }}</p>
                    <span class="tafe-pill">{{ $pillLabel }}</span>
                    <h1 class="tafe-hero__title">{{ $program->title }}</h1>
                    <p class="tafe-hero__subtitle">{{ $program->summary ?? 'Explore this pathway curated for women-led learning arcs.' }}</p>
                    <ul class="tafe-hero__meta">
                        <li>{{ Str::headline($program->delivery_mode) }} delivery</li>
                        <li>{{ $duration }}</li>
                        <li>{{ $tuition }}</li>
                    </ul>
                    <div class="tafe-hero__actions">
                        <form method="POST" action="{{ route('education.tafe.programs.journeys.store', $program) }}">
                            @csrf
                            <input type="hidden" name="status" value="exploring">
                            <button class="tafe-btn tafe-btn--primary" type="submit">Track this program</button>
                        </form>
                        <a href="{{ route('education.tafe.programs.index') }}" class="tafe-btn tafe-btn--ghost">Back to programs</a>
                    </div>
                </div>
                <div class="tafe-hero__panel" aria-label="AI match insights">
                    <p class="tafe-hero__signal-label">AI match score</p>
                    <p class="tafe-hero__signal-value">{{ $matchScoreDisplay }}%</p>
                    <p class="tafe-hero__signal-note">Personalised confidence based on your intent + cohorts.</p>
                    @if($program->ai_recommendation_snippet)
                        <p class="mt-3">“{{ $program->ai_recommendation_snippet }}”</p>
                    @endif
                    <ul class="tafe-taglist mt-3">
                        @foreach(($program->ai_match_traits ?? []) as $trait)
                            <li class="tafe-tag">{{ Str::headline($trait) }}</li>
                        @endforeach
                    </ul>
                </div>
            </section>

            <section class="tafe-grid" aria-label="Program blueprint">
                <article class="tafe-card">
                    <header class="tafe-card__header">
                        <div>
                            <p class="tafe-eyebrow">Delivery essentials</p>
                            <h3>Support playbook</h3>
                        </div>
                        <span class="tafe-chip">Live cohorts</span>
                    </header>
                    <div class="tafe-card__body">
                        <div class="tafe-grid tafe-grid--profile">
                            <div>
                                <p class="tafe-hero__signal-label">Delivery</p>
                                <p class="tafe-statcard__value">{{ Str::headline($program->delivery_mode) }}</p>
                            </div>
                            <div>
                                <p class="tafe-hero__signal-label">Duration</p>
                                <p class="tafe-statcard__value">{{ $duration }}</p>
                            </div>
                            <div>
                                <p class="tafe-hero__signal-label">Weekly commitment</p>
                                <p class="tafe-statcard__value">{{ $program->weekly_commitment_hours ? $program->weekly_commitment_hours.' hrs' : 'Adaptive' }}</p>
                            </div>
                            <div>
                                <p class="tafe-hero__signal-label">Investment</p>
                                <p class="tafe-statcard__value">{{ $tuition }}</p>
                            </div>
                        </div>

                        @if($program->support_services)
                            <div>
                                <p class="tafe-hero__signal-label">Support stack</p>
                                <ul class="tafe-bullet-list">
                                    @foreach($program->support_services as $key => $service)
                                        <li><strong>{{ Str::headline($key) }}:</strong> {{ $service }}</li>
                                    @endforeach
                                </ul>
                            </div>
                        @endif

                        @if($program->funding_options)
                            <div>
                                <p class="tafe-hero__signal-label">Funding</p>
                                <div class="tafe-taglist">
                                    @foreach($program->funding_options as $option)
                                        <span class="tafe-tag">{{ $option }}</span>
                                    @endforeach
                                </div>
                            </div>
                        @endif

                        @if($program->outcomes)
                            <div>
                                <p class="tafe-hero__signal-label">Career outcomes</p>
                                <ul class="tafe-bullet-list">
                                    @foreach($program->outcomes as $outcome)
                                        <li>{{ $outcome }}</li>
                                    @endforeach
                                </ul>
                            </div>
                        @endif
                    </div>
                </article>

                <article class="tafe-card">
                    <header class="tafe-card__header">
                        <div>
                            <p class="tafe-eyebrow">Upcoming cohorts</p>
                            <h3>Intake schedule</h3>
                        </div>
                        <span class="tafe-chip">{{ $program->intakes->count() ? $program->intakes->count().' listed' : 'Auto-updates' }}</span>
                    </header>
                    <div class="tafe-card__body tafe-grid tafe-grid--insights">
                        @forelse($program->intakes as $intake)
                            <div class="tafe-card tafe-card--nested">
                                <p class="tafe-hero__signal-label">{{ $intake->intake_name }}</p>
                                <p class="tafe-statcard__value">{{ optional($intake->start_date)->format('d M Y') ?? 'Flexible start' }}</p>
                                <p class="tafe-note">{{ $intake->is_virtual ? 'Virtual / Hybrid' : 'On campus' }}</p>
                                <p class="tafe-note">Apply by {{ optional($intake->application_deadline)->format('d M Y') ?? 'rolling' }}</p>
                            </div>
                        @empty
                            <div class="tafe-empty-state">No intake published yet. Register interest to unlock early invites.</div>
                        @endforelse
                    </div>
                </article>
            </section>

            <section class="tafe-grid tafe-grid--profile" aria-label="AI actions and journey">
                <article class="tafe-card">
                    <header class="tafe-card__header">
                        <div>
                            <p class="tafe-eyebrow">Copilot prompts</p>
                            <h3>AI actions</h3>
                        </div>
                    </header>
                    <ul class="tafe-bullet-list">
                        @foreach($recommendedActions as $action)
                            <li>{{ $action }}</li>
                        @endforeach
                    </ul>
                </article>

                <article class="tafe-card">
                    <header class="tafe-card__header">
                        <div>
                            <p class="tafe-eyebrow">Your journey</p>
                            <h3>Progress tracker</h3>
                        </div>
                    </header>
                    @if($journey)
                        <p class="tafe-note mb-2">Status • {{ Str::headline($journey->status) }}</p>
                        <p class="tafe-statcard__value">{{ number_format($journey->ai_success_probability, 1) }}% success odds</p>
                        @if($journey->motivation_note)
                            <blockquote class="tafe-note">“{{ $journey->motivation_note }}”</blockquote>
                        @endif
                    @else
                        <p class="tafe-note mb-3">No journey logged yet.</p>
                        <form method="POST" action="{{ route('education.tafe.programs.journeys.store', $program) }}">
                            @csrf
                            <input type="hidden" name="status" value="exploring">
                            <button class="tafe-btn tafe-btn--secondary">Start tracking</button>
                        </form>
                    @endif
                </article>
            </section>

            <section class="tafe-card" aria-label="Similar programs">
                <header class="tafe-card__header">
                    <div>
                        <p class="tafe-eyebrow">Also trending</p>
                        <h3>Similar programs</h3>
                    </div>
                </header>
                <div class="tafe-grid tafe-programs-grid">
                    @forelse($similarPrograms as $similar)
                        <article class="tafe-card tafe-program-card">
                            <div class="tafe-program-card__meta">
                                <span class="tafe-pill">{{ Str::upper(str_replace('_', ' ', $similar->credential_level)) }}</span>
                                <span class="tafe-program-card__delivery">{{ Str::headline($similar->delivery_mode) }}</span>
                            </div>
                            <h3>{{ $similar->title }}</h3>
                            <p class="tafe-program-card__institution">{{ $similar->institution->name }}</p>
                            <p>{{ Str::limit($similar->summary, 140) }}</p>
                            <div class="tafe-program-card__footer">
                                <div>
                                    <p class="tafe-program-card__score">{{ number_format($similar->ai_match_score, 1) }}%</p>
                                    <span class="tafe-program-card__score-label">AI match</span>
                                </div>
                                <a class="tafe-btn tafe-btn--ghost" href="{{ route('education.tafe.programs.show', $similar) }}">View program</a>
                            </div>
                        </article>
                    @empty
                        <div class="tafe-empty-state">No adjacent programs yet.</div>
                    @endforelse
                </div>
            </section>
        </main>
    </div>
</div>
@endsection

