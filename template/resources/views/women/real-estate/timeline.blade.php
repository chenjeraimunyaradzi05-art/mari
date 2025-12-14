@extends('women.real-estate.layouts.console')

@section('console-content')
    <section class="wr-console-hero" aria-label="AI guidance overview">
        <div class="wr-console-hero-grid">
            <div class="hero-spotlight">
                <div class="hero-spotlight-ribbon">
                    <span class="wr-console-pill">Cohort timeline</span>
                    <span class="glow-pill">{{ \Illuminate\Support\Str::headline($profile->persona->value ?? 'WomenRise member') }}</span>
                </div>
                <h1 class="wr-console-title">Your AI nudges outside the dashboard</h1>
                <p class="wr-console-lede">We log every activation step, partner preview, and sustainability push here so you can act without loading the dashboard modules.</p>
            </div>
            <div class="hero-stat-card">
                <p class="hero-stat-card__label">Last sync</p>
                <p class="hero-stat-card__value">{{ now()->diffForHumans() }}</p>
                <p class="hero-stat-card__hint">New events arrive whenever AI guidance fires anywhere in WomenRise.</p>
            </div>
        </div>
    </section>

    <section class="wr-console-panel" aria-label="Timeline events">
        @livewire('cohorts.timeline', ['profileId' => $profile->id])
    </section>
@endsection
