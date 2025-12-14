@php
    use Illuminate\Support\Arr;
    use Illuminate\Support\Str;

    $verticalIconMap = [
        'health' => 'fi-rr-heartbeat',
        'education' => 'fi-rr-graduation-cap',
        'creative' => 'fi-rr-palette',
        'civil-service' => 'fi-rr-government',
        'technology' => 'fi-rr-processor',
        'finance' => 'fi-rr-chart-histogram',
    ];

    $verticalGradients = [
        'linear-gradient(135deg, rgba(233,30,140,0.85) 0%, rgba(139,92,246,0.9) 100%)',
        'linear-gradient(135deg, rgba(6,182,212,0.9) 0%, rgba(59,130,246,0.9) 100%)',
        'linear-gradient(135deg, rgba(249,115,22,0.9) 0%, rgba(236,72,153,0.9) 100%)',
    ];

    $verticalInsights = collect($homeVerticalInsights ?? [])->take(6);
    $galleryAds = $homepageSponsorSlots['gallery'] ?? [];
@endphp

<section class="section-box mt-120 vertical-gateway-section">
    <div class="container">
        <div class="vertical-heading">
            <div>
                <span class="vertical-label">Industry Gateways</span>
                <h2 class="section-title">Choose Your Vertical</h2>
                <p class="section-subtitle">Step into curated pathways built with industry leaders.</p>
            </div>
            <div class="text-end">
                <a class="btn btn-outline-primary btn-rounded" href="{{ url('/verticals') }}">
                    See all verticals
                    <i class="fi-rr-arrow-right ms-2"></i>
                </a>
            </div>
        </div>
        <div class="row g-4">
            @forelse ($verticalInsights as $insight)
                @php
                    $slug = (string) $insight->vertical_slug;
                    $icon = Arr::get($verticalIconMap, $slug, 'fi-rr-telescope');
                    $gradient = $verticalGradients[$loop->index % count($verticalGradients)];
                    $updated = optional($insight->refreshed_at)->diffForHumans() ?? 'Just updated';
                @endphp
                <div class="col-12 col-md-6 col-xl-4">
                    <div class="vertical-card h-100" data-aos="fade-up" data-aos-delay="{{ $loop->index * 100 }}">
                        <div class="vertical-card__accent" style="background: {{ $gradient }}"></div>
                        <div class="vertical-card__body">
                            <div class="vertical-card__meta">
                                <span class="vertical-badge">
                                    <i class="{{ $icon }} me-2"></i>
                                    {{ Str::headline($slug) }}
                                </span>
                                <span class="vertical-updated">{{ $updated }}</span>
                            </div>
                            <h3 class="vertical-title">{{ $insight->vertical_name }}</h3>
                            <p class="vertical-copy">
                                Personalised roles, courses, and mentorship designed for this market.
                            </p>
                            <div class="vertical-stats">
                                <div class="stat-pill">
                                    <span class="stat-value">{{ number_format($insight->open_roles) }}</span>
                                    <span class="stat-label">Roles</span>
                                </div>
                                <div class="stat-pill">
                                    <span class="stat-value">{{ number_format($insight->courses) }}</span>
                                    <span class="stat-label">Courses</span>
                                </div>
                                <div class="stat-pill">
                                    <span class="stat-value">{{ number_format($insight->mentors) }}</span>
                                    <span class="stat-label">Mentors</span>
                                </div>
                            </div>
                            <a href="{{ url('/verticals/' . $slug) }}" class="vertical-link">
                                Enter vertical
                                <i class="fi-rr-arrow-right ms-2"></i>
                            </a>
                        </div>
                    </div>
                </div>
            @empty
                <div class="col-12">
                    <div class="alert alert-info mb-0">
                        Vertical insights are updating. Check back shortly for curated pathways.
                    </div>
                </div>
            @endforelse
        </div>

        @if (!empty($galleryAds))
            <div class="mt-70">
                <x-ad-slot :ads="$galleryAds" position="gallery" layout="masonry" />
            </div>
        @endif
    </div>
</section>



