@extends('layouts.master')

@section('title', 'Housing Hub')
@section('meta_description', 'Women-first rentals, purchasing support and mortgage tools inside Athena Housing Hub.')

@push('styles')
<style>
    .housing-content-wrapper {
        display: grid;
        grid-template-columns: 1fr;
        gap: 2rem;
        align-items: start;
    }
    @media (min-width: 1024px) {
        .housing-content-wrapper {
            grid-template-columns: 1fr 340px;
        }
    }
    .sidebar-widget {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 24px;
        padding: 1.5rem;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .sidebar-widget h3 {
        font-size: 1.1rem;
        margin: 0 0 1rem 0;
        color: #1e293b;
        font-weight: 600;
    }
    .agent-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    .agent-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        object-fit: cover;
    }
    .agent-info div:first-child {
        font-weight: 600;
        font-size: 0.95rem;
        color: #0f172a;
    }
    .agent-info div:last-child {
        font-size: 0.8rem;
        color: #64748b;
    }
</style>
@endpush

@section('content')
    @php
        $totalListings = method_exists($listings, 'total') ? (int) $listings->total() : count($listings);
        $currentPage = method_exists($listings, 'currentPage') ? (int) $listings->currentPage() : 1;
        $lastPage = method_exists($listings, 'lastPage') ? (int) $listings->lastPage() : 1;
        $hasPages = method_exists($listings, 'hasPages') ? $listings->hasPages() : false;
    @endphp

    <section class="hub-section hub-section--intro hub-section--signals-right housing-experience" id="housing-hero">
        <div class="container hub-section__layout">
            <div class="hub-section__content">
                <p class="section-eyebrow">Housing security</p>
                <h2 class="heading-secondary">Find safe rentals, co-living sanctuaries and purchase-ready homes</h2>
                <p>
                    Athena Housing Hub blends trauma-aware listings, guardian-vetted agents and mortgage copilots so you can explore new addresses without
                    repeating the same story.
                </p>

                <div class="hub-section__signals">
                    <div class="hub-section__stat">
                        <span class="hub-section__stat-value">{{ number_format($totalListings) }}</span>
                        <span class="hub-section__stat-label">active listings</span>
                    </div>
                    <div class="hub-section__stat">
                        <span class="hub-section__stat-value">{{ count($filters['locations']) }}</span>
                        <span class="hub-section__stat-label">focus locations</span>
                    </div>
                    <div class="hub-section__stat">
                        <span class="hub-section__stat-value">{{ count($filters['listing_types']) }}</span>
                        <span class="hub-section__stat-label">pathways</span>
                    </div>
                </div>

                <div class="cta-row">
                    <a href="{{ route('housing.preferences') }}" class="btn btn--full">Update housing preferences</a>
                    <a href="{{ route('housing.mortgage-calculator') }}" class="btn btn--outline">Open mortgage tools</a>
                </div>
            </div>

            <div class="hub-section__meta">
                <div class="hub-intro-card housing-hero-card">
                    <p class="section-eyebrow">Guardian rituals</p>
                    <ul>
                        <li>Listings screened for safety language + privacy settings.</li>
                        <li>Agents pledge trauma-aware comms and flexible inspections.</li>
                        <li>Mortgage copilots keep deposit math and grant rules in one place.</li>
                    </ul>
                </div>
            </div>
        </div>
    </section>

    <section class="section-shell housing-filters" aria-label="Filter housing listings">
        <form method="get" action="{{ route('housing.index') }}" class="housing-filter-panel">
            <div class="housing-filter">
                <label for="location">Location</label>
                <select id="location" name="location">
                    @foreach ($filters['locations'] as $option)
                        <option value="{{ $option }}" @selected(request('location') === $option)>{{ $option }}</option>
                    @endforeach
                </select>
            </div>
            <div class="housing-filter">
                <label for="property_type">Property type</label>
                <select id="property_type" name="property_type">
                    @foreach ($filters['types'] as $option)
                        <option value="{{ $option }}" @selected(request('property_type') === $option)>{{ $option }}</option>
                    @endforeach
                </select>
            </div>
            <div class="housing-filter">
                <label for="budget">Budget</label>
                <select id="budget" name="budget">
                    @foreach ($filters['budgets'] as $option)
                        <option value="{{ $option }}" @selected(request('budget') === $option)>{{ $option }}</option>
                    @endforeach
                </select>
            </div>
            <div class="housing-filter">
                <label for="bedrooms">Bedrooms</label>
                <select id="bedrooms" name="bedrooms">
                    @foreach ($filters['bedrooms'] as $option)
                        <option value="{{ $option }}" @selected(request('bedrooms') === $option)>{{ $option }}</option>
                    @endforeach
                </select>
            </div>
            <div class="housing-filter">
                <label for="listing_type">For</label>
                <select id="listing_type" name="listing_type">
                    @foreach ($filters['listing_types'] as $option)
                        <option value="{{ $option }}" @selected(request('listing_type') === $option)>{{ $option }}</option>
                    @endforeach
                </select>
            </div>
            <div class="housing-filter housing-filter--cta">
                <button class="btn btn--full" type="submit">Show matches</button>
            </div>
        </form>
    </section>

    <section class="section-shell housing-content-wrapper">
        <div class="housing-main">
            <div class="housing-card-grid">
                @foreach ($listings as $listing)
                    <article class="housing-card">
                        <div class="housing-card__media">
                            <img src="{{ $listing['hero_image_url'] }}" alt="{{ $listing['title'] }}">
                            <span class="housing-card__pill">{{ $listing['listing_type'] }}</span>
                            <span class="housing-card__badge {{ $listing['is_verified'] ? 'is-verified' : '' }}">
                                {{ $listing['is_verified'] ? 'Verified agent' : 'Community listing' }}
                            </span>
                        </div>
                        <div class="housing-card__body">
                            <h3 class="housing-card__title">{{ $listing['title'] }}</h3>
                            <p class="housing-card__location">{{ $listing['suburb'] }}, {{ $listing['state'] }}</p>
                            <p class="housing-card__price">{{ $listing['price_display'] }}</p>

                            <ul class="housing-card__stats">
                                <li><strong>{{ $listing['bedrooms'] }}</strong><span>Bedrooms</span></li>
                                <li><strong>{{ $listing['bathrooms'] }}</strong><span>Bathrooms</span></li>
                                <li><strong>{{ $listing['car_spaces'] }}</strong><span>Car</span></li>
                            </ul>

                            <p class="housing-card__summary">{{ $listing['summary'] }}</p>

                            <div class="housing-card__footer">
                                <div class="housing-card__agents" aria-label="Featured agents">
                                    @foreach ($listing['agents'] as $agent)
                                        <img src="{{ $agent['avatar_url'] }}" alt="{{ $agent['name'] }}">
                                    @endforeach
                                </div>
                                <a class="btn btn--outline" href="{{ route('housing.show', ['listing' => $listing['slug']]) }}">View details</a>
                            </div>
                        </div>
                    </article>
                @endforeach
            </div>

            @if ($hasPages)
                <nav class="housing-pagination" aria-label="Housing pagination" style="margin-top: 2rem;">
                    <div class="housing-pagination__info">
                        Page {{ $currentPage }} of {{ $lastPage }}
                    </div>
                    <div class="housing-pagination__controls">
                        @if ($listings->onFirstPage())
                            <span class="housing-pagination__btn is-disabled">Previous</span>
                        @else
                            <a class="housing-pagination__btn" href="{{ $listings->previousPageUrl() }}">Previous</a>
                        @endif

                        @if ($listings->hasMorePages())
                            <a class="housing-pagination__btn" href="{{ $listings->nextPageUrl() }}">Next</a>
                        @else
                            <span class="housing-pagination__btn is-disabled">Next</span>
                        @endif
                    </div>
                </nav>
            @endif
        </div>

        <aside class="housing-sidebar" style="display: flex; flex-direction: column; gap: 2rem;">

            <!-- Emergency Support Widget -->
            @include('housing.partials.emergency-support')

            <!-- Counselling Services Widget -->
            @include('housing.partials.counselling-services')

            <!-- Approved Agents -->
            <div class="sidebar-widget">
                <h3>Approved Agents</h3>
                <div class="agent-list" style="display: flex; flex-direction: column; gap: 1rem;">
                    <div class="agent-item">
                        <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80" alt="Sienna Clarke" class="agent-avatar">
                        <div class="agent-info">
                            <div>Sienna Clarke</div>
                            <div>Athena Verified</div>
                        </div>
                    </div>
                    <div class="agent-item">
                        <img src="https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=100&q=80" alt="Marley Ortiz" class="agent-avatar">
                        <div class="agent-info">
                            <div>Marley Ortiz</div>
                            <div>Athena Verified</div>
                        </div>
                    </div>
                     <div class="agent-item">
                        <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=100&q=80" alt="Sarah Jenkins" class="agent-avatar">
                        <div class="agent-info">
                            <div>Sarah Jenkins</div>
                            <div>Athena Verified</div>
                        </div>
                    </div>
                </div>
                <a href="#" style="display: block; margin-top: 1rem; text-align: center; font-size: 0.9rem; color: #ec4899; font-weight: 600;">View all agents</a>
            </div>

            <!-- Lending Institutions -->
            <div class="sidebar-widget">
                <h3>Lending Partners</h3>
                <div class="lender-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div style="background: #f8fafc; padding: 1rem; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                        <img src="{{ asset('img/logos/cba.svg') }}" alt="CBA" style="max-height: 30px; max-width: 100%;">
                    </div>
                    <div style="background: #f8fafc; padding: 1rem; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                        <img src="{{ asset('img/logos/lendlease.svg') }}" alt="Lendlease" style="max-height: 25px; max-width: 100%;">
                    </div>
                </div>
                 <p style="font-size: 0.85rem; color: #64748b; margin-top: 1rem; line-height: 1.5;">
                    We partner with institutions committed to fair lending for women.
                </p>
            </div>

            <!-- Mortgage Brokers -->
            <div class="sidebar-widget">
                <h3>Mortgage Brokers</h3>
                <div class="broker-list" style="display: flex; flex-direction: column; gap: 1rem;">
                     <div class="agent-item">
                        <div style="width: 48px; height: 48px; border-radius: 50%; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; font-weight: 700;">EL</div>
                        <div class="agent-info">
                            <div>Emily Liu</div>
                            <div>Senior Broker</div>
                        </div>
                    </div>
                    <div class="agent-item">
                        <div style="width: 48px; height: 48px; border-radius: 50%; background: #f0fdf4; color: #16a34a; display: flex; align-items: center; justify-content: center; font-weight: 700;">RJ</div>
                        <div class="agent-info">
                            <div>Rachel Jones</div>
                            <div>First Home Specialist</div>
                        </div>
                    </div>
                </div>
                <a href="{{ route('housing.mortgage-calculator') }}" class="btn btn--outline btn--full" style="margin-top: 1.25rem; font-size: 0.9rem;">Connect with a broker</a>
            </div>

        </aside>
    </section>

    <section class="section-shell housing-mortgage" id="housing-mortgage">
        <div class="section-text">
            <p class="section-eyebrow">Deposit copilots</p>
            <h2 class="heading-secondary">Mortgage tools sized for women-led households</h2>
            <p>
                Run repayment scenarios, surface grant eligibility and keep your deposit gap front-and-centre. Every calculation remembers your preferences
                so support teams can pick up right where you left off.
            </p>
            <div class="cta-row">
                <a class="btn btn--full" href="{{ route('housing.mortgage-calculator') }}">Launch mortgage calculator</a>
                <a class="btn btn--outline" href="{{ route('housing.preferences') }}">Sync housing profile</a>
            </div>
        </div>
        <div class="section-media">
            <div class="hub-intro-card housing-mortgage-card">
                <p class="section-eyebrow">What you get</p>
                <ul>
                    <li>Deposit tracker that flags sponsor-ready gaps.</li>
                    <li>Interest rate comparisons with ethical finance partners.</li>
                    <li>Grant bundles that update when states refresh rules.</li>
                </ul>
            </div>
        </div>
    </section>
@endsection
