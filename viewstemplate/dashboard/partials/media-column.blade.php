@php
    $contextLabel = $context ?? 'partner slot';
    $contextLabel = \Illuminate\Support\Str::of(str_replace('_', ' ', (string) $contextLabel))->headline();
    $placement = $placement ?? null;
    $analytics = data_get($placement, 'analytics', []);
    $media = data_get($placement, 'media', []);
    $targeting = data_get($placement, 'targeting', []);
@endphp

<aside class="dashboard-media-column" aria-live="polite" data-context="{{ $context ?? 'default' }}">
    @if ($placement)
        <header class="dashboard-media-column__header">
            <p class="dashboard-eyebrow">{{ $placement['label'] ?? __('Partner spotlight') }}</p>
            <h3 class="dashboard-media-column__title">{{ $placement['headline'] ?? __('Partner activation') }}</h3>
            @if (! empty($placement['copy']))
                <p class="dashboard-media-column__copy">{{ $placement['copy'] }}</p>
            @endif
        </header>

        <div class="dashboard-media-brand">
            @if (! empty($placement['brand_logo']))
                <img class="dashboard-media-brand__logo" src="{{ $placement['brand_logo'] }}" alt="{{ $placement['brand'] ?? __('Partner logo') }}">
            @endif
            <div>
                <p class="dashboard-media-brand__name">{{ $placement['brand'] ?? __('Athena partner') }}</p>
                @if (! empty($placement['objective']))
                    <p class="dashboard-media-brand__meta">{{ $placement['objective'] }}</p>
                @endif
            </div>
        </div>

        @if (! empty(data_get($media, 'video.src')))
            <div class="dashboard-media-player">
                <video controls playsinline poster="{{ data_get($media, 'video.poster') }}">
                    <source src="{{ data_get($media, 'video.src') }}" type="video/mp4">
                </video>
                @if ($caption = data_get($media, 'video.caption'))
                    <p class="dashboard-media-caption">{{ $caption }}</p>
                @endif
            </div>
        @endif

        @if (! empty(data_get($media, 'slides', [])))
            <div class="dashboard-media-carousel" role="region" aria-label="{{ __('Creative previews') }}">
                @foreach (data_get($media, 'slides', []) as $slide)
                    <figure class="dashboard-media-slide" role="group">
                        <img src="{{ $slide['src'] }}" alt="{{ $slide['alt'] ?? __('Creative slide') }}">
                        @if (! empty($slide['caption']))
                            <figcaption>{{ $slide['caption'] }}</figcaption>
                        @endif
                    </figure>
                @endforeach
            </div>
        @endif

        @if (! empty(data_get($media, 'audio.src')))
            <div class="dashboard-media-audio">
                <div>
                    <p class="dashboard-media-audio__title">{{ data_get($media, 'audio.title') ?? __('Audio spotlight') }}</p>
                    @if (data_get($media, 'audio.duration'))
                        <p class="dashboard-media-audio__meta">{{ data_get($media, 'audio.duration') }} · {{ __('Partner drop') }}</p>
                    @endif
                </div>
                <audio controls preload="none">
                    <source src="{{ data_get($media, 'audio.src') }}" type="audio/mpeg">
                </audio>
            </div>
        @endif

        @if (! empty($placement['badges']))
            <div class="dashboard-media-badges">
                @foreach ($placement['badges'] as $badge)
                    <span class="dashboard-media-badge">{{ $badge }}</span>
                @endforeach
            </div>
        @endif

        <div class="dashboard-media-targeting">
            <p class="dashboard-eyebrow">{{ __('Targeting focus') }}</p>
            @php
                $intentTags = (array) data_get($targeting, 'intents', []);
                $audienceTags = (array) data_get($targeting, 'audiences', []);
                $regionTags = (array) data_get($targeting, 'regions', []);
                $matchedSignals = array_filter([
                    'pathway_types' => (array) data_get($targeting, 'matched_signals.pathway_types', []),
                    'industries' => (array) data_get($targeting, 'matched_signals.industries', []),
                ]);
            @endphp
            <div class="dashboard-media-tags">
                @foreach ($intentTags as $intent)
                    <span class="tag-pill">{{ $intent }}</span>
                @endforeach
                @foreach ($audienceTags as $audience)
                    <span class="tag-pill tag-pill--outline">{{ $audience }}</span>
                @endforeach
                @foreach ($regionTags as $region)
                    <span class="tag-pill tag-pill--muted">{{ $region }}</span>
                @endforeach
            </div>
            @if (! empty($matchedSignals))
                <div class="dashboard-media-matched">
                    @foreach ($matchedSignals as $label => $values)
                        <p>
                            <span>{{ \Illuminate\Support\Str::headline(str_replace('_', ' ', $label)) }}:</span>
                            <span>{{ implode(', ', $values) }}</span>
                        </p>
                    @endforeach
                </div>
            @endif
        </div>

        <ul class="dashboard-media-analytics">
            <li>
                <span>{{ __('Impressions (30d)') }}</span>
                <strong>{{ number_format(data_get($analytics, 'impressions', 0)) }}</strong>
            </li>
            <li>
                <span>{{ __('Clicks') }}</span>
                <strong>{{ number_format(data_get($analytics, 'clicks', 0)) }}</strong>
            </li>
            <li>
                <span>{{ __('CTR') }}</span>
                <strong>{{ number_format(data_get($analytics, 'ctr', 0), 2) }}%</strong>
            </li>
            <li>
                <span>{{ __('Qualified leads') }}</span>
                <strong>{{ number_format(data_get($analytics, 'qualified_leads', 0)) }}</strong>
            </li>
            <li>
                <span>{{ __('Spend to date') }}</span>
                <strong>{{ __('A$ :value', ['value' => number_format(data_get($analytics, 'spend', 0), 2)]) }}</strong>
            </li>
        </ul>

        @if ($lastRecorded = data_get($analytics, 'last_recorded_at'))
            <p class="dashboard-media-updated">{{ __('Updated :time ago', ['time' => \Illuminate\Support\Carbon::parse($lastRecorded)->diffForHumans()]) }}</p>
        @endif

        @if (! empty(data_get($placement, 'cta.url')))
            <a class="btn btn-secondary btn-pill btn--full" href="{{ data_get($placement, 'cta.url') }}" @if (data_get($placement, 'cta.external')) target="_blank" rel="noreferrer noopener" @endif>
                {{ data_get($placement, 'cta.label', __('Learn more')) }}
            </a>
        @endif

        @if (! empty($placement['sponsor_statement']))
            <p class="dashboard-media-footnote">{{ $placement['sponsor_statement'] }}</p>
        @endif
    @else
        <div class="dashboard-media-column__placeholder">
            <p class="dashboard-eyebrow">{{ __('Partner slot') }}</p>
            <h3>{{ __('Media window reserved') }}</h3>
            <p>{{ __('We are curating a :context sponsor drop next.', ['context' => $contextLabel]) }}</p>
            <p class="dashboard-media-footnote">{{ __('Brands can preload audio, video, or carousel placements here.') }}</p>
        </div>
    @endif
</aside>
