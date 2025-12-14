@extends('layouts.master')

@section('title', $listing['title'] . ' · Housing Hub')
@section('meta_description', $listing['summary'] ?? 'Athena Housing Hub listing overview.')

@section('content')
    @php
        $openHomes = $listing['open_homes'];
    @endphp

    <section class="hub-section hub-section--intro hub-section--signals-right housing-detail" id="housing-detail-hero">
        <div class="container hub-section__layout">
            <div class="hub-section__content housing-detail__content">
                <p class="section-eyebrow">{{ $listing['listing_type'] }} listing</p>
                <h2 class="heading-secondary">{{ $listing['title'] }}</h2>
                <p>{{ $listing['address'] }}</p>

                <div class="housing-detail__price">
                    <span>Price guide</span>
                    <strong>{{ $listing['price_display'] }}</strong>
                    <small>Repayments approx {{ $listing['repayment_text'] }}</small>
                </div>

                <div class="hub-section__signals">
                    <div class="hub-section__stat">
                        <span class="hub-section__stat-value">{{ $listing['bedrooms'] }}</span>
                        <span class="hub-section__stat-label">Bedrooms</span>
                    </div>
                    <div class="hub-section__stat">
                        <span class="hub-section__stat-value">{{ $listing['bathrooms'] }}</span>
                        <span class="hub-section__stat-label">Bathrooms</span>
                    </div>
                    <div class="hub-section__stat">
                        <span class="hub-section__stat-value">{{ $listing['car_spaces'] }}</span>
                        <span class="hub-section__stat-label">Car</span>
                    </div>
                </div>

                <div class="cta-row">
                    <a class="btn btn--full" href="{{ route('housing.mortgage-calculator') }}">Mortgage tools</a>
                    <a class="btn btn--outline" href="{{ route('housing.index') }}">Back to listings</a>
                </div>
            </div>

            <div class="hub-section__meta housing-detail__media">
                <figure class="housing-detail__figure">
                    <img src="{{ $listing['hero_image_url'] }}" alt="{{ $listing['title'] }}">
                    <figcaption>{{ $listing['suburb'] }}, {{ $listing['state'] }}</figcaption>
                    <span class="housing-card__pill">{{ $listing['listing_type'] }}</span>
                    <span class="housing-card__badge {{ $listing['is_verified'] ? 'is-verified' : '' }}">
                        {{ $listing['is_verified'] ? 'Verified agent' : 'Community listing' }}
                    </span>
                </figure>
            </div>
        </div>
    </section>

    <section class="section-shell housing-detail-panels">
        <div class="housing-detail-panels__grid">
            <article class="housing-detail-panel">
                <p class="section-eyebrow">Key features</p>
                <ul>
                    <li>{{ $listing['bedrooms'] }} bedrooms</li>
                    <li>{{ $listing['bathrooms'] }} bathrooms</li>
                    <li>{{ $listing['car_spaces'] }} car spaces</li>
                    <li>{{ $listing['property_size'] }} sqm footprint</li>
                </ul>
            </article>
            <article class="housing-detail-panel">
                <p class="section-eyebrow">Open homes</p>
                <ul>
                    @forelse ($openHomes as $openHome)
                        <li>{{ $openHome->format('D, M d') }} at {{ $openHome->format('h:i A') }}</li>
                    @empty
                        <li>No upcoming inspections. Contact the agents to arrange a viewing.</li>
                    @endforelse
                </ul>
            </article>
            <article class="housing-detail-panel">
                <p class="section-eyebrow">Support shortcuts</p>
                <ul>
                    <li><a href="{{ route('housing.mortgage-calculator') }}">Mortgage calculator</a></li>
                    <li><a href="{{ route('grants.index', ['type' => 'housing']) }}">Housing grants</a></li>
                    <li><a href="{{ route('financial.budgets.create') }}">Budget planner</a></li>
                </ul>
            </article>
        </div>
    </section>

    <section class="section-shell housing-detail-description">
        <div class="section-text">
            <p class="section-eyebrow">About the property</p>
            <h2 class="heading-tertiary">Why this listing matters now</h2>
            <p>{{ $listing['summary'] }}</p>
        </div>
        <div class="section-media">
            <div class="housing-detail-description__card">
                <p>{{ $listing['description'] }}</p>
            </div>
        </div>
    </section>

    <section class="section-shell housing-detail-agents" id="housing-agents">
        <div class="section-text">
            <p class="section-eyebrow">Agent team</p>
            <h2 class="heading-tertiary">Guardians and allies on this listing</h2>
        </div>
        <div class="section-media housing-detail-agents__grid">
            @foreach ($listing['agents'] as $agent)
                <article class="housing-detail-agent">
                    <img src="{{ $agent['avatar_url'] }}" alt="{{ $agent['name'] }}">
                    <div>
                        <p class="housing-detail-agent__name">{{ $agent['name'] }}</p>
                        <p class="housing-detail-agent__contact">{{ $agent['phone'] }}</p>
                        <a href="mailto:{{ $agent['email'] }}">Email agent</a>
                    </div>
                </article>
            @endforeach
        </div>
    </section>

    <section class="section-shell housing-detail-cta">
        <div class="section-text">
            <p class="section-eyebrow">Need help assessing affordability?</p>
            <h2 class="heading-secondary">Athena affordability coach keeps deposits, grants and repayments synced</h2>
            <p>Use mortgage copilots, grant directories and budget planners to build a transparent path to this address or the next one that fits.</p>
            <div class="cta-row">
                <a class="btn btn--full" href="{{ route('housing.mortgage-calculator') }}">Launch mortgage tools</a>
                <a class="btn btn--outline" href="{{ route('grants.index', ['type' => 'housing']) }}">View housing grants</a>
            </div>
        </div>
    </section>
@endsection
