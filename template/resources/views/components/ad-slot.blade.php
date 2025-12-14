@props([
    'ads' => [],
    'position' => '',
    'layout' => 'card',
])

@php
    $adCollection = collect($ads ?: []);
@endphp

@if ($adCollection->isNotEmpty())
    <div class="ad-slot ad-slot--{{ $position }} ad-slot--{{ $layout }}" data-slot="{{ $position }}">
        <div class="ad-carousel" data-position="{{ $position }}">
            @foreach ($adCollection as $index => $ad)
                @php
                    $type = $ad['type'] ?? 'image';
                    $isVideo = $type === 'video';
                    $label = $ad['label'] ?? null;
                    $title = $ad['title'] ?? null;
                    $description = $ad['description'] ?? null;
                    $ctaUrl = $ad['cta_url'] ?? null;
                    $ctaText = $ad['cta_text'] ?? null;
                    $external = (bool) ($ad['external'] ?? false);
                    $metrics = $ad['metrics'] ?? null;
                @endphp

                <article
                    class="ad-card"
                    data-type="{{ $type }}"
                    data-index="{{ $index }}"
                    @if ($metrics)
                        @if(isset($metrics['creative_id']))
                            data-creative="{{ $metrics['creative_id'] }}"
                        @endif
                        @if(isset($metrics['campaign_id']))
                            data-campaign="{{ $metrics['campaign_id'] }}"
                        @endif
                        @if(isset($metrics['company_id']))
                            data-company="{{ $metrics['company_id'] }}"
                        @endif
                        data-slot="{{ $metrics['slot'] ?? $position }}"
                        @if(isset($metrics['signature']))
                            data-signature="{{ $metrics['signature'] }}"
                        @endif
                    @endif
                >
                    <div class="ad-media">
                        @if ($isVideo)
                            <video
                                class="ad-video"
                                src="{{ $ad['url'] ?? '' }}"
                                poster="{{ $ad['poster'] ?? '' }}"
                                muted
                                playsinline
                                loop
                                @if ($loop->first)
                                    autoplay
                                @endif
                            ></video>
                        @else
                            <img
                                class="ad-image"
                                src="{{ $ad['url'] ?? '' }}"
                                alt="{{ $ad['alt'] ?? ($ad['title'] ?? 'Sponsored placement') }}"
                            />
                        @endif
                    </div>

                    <div class="ad-body">
                        @if ($label)
                            <p class="ad-label">{{ $label }}</p>
                        @endif
                        @if ($title)
                            <h3 class="ad-title">{{ $title }}</h3>
                        @endif
                        @if ($description)
                            <p class="ad-description">{{ $description }}</p>
                        @endif

                        @if ($ctaUrl && $ctaText)
                            <a
                                href="{{ $ctaUrl }}"
                                class="btn btn--outline ad-cta"
                                data-track-click="{{ $metrics ? 'true' : 'false' }}"
                                @if ($external)
                                    target="_blank"
                                    rel="noopener"
                                @endif
                            >
                                {{ $ctaText }}
                            </a>
                        @endif
                    </div>
                </article>
            @endforeach
        </div>

    </div>
@endif
