@props(['cards' => []])

@if (! empty($cards))
    <section class="pillar-hero" aria-label="{{ __('Athena priority pillars') }}">
        <div class="pillar-hero__grid">
            @foreach ($cards as $card)
                <article class="pillar-card pillar-card--{{ $card['slug'] ?? 'default' }}">
                    <div class="pillar-card__signal">
                        <p class="pillar-card__eyebrow">{{ $card['meta'] ?? __('Evidence-based signal') }}</p>
                        @if (! empty($card['stat']))
                            <span class="pillar-card__stat">{{ $card['stat'] }}</span>
                        @endif
                    </div>
                    <h3 class="pillar-card__title">{{ $card['label'] }}</h3>
                    <p class="pillar-card__copy">{{ $card['description'] }}</p>
                    @if (! empty($card['member_metric']))
                        <p class="pillar-card__metric">
                            <span class="pillar-card__metric-value">{{ $card['member_metric']['value'] }}</span>
                            <span class="pillar-card__metric-label">{{ $card['member_metric']['label'] }}</span>
                        </p>
                    @endif
                    @if (! empty(data_get($card, 'cta.url')))
                        <a class="pillar-card__cta" href="{{ $card['cta']['url'] }}">
                            <span>{{ $card['cta']['label'] }}</span>
                            <span aria-hidden="true">→</span>
                        </a>
                    @endif
                </article>
            @endforeach
        </div>
    </section>
@endif
