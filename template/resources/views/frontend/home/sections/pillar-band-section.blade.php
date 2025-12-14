@php
    $pillars = [
        [
            'slug' => 'recruitment',
            'icon' => 'fi-rr-users-alt',
            'title' => 'Recruitment + Social',
            'copy' => 'Premium roles with a supportive social graph.',
            'metric' => '92% job satisfaction',
            'route' => route('jobs.index'),
            'cta' => 'Browse curated roles',
        ],
        [
            'slug' => 'education',
            'icon' => 'fi-rr-graduation-cap',
            'title' => 'Education',
            'copy' => 'Degrees and micro-credentials tailored to your path.',
            'metric' => '1,800+ verified courses',
            'route' => url('/organizations'),
            'cta' => 'Explore providers',
        ],
        [
            'slug' => 'apprenticeships',
            'icon' => 'fi-rr-tools',
            'title' => 'Apprenticeships',
            'copy' => 'End-to-end apprenticeships with subsidy guidance.',
            'metric' => '320 open intakes',
            'route' => url('/apprenticeships'),
            'cta' => 'See apprenticeships',
        ],
        [
            'slug' => 'innovation',
            'icon' => 'fi-rr-rocket',
            'title' => 'Strategic Innovations',
            'copy' => 'Career Intelligence Engine & vertical labs.',
            'metric' => 'Predictive accuracy 87%',
            'route' => url('/career-intelligence'),
            'cta' => 'Preview insights',
        ],
    ];

    $featureStripAds = $homepageSponsorSlots['feature-strip'] ?? [];
@endphp

<section class="section-box mt-120">
    <div class="container">
        <div class="row g-4">
            @foreach ($pillars as $pillar)
                <div class="col-12 col-md-6 col-xl-3">
                    <div class="card h-100 border-0 shadow-sm pillar-card">
                        <div class="card-body">
                            <div class="pillar-icon mb-3">
                                <i class="{{ $pillar['icon'] }}"></i>
                            </div>
                            <h4 class="pillar-title">{{ $pillar['title'] }}</h4>
                            <p class="pillar-copy">{{ $pillar['copy'] }}</p>
                            <span class="pillar-metric">{{ $pillar['metric'] }}</span>
                            <a href="{{ $pillar['route'] }}" class="btn btn-link p-0 mt-3 pillar-link">
                                {{ $pillar['cta'] }}
                                <i class="fi-rr-arrow-right ms-2"></i>
                            </a>
                        </div>
                    </div>
                </div>
            @endforeach
        </div>

        @if (!empty($featureStripAds))
            <div class="mt-60">
                <x-ad-slot :ads="$featureStripAds" position="feature-strip" layout="strip" />
            </div>
        @endif
    </div>
</section>



