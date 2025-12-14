@extends('layouts.master')

@section('title', 'Athena Social + AI')
@section('meta_description', 'Full overview of the Athena social feed, AI copilots and respectful community metrics.')

@push('styles')
    <style>
        .hero-slider {
            position: relative;
            overflow: hidden;
            border-radius: 1.5rem;
            background: linear-gradient(135deg, rgba(91, 33, 182, 0.12), rgba(236, 72, 153, 0.12));
            box-shadow: 0 30px 80px -40px rgba(15, 23, 42, 0.5);
        }

        .hero-slider__viewport {
            position: relative;
            min-height: 360px;
        }

        .hero-slide {
            position: absolute;
            inset: 0;
            margin: 0;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.6s ease;
            display: flex;
            flex-direction: column;
        }

        .hero-slide.is-active {
            opacity: 1;
            visibility: visible;
        }

        .hero-slide img,
        .hero-slide video {
            width: 100%;
            height: 280px;
            object-fit: cover;
            border-radius: 1.25rem;
        }

        .hero-slide figcaption {
            margin-top: 1rem;
            font-weight: 600;
            color: #0f172a;
        }

        .hero-slider__controls {
            position: absolute;
            inset: auto 1.5rem 1.5rem;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            justify-content: space-between;
            pointer-events: none;
        }

        .hero-slider__buttons {
            display: flex;
            gap: 0.5rem;
            pointer-events: auto;
        }

        .hero-slider__buttons button {
            width: 44px;
            height: 44px;
            border-radius: 999px;
            border: none;
            background: rgba(15, 23, 42, 0.75);
            color: #fff;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background 0.2s ease;
        }

        .hero-slider__buttons button:hover {
            background: rgba(15, 23, 42, 0.95);
        }

        .hero-slider__dots {
            display: flex;
            gap: 0.35rem;
            pointer-events: auto;
        }

        .hero-slider__dot {
            width: 10px;
            height: 10px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.5);
            border: 2px solid rgba(15, 23, 42, 0.5);
            cursor: pointer;
            transition: transform 0.2s ease, background 0.2s ease;
        }

        .hero-slider__dot.is-active {
            background: #ec4899;
            transform: scale(1.15);
            border-color: rgba(236, 72, 153, 0.6);
        }

        @media (max-width: 768px) {
            .hero-slider__viewport {
                min-height: 280px;
            }

            .hero-slide img,
            .hero-slide video {
                height: 220px;
            }

            .hero-slider__controls {
                flex-direction: column;
                align-items: flex-start;
                inset: auto 1rem 1rem;
            }
        }
    </style>
@endpush

@section('content')
    @php
        // Pull hero gallery assets with graceful fallbacks
        $heroImages = collect();
        $photoUploadPath = public_path('photo-uploads');
        $imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        $videoExtensions = ['mp4', 'mov', 'webm'];
        $mediaExtensions = array_merge($imageExtensions, $videoExtensions);

        if (is_dir($photoUploadPath)) {
            try {
                $heroImages = collect(\Illuminate\Support\Facades\File::files($photoUploadPath))
                    ->filter(static function ($file) use ($mediaExtensions) {
                        return in_array(strtolower($file->getExtension()), $mediaExtensions, true);
                    })
                    ->map(static function ($file) use ($videoExtensions) {
                        $filename = $file->getFilename();
                        $baseName = pathinfo($filename, PATHINFO_FILENAME);
                        $extension = strtolower($file->getExtension());
                        $type = in_array($extension, $videoExtensions, true) ? 'video' : 'image';
                        $mime = $type === 'video'
                            ? ($extension === 'mov' ? 'video/quicktime' : 'video/' . $extension)
                            : null;

                        $caption = \Illuminate\Support\Str::of($baseName)
                            ->replace(['_', '-'], ' ')
                            ->replaceMatches('/\(.*\)/', '')
                            ->replaceMatches('/\s+/', ' ')
                            ->trim()
                            ->title()
                            ->value();

                        if ($caption === '') {
                            $caption = 'Athena community moment';
                        }

                        return [
                            'src' => asset('photo-uploads/' . rawurlencode($filename)),
                            'caption' => $caption,
                            'type' => $type,
                            'mime' => $mime,
                            'poster' => $type === 'video' ? asset('default-uploads/athena-social-hero-05.svg') : null,
                        ];
                    })
                    ->values();
            } catch (\Throwable $exception) {
                $heroImages = collect();
            }
        }

        if ($heroImages->isEmpty()) {
            $heroImages = collect([
                ['type' => 'image', 'src' => asset('default-uploads/athena-social-hero-01.svg'), 'caption' => 'Dream jobs studio check-ins'],
                ['type' => 'image', 'src' => asset('default-uploads/athena-social-hero-02.svg'), 'caption' => 'Car buying concierge wins'],
                ['type' => 'image', 'src' => asset('default-uploads/athena-social-hero-03.svg'), 'caption' => 'Trades & construction allies'],
                ['type' => 'image', 'src' => asset('default-uploads/athena-social-hero-04.svg'), 'caption' => 'Housing security celebrations'],
                ['type' => 'image', 'src' => asset('default-uploads/athena-social-hero-05.svg'), 'caption' => 'Calm wellbeing pods'],
                ['type' => 'image', 'src' => asset('default-uploads/athena-social-hero-06.svg'), 'caption' => 'Signals from every region'],
                [
                    'type' => 'video',
                    'src' => 'https://cdn.coverr.co/videos/coverr-community-care-6263/1080p.mp4',
                    'mime' => 'video/mp4',
                    'poster' => asset('default-uploads/athena-social-hero-02.svg'),
                    'caption' => 'Community care studio (video)',
                ],
                [
                    'type' => 'video',
                    'src' => 'https://cdn.coverr.co/videos/coverr-team-collaboration-3525/1080p.mp4',
                    'mime' => 'video/mp4',
                    'poster' => asset('default-uploads/athena-social-hero-03.svg'),
                    'caption' => 'Collaboration loops in motion (video)',
                ],
            ]);
        }

        $guardianBadges = [
            ['label' => 'Guardian verified', 'copy' => '24/7 moderation + care team'],
            ['label' => 'AI copilots', 'copy' => 'Tone-trained to stay respectful'],
            ['label' => 'Signal vault', 'copy' => 'Housing, money & wellbeing rituals'],
        ];

        $feedHighlights = [
            ['tag' => 'Housing', 'title' => 'Housing secure in 6 weeks', 'copy' => 'Community raised bond + landlord ally pack.'],
            ['tag' => 'Money', 'title' => 'Mentor drop-in every Thursday', 'copy' => 'Trauma-informed money clinics over audio.'],
            ['tag' => 'Trades', 'title' => 'Tradeswomen rapid channel', 'copy' => 'Bulk PPE grants + overtime safety checklists.'],
            ['tag' => 'Community', 'title' => 'Care pods stay calm', 'copy' => 'Guardians rotate so every suburb feels seen.'],
        ];

        $socialEvidence = [
            [
                'eyebrow' => 'Live signals',
                'title' => 'Athena feed stays calm & signal rich',
                'bullets' => [
                    'Mentorship loops pair lived experience with AI rituals to avoid burnout.',
                    'Community spotlights rotate weekly so more suburbs feel represented.',
                    'AI concierge auto-formats wins into sponsor-friendly snapshots.',
                ],
            ],
            [
                'eyebrow' => 'Copilots',
                'title' => 'Respectful AI is embedded in every touchpoint',
                'bullets' => [
                    'Safety railing prompts reduce bias, jargon and extractive tone.',
                    'Multi-hub briefs share context with money, housing and wellbeing teams.',
                    'Guardians review transcripts and teach models to match our boundaries.',
                ],
            ],
        ];
    @endphp

    <section class="hub-section hub-section--intro hub-section--signals-right" id="athena-social">
        <div class="container hub-section__layout">
            <div class="hub-section__content">
                <p class="section-eyebrow">Athena Social + AI</p>
                <h2 class="heading-secondary">Safe jobs, money, housing and wellbeing — fuelled by AI that speaks with respect.</h2>
                <p>
                    The social feed, moderated lounges and AI copilots operate like one nervous system. Signals move from job boards to safe housing loops,
                    sponsorship dossiers and wellbeing rituals without you repeating trauma.
                </p>

                <div class="guardian-badge-row">
                    @foreach ($guardianBadges as $badge)
                        <span class="guardian-badge">
                            <strong>{{ $badge['label'] }}</strong>
                            <span>{{ $badge['copy'] }}</span>
                        </span>
                    @endforeach
                </div>

                <div class="hub-section__signals" aria-label="Athena impact metrics">
                    <div class="hub-section__stat">
                        <span class="hub-section__stat-value">{{ number_format($stats['active_jobs']) }}</span>
                        <span class="hub-section__stat-label">roles live</span>
                    </div>
                    <div class="hub-section__stat">
                        <span class="hub-section__stat-value">{{ number_format($stats['placements']) }}</span>
                        <span class="hub-section__stat-label">placements</span>
                    </div>
                    <div class="hub-section__stat">
                        <span class="hub-section__stat-value">{{ number_format($stats['community_stories']) }}</span>
                        <span class="hub-section__stat-label">community stories</span>
                    </div>
                </div>

                <div class="hub-section__signals" aria-label="Athena hubs">
                    @foreach ($hubLabels as $label)
                        <span class="signal-pill">
                            <span class="signal-indicator is-on" aria-hidden="true"></span>
                            {{ $label }}
                        </span>
                    @endforeach
                </div>

                <div class="cta-row">
                    <a href="#cta" class="btn btn--full">Start with a free Athena account</a>
                    <a href="{{ route('home') }}#how" class="btn btn--outline">See how Athena works</a>
                </div>
            </div>

            <div class="hub-section__meta">
                <div class="hub-intro-card">
                    <p class="section-eyebrow">Community snapshots</p>
                    <div class="hero-collage hero-slider" data-slider="hero-collage">
                        <div class="hero-slider__viewport" aria-live="polite">
                            @foreach ($heroImages as $media)
                                @php
                                    $mediaType = $media['type'] ?? 'image';
                                @endphp
                                <figure
                                    class="collage-card collage-card--{{ $mediaType }} hero-slide {{ $loop->first ? 'is-active' : '' }}"
                                    data-slide="{{ $loop->index }}"
                                >
                                    @if ($mediaType === 'video')
                                        <video
                                            autoplay
                                            loop
                                            muted
                                            playsinline
                                            @if (!empty($media['poster'])) poster="{{ $media['poster'] }}" @endif
                                            aria-label="{{ $media['caption'] }}"
                                        >
                                            <source src="{{ $media['src'] }}" type="{{ $media['mime'] ?? 'video/mp4' }}">
                                        </video>
                                    @else
                                        <img src="{{ $media['src'] }}" alt="{{ $media['caption'] }}">
                                    @endif
                                    <figcaption>{{ $media['caption'] }}</figcaption>
                                </figure>
                            @endforeach
                        </div>
                        <div class="hero-slider__controls">
                            <div class="hero-slider__buttons" aria-label="Snapshot navigation">
                                <button type="button" class="hero-slider__btn" data-slider-prev aria-label="Previous snapshot">
                                    <i class="fas fa-arrow-left" aria-hidden="true"></i>
                                </button>
                                <button type="button" class="hero-slider__btn" data-slider-next aria-label="Next snapshot">
                                    <i class="fas fa-arrow-right" aria-hidden="true"></i>
                                </button>
                            </div>
                            <div class="hero-slider__dots" data-slider-dots aria-label="Snapshot progress"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="hub-section hub-section--alt hub-section--signals-left" id="guardians">
        <div class="container hub-section__layout">
            <div class="hub-section__content hub-section__content--padded">
                <p class="section-eyebrow">Guardians + Copilots</p>
                <h2 class="heading-secondary">The social feed behaves exactly like your dashboard</h2>
                <p>
                    Every share, referral and AI brief respects the same rituals as the main dashboard experience. Guardians, trauma-informed moderators and
                    respectful AI copilots keep tone, context and safety aligned so you can move faster without oversharing.
                </p>
                <ul class="hub-section__list">
                    <li>Auto-summarised wins ready for sponsors, councils and grant partners.</li>
                    <li>Cross-hub visibility so housing, money and employment stay in sync.</li>
                    <li>Guardian nudges, calm defaults and privacy controls on every post.</li>
                </ul>
            </div>

            <div class="hub-section__meta">
                @foreach ($socialEvidence as $block)
                    <article class="insight-card">
                        <p class="section-eyebrow">{{ $block['eyebrow'] }}</p>
                        <h3 class="heading-tertiary">{{ $block['title'] }}</h3>
                        <ul class="auth-highlights">
                            @foreach ($block['bullets'] as $bullet)
                                <li>{{ $bullet }}</li>
                            @endforeach
                        </ul>
                    </article>
                @endforeach
            </div>
        </div>
    </section>

    <section class="hub-section hub-section--signals-right" id="live-signals">
        <div class="container hub-section__layout">
            <div class="hub-section__content">
                <p class="section-eyebrow">Live wins</p>
                <h2 class="heading-secondary">Signals already flowing through the dashboard</h2>
                <p>
                    Each highlight shows how fast a signal can travel once it enters the social feed – from local housing allies to rapid trades alerts and calm
                    community updates ready for sponsors.
                </p>
                <div class="dashboard-card-grid feed-highlight-grid" role="list">
                    @foreach ($feedHighlights as $highlight)
                        <article class="feed-highlight-card" role="listitem">
                            <p class="feed-highlight-card__eyebrow">{{ $highlight['tag'] }}</p>
                            <p class="feed-highlight-card__title">{{ $highlight['title'] }}</p>
                            <p class="feed-highlight-card__copy">{{ $highlight['copy'] }}</p>
                        </article>
                    @endforeach
                </div>
            </div>

            <div class="hub-section__meta">
                <div class="hub-intro-card">
                    <p class="section-eyebrow">Explore Athena</p>
                    <h3 class="heading-tertiary">See the full social + AI system in action</h3>
                    <p>
                        Dive into the hubs, social feed prototypes and AI copilots from your dashboard, or return to the
                        <a href="{{ route('home') }}">Athena home</a> to compare every ecosystem.
                    </p>
                    <div class="cta-row">
                        <a href="{{ route('register') }}" class="btn btn--full">Create your free account</a>
                        <a href="{{ route('home') }}#how" class="btn btn--outline">See how Athena works</a>
                    </div>
                </div>
            </div>
        </div>
    </section>
@endsection

@push('scripts')
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            const slider = document.querySelector('[data-slider="hero-collage"]');
            if (!slider) {
                return;
            }

            const slides = Array.from(slider.querySelectorAll('[data-slide]'));
            if (slides.length <= 1) {
                return;
            }

            const prevButton = slider.querySelector('[data-slider-prev]');
            const nextButton = slider.querySelector('[data-slider-next]');
            const dotsContainer = slider.querySelector('[data-slider-dots]');
            const AUTO_INTERVAL = 5000;
            let activeIndex = slides.findIndex((slide) => slide.classList.contains('is-active'));
            if (activeIndex < 0) {
                activeIndex = 0;
                slides[0].classList.add('is-active');
            }
            let intervalId = null;

            const dots = slides.map((slide, index) => {
                if (!dotsContainer) {
                    return null;
                }

                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'hero-slider__dot' + (index === activeIndex ? ' is-active' : '');
                dot.setAttribute('aria-label', `Show snapshot ${index + 1}`);
                dot.addEventListener('click', function () {
                    stopAutoRotate();
                    activateSlide(index);
                    startAutoRotate();
                });
                dotsContainer.appendChild(dot);
                return dot;
            });

            function activateSlide(nextIndex) {
                activeIndex = (nextIndex + slides.length) % slides.length;
                slides.forEach((slide, index) => {
                    slide.classList.toggle('is-active', index === activeIndex);
                });
                dots.forEach((dot, index) => {
                    if (!dot) {
                        return;
                    }
                    dot.classList.toggle('is-active', index === activeIndex);
                });
            }

            function startAutoRotate() {
                stopAutoRotate();
                intervalId = window.setInterval(() => activateSlide(activeIndex + 1), AUTO_INTERVAL);
            }

            function stopAutoRotate() {
                if (intervalId) {
                    window.clearInterval(intervalId);
                    intervalId = null;
                }
            }

            prevButton?.addEventListener('click', () => {
                stopAutoRotate();
                activateSlide(activeIndex - 1);
                startAutoRotate();
            });

            nextButton?.addEventListener('click', () => {
                stopAutoRotate();
                activateSlide(activeIndex + 1);
                startAutoRotate();
            });

            slider.addEventListener('mouseenter', stopAutoRotate);
            slider.addEventListener('mouseleave', startAutoRotate);
            slider.addEventListener('focusin', stopAutoRotate);
            slider.addEventListener('focusout', startAutoRotate);

            startAutoRotate();
        });
    </script>
@endpush
