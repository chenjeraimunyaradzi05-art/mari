@extends('layouts.app')

@section('navigation')
    <div aria-hidden="true" class="hidden"></div>
@endsection

@section('suppress-welcome-card')
    1
@endsection

@php
    use App\Support\AiConcierge;
    use Illuminate\Support\Arr;
    use Illuminate\Support\Str;

    $stringListKeys = ['focus', 'actions', 'themes', 'recommendations', 'alerts'];
    $collectionKeys = [
        'personas', 'programs', 'opportunities', 'milestones', 'mentorships',
        'interviews', 'upcoming', 'listings', 'learning_paths', 'enrolments', 'audits',
        'events', 'workshops', 'loans', 'recent_activity', 'engagements', 'caseload',
    ];
@endphp

@push('styles')
    <link rel="stylesheet" href="{{ asset('css/dashboard-role.css') }}">
@endpush

@section('content')
    @php
        $roleLabel = Str::headline($dashboard->role);
        $widgets = collect($dashboard->widgets ?? []);
        $heroCopy = $dashboard->description
            ?? 'Athena keeps every role dashboard grounded in respectful telemetry so women can move from insight to support without repeating their story.';
        $conciergeContexts = AiConcierge::contexts();
        $conciergeButtons = collect([
            'money-budgeting-education',
            'housing-mortgage-education',
            'business-legal-foundations',
            'wellbeing-fitness',
            'women-marketplace',
        ])->map(function (string $contextKey) use ($conciergeContexts) {
            $meta = $conciergeContexts[$contextKey] ?? null;

            if (!$meta) {
                return null;
            }

            return [
                'context' => $contextKey,
                'badge' => $meta['badge'] ?? Str::headline(str_replace('-', ' ', $contextKey)),
                'title' => $meta['title'] ?? Str::headline(str_replace('-', ' ', $contextKey)),
                'summary' => $meta['summary'] ?? $meta['guardrails'] ?? null,
            ];
        })->filter()->values();
    @endphp

    <div class="role-shell">
        <div class="sr-only">
            <h1>{{ $roleLabel }} Dashboard</h1>
            <p>Role: {{ $roleLabel }}</p>
        </div>

        <section class="concierge-section">
            <div class="concierge-grid">
                <div>
                    <span class="role-label">{{ $roleLabel }} Role Dashboard</span>
                    <h2 class="role-title">{{ $dashboard->title }}</h2>
                    <p class="role-copy">{{ $heroCopy }}</p>
                    <p class="concierge-helper">Pick a concierge lane to launch Athena tuned to that topic, or scroll down for live widgets.</p>
                </div>
                @if($conciergeButtons->isNotEmpty())
                    <div class="concierge-button-grid" aria-label="Concierge quick links">
                        @foreach($conciergeButtons as $button)
                            <a href="{{ route('ai.concierge', ['context' => $button['context']]) }}" class="concierge-button">
                                <span class="concierge-button__badge">{{ $button['badge'] }}</span>
                                <span class="concierge-button__title">{{ $button['title'] }}</span>
                                @if(!empty($button['summary']))
                                    <span class="concierge-button__summary">{{ Str::limit($button['summary'], 80) }}</span>
                                @endif
                            </a>
                        @endforeach
                    </div>
                @endif
            </div>
        </section>

        <section class="widgets-section" id="role-widgets">
            <div class="widgets-header">
                <div>
                    <p class="role-label">{{ $roleLabel }} telemetry</p>
                    <h2 class="role-title" style="font-size: 2rem; margin-bottom: 0.5rem;">Live instruments for {{ Str::lower($roleLabel) }} teams</h2>
                    <p style="color:#475569; max-width:620px; line-height: 1.6;">Each widget is wired for shareable briefs, Flare telemetry, and cross-hub rituals so squads can move from signal to care without repetitive paperwork.</p>
                </div>
                <div class="widgets-header__meta">
                    <span class="meta-pill">Cache {{ $dashboard->cacheTtl }}s</span>
                    @if($dashboard->featureFlag)
                        <span class="meta-pill">{{ $dashboard->featureFlag }}</span>
                    @endif
                    @if(!empty($dashboard->meta['design_reference']))
                        <a class="meta-pill" href="{{ $dashboard->meta['design_reference'] }}" target="_blank" rel="noreferrer">Design reference</a>
                    @endif
                </div>
            </div>

            @if($widgets->isEmpty())
                <div class="empty-state">
                    <p><strong>No widgets configured yet.</strong></p>
                    <p>Update config/dashboard_roles.php to stream data into this role.</p>
                </div>
            @else
                <div class="widget-grid">
                    @foreach($widgets as $widget)
                        @php
                            $payload = $widget->toArray();
                            $widgetKey = $widget->widgetKey();
                            $title = Str::headline(str_replace(['_', '-'], ' ', $widgetKey));
                            $updatedAt = Arr::get($payload, 'updated_at') ?? Arr::get($payload, 'updatedAt');
                            $signals = collect($payload['signals'] ?? [])->filter(fn ($value) => ! is_array($value));
                            $ctaButtons = [];

                            if (isset($payload['cta'])) {
                                $ctaButtons[] = $payload['cta'];
                            }

                            if (isset($payload['primary_cta'])) {
                                $ctaButtons[] = $payload['primary_cta'];
                            }

                            if (isset($payload['ctas']) && is_array($payload['ctas'])) {
                                foreach ($payload['ctas'] as $label => $url) {
                                    $ctaButtons[] = [
                                        'label' => Str::headline(str_replace('_', ' ', (string) $label)),
                                        'url' => $url,
                                    ];
                                }
                            }
                        @endphp

                        <article class="widget-card" id="widget-{{ Str::slug($widgetKey) }}">
                            <header class="widget-card__header">
                                <div>
                                    <p class="widget-card__eyebrow">{{ Str::upper(str_replace('-', ' ', $widgetKey)) }}</p>
                                    <h3 class="widget-card__title">{{ $title }}</h3>
                                    @if(!empty($payload['summary']))
                                        <p style="color:#475569; margin-top:0.5rem; line-height: 1.5;">{{ $payload['summary'] }}</p>
                                    @endif
                                    @if($updatedAt)
                                        <p style="color:#94a3b8; font-size:0.8rem; margin-top: 0.5rem;">Updated {{ $updatedAt }}</p>
                                    @endif
                                </div>
                                <span class="widget-card__badge">{{ class_basename($widget) }}</span>
                            </header>

                            @if(!empty($payload['metrics']) && is_array($payload['metrics']))
                                <div class="metric-grid">
                                    @foreach($payload['metrics'] as $metricKey => $metricValue)
                                        @php
                                            $metric = is_array($metricValue) ? $metricValue : ['value' => $metricValue];
                                            $metricLabel = $metric['label'] ?? (is_string($metricKey) ? Str::headline(str_replace('_', ' ', (string) $metricKey)) : 'Metric');
                                            $metricValueDisplay = $metric['value'] ?? (is_scalar($metricValue) ? $metricValue : '—');
                                            $metricHelper = $metric['trend'] ?? $metric['helper'] ?? null;
                                        @endphp
                                        <div class="metric-card">
                                            <p class="metric-card__label">{{ $metricLabel }}</p>
                                            <p class="metric-card__value">{{ $metricValueDisplay ?? '—' }}</p>
                                            @if($metricHelper)
                                                <p class="metric-card__helper">{{ $metricHelper }}</p>
                                            @endif
                                        </div>
                                    @endforeach
                                </div>
                            @endif

                            @if($signals->isNotEmpty())
                                <div class="signal-grid" aria-label="Widget signals">
                                    @foreach($signals as $signalKey => $signalValue)
                                        <span class="signal-pill">
                                            <span class="signal-dot"></span>
                                            {{ Str::headline(str_replace('_', ' ', (string) $signalKey)) }} · {{ $signalValue ?? '—' }}
                                        </span>
                                    @endforeach
                                </div>
                            @endif

                            @foreach($stringListKeys as $listKey)
                                @php
                                    $listItems = collect(Arr::get($payload, $listKey, []))
                                        ->filter()
                                        ->map(fn ($item) => is_array($item) ? Arr::first($item) : $item)
                                        ->take(4);
                                @endphp
                                @if($listItems->isNotEmpty())
                                    <div class="tag-stack" aria-label="{{ Str::headline(str_replace('_', ' ', $listKey)) }}">
                                        @foreach($listItems as $item)
                                            <span class="tag-pill">{{ Str::headline(str_replace('_', ' ', $listKey)) }}: {{ $item }}</span>
                                        @endforeach
                                    </div>
                                @endif
                            @endforeach

                            @foreach($collectionKeys as $collectionKey)
                                @php
                                    $items = collect(Arr::get($payload, $collectionKey, []))
                                        ->filter()
                                        ->take(3);
                                @endphp
                                @if($items->isNotEmpty())
                                    <div>
                                        <p class="role-label" style="color:#3f1f75; margin-bottom: 0.5rem;">{{ Str::headline(str_replace('_', ' ', $collectionKey)) }}</p>
                                        <div class="collection-grid">
                                            @foreach($items as $item)
                                                @php
                                                    $label = is_array($item)
                                                        ? (Arr::get($item, 'title')
                                                            ?? Arr::get($item, 'label')
                                                            ?? Arr::get($item, 'name')
                                                            ?? Arr::get($item, 'id')
                                                            ?? 'Entry')
                                                        : Str::limit((string) $item, 80);
                                                    $details = is_array($item)
                                                        ? collect($item)
                                                            ->except(['id', 'title', 'label', 'name', 'link', 'url', 'cta'])
                                                            ->filter(fn ($value) => is_scalar($value) && trim((string) $value) !== '')
                                                            ->take(2)
                                                            ->map(fn ($value, $key) => Str::headline(str_replace('_', ' ', (string) $key)).': '.$value)
                                                            ->implode(' • ')
                                                        : null;
                                                @endphp
                                                <div class="collection-card">
                                                    <p class="collection-card__title">{{ $label }}</p>
                                                    @if($details)
                                                        <p class="collection-card__details">{{ $details }}</p>
                                                    @endif
                                                </div>
                                            @endforeach
                                        </div>
                                    </div>
                                @endif
                            @endforeach

                            @if($ctaButtons)
                                @php $primaryCta = true; @endphp
                                <div class="widget-cta">
                                    @foreach($ctaButtons as $cta)
                                        @if(!empty($cta['url']))
                                            <a href="{{ $cta['url'] }}" class="{{ $primaryCta ? '' : 'widget-cta__ghost' }}" target="_blank" rel="noreferrer">
                                                {{ $cta['label'] ?? 'Open' }}
                                            </a>
                                            @php $primaryCta = false; @endphp
                                        @endif
                                    @endforeach
                                </div>
                            @endif
                        </article>
                    @endforeach
                </div>
            @endif
        </section>
    </div>
@endsection
