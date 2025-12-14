@extends('layouts.master')

@section('title', 'Athena AI Concierge')
@section('meta_description', 'The Athena AI Concierge unites housing, money, business and wellbeing reflections with respectful guardrails.')

@section('content')
    @php
        $contextsCount = count($contexts);
        $historyEntries = $history ?? [];
        $historyCount = count($historyEntries);
        $selectionCount = !empty($contextSummary['selection']) ? count($contextSummary['selection']) : 0;
        $contextSurfaceMeta = null;
        $contextFilters = [];
        $contextGeneratedHuman = null;

        if (!empty($contextSummary)) {
            if (!empty($contextSummary['generated_at'])) {
                try {
                    $contextGeneratedHuman = \Carbon\Carbon::parse($contextSummary['generated_at'])->diffForHumans();
                } catch (\Exception $e) {
                    $contextGeneratedHuman = $contextSummary['generated_at'];
                }
            }

            $contextSurfaceMeta = match ($contextSummary['surface'] ?? null) {
                'housing_dashboard' => [
                    'label' => 'Housing snapshot',
                    'noun' => 'housing options',
                    'filters_label' => 'Housing filters',
                    'origin_label' => 'housing dashboard',
                ],
                'business_dashboard' => [
                    'label' => 'Business snapshot',
                    'noun' => 'milestones',
                    'filters_label' => 'Business filters',
                    'origin_label' => 'business workspace',
                ],
                default => [
                    'label' => 'Money snapshot',
                    'noun' => 'transactions',
                    'filters_label' => 'Money filters',
                    'origin_label' => 'bank feed',
                ],
            };
            $contextFilters = $contextSummary['filters'] ?? [];
        }
    @endphp

    <section class="hub-section hub-section--intro hub-section--signals-right ai-concierge-hero" id="ai-concierge">
        <div class="container hub-section__layout">
            <div class="hub-section__content">
                <p class="section-eyebrow">Athena AI Concierge</p>
                <h2 class="heading-secondary">One calm surface for money, housing, business and wellbeing reflections.</h2>
                <p>
                    Bring any dashboard context into this page, collect the guardrails you need and send kinder prompts back to the hub you came from.
                    Everything stays educational, verified and ready for guardians to review.
                </p>
                <div class="hub-section__signals" aria-label="AI concierge metrics">
                    <div class="hub-section__stat">
                        <span class="hub-section__stat-value">{{ $contextsCount }}</span>
                        <span class="hub-section__stat-label">active contexts</span>
                    </div>
                    <div class="hub-section__stat">
                        <span class="hub-section__stat-value">{{ $historyCount }}</span>
                        <span class="hub-section__stat-label">recent payloads</span>
                    </div>
                    <div class="hub-section__stat">
                        <span class="hub-section__stat-value">{{ $selectionCount }}</span>
                        <span class="hub-section__stat-label">items in focus</span>
                    </div>
                </div>
                <div class="cta-row">
                    <a class="btn btn--full" href="#ai-contexts">Review guardrails</a>
                    <a class="btn btn--outline" href="{{ route('home') }}">Return home</a>
                </div>
            </div>

            <div class="hub-section__meta ai-concierge-hero__card">
                <p class="section-eyebrow">Why it matters</p>
                <ul>
                    <li>Every context mirrors your dashboard guardrails.</li>
                    <li>Signals jump between money, housing and wellbeing without retyping trauma.</li>
                    <li>Guardian review and AI rituals keep tone safe, shame-free and transparent.</li>
                </ul>
                <p class="ai-concierge-hero__footnote">Hover near the top edge to peek the navigation bar whenever you need it.</p>
            </div>
        </div>
    </section>

    @if($contextSurfaceMeta)
        <section class="section-shell ai-context-summary" id="ai-context-summary">
            <div class="section-text">
                <p class="section-eyebrow">{{ $contextSurfaceMeta['label'] }}</p>
                <h2 class="heading-tertiary">Athena remembers {{ $contextSummary['selection_total'] }} {{ $contextSurfaceMeta['noun'] }}</h2>
                <p>
                    Context token <span class="ai-context-token">{{ $contextSummary['token'] ?? 'n/a' }}</span> generated
                    {{ $contextGeneratedHuman ?? 'moments ago' }} from your {{ $contextSurfaceMeta['origin_label'] }}.
                    The highlights below are the first {{ min($selectionCount, $contextSummary['selection_total']) }} entries we pinned.
                </p>
            </div>
            <div class="section-media ai-context-summary__meta">
                <article class="ai-context-panel">
                    <p class="section-eyebrow">{{ $contextSurfaceMeta['filters_label'] }}</p>
                    @if(empty($contextFilters))
                        <p>No filters captured for this snapshot.</p>
                    @else
                        <ul>
                            @foreach($contextFilters as $key => $value)
                                <li>
                                    <strong>{{ \Illuminate\Support\Str::headline($key) }}:</strong>
                                    <span>
                                        @if(is_array($value))
                                            {{ implode(', ', array_map('strval', $value)) }}
                                        @else
                                            {{ $value }}
                                        @endif
                                    </span>
                                </li>
                            @endforeach
                        </ul>
                    @endif
                </article>
            </div>

            <div class="ai-context-preview" aria-label="Context preview entries">
                @forelse($contextSummary['selection'] as $entry)
                    @php
                        $amount = $entry['amount'] ?? 0;
                        $direction = $entry['direction'] ?? null;
                        $isCredit = $direction === 'credit';
                        $sign = $isCredit ? '+' : '-';
                        $formatted = is_numeric($amount) ? number_format(abs($amount), 2) : '0.00';
                    @endphp
                    <article class="ai-context-preview__card">
                        <header>
                            <p class="ai-context-preview__title">{{ $entry['description'] }}</p>
                            <p class="ai-context-preview__amount {{ $isCredit ? 'is-credit' : 'is-debit' }}">{{ $sign }}${{ $formatted }}</p>
                        </header>
                        <ul>
                            @if(!empty($entry['account']))
                                <li>{{ $entry['account'] }}</li>
                            @endif
                            <li>Status: {{ ucfirst($entry['status'] ?? 'pending') }}</li>
                            @if(!empty($entry['category']))
                                <li>Category: {{ $entry['category'] }}</li>
                            @endif
                            @if(!empty($entry['flagged']))
                                <li>Flagged for review</li>
                            @endif
                            <li>{{ $entry['posted_at'] ?? 'Date pending' }}</li>
                        </ul>
                        @if(!empty($entry['ai_suggestions']))
                            <div class="ai-context-preview__pills">
                                @foreach($entry['ai_suggestions'] as $suggestion)
                                    <span>{{ $suggestion }}</span>
                                @endforeach
                            </div>
                        @endif
                    </article>
                @empty
                    <article class="ai-context-preview__card">
                        <p>No preview entries were stored with this payload.</p>
                    </article>
                @endforelse
            </div>
        </section>
    @endif

    @if(!empty($requestedPrompt))
        <section class="section-shell ai-concierge-prompt" id="ai-prompt">
            <div class="section-text">
                <p class="section-eyebrow">Suggested prompt</p>
                <h2 class="heading-tertiary">Ready-made reflection you can tweak</h2>
                <p>Copy this into any dashboard launcher or adjust the language before sending it to Athena.</p>
            </div>
            <div class="section-media">
                <div class="ai-concierge-prompt__card">
                    <pre>{{ $requestedPrompt }}</pre>
                    <button type="button" class="btn btn--outline ai-concierge-copy" data-copy-payload="{{ $requestedPrompt }}">Copy prompt</button>
                </div>
            </div>
        </section>
    @endif

    @if(!empty($historyEntries))
        <section class="section-shell ai-context-history" id="ai-history">
            <div class="section-text">
                <p class="section-eyebrow">Recent AI contexts</p>
                <h2 class="heading-tertiary">Pick up where you left off</h2>
                <p>Stored securely inside Athena. Re-open any payload without leaving this page or copy the raw context token for a teammate.</p>
            </div>
            <div class="section-media ai-context-history__list">
                @foreach($historyEntries as $entry)
                    @php
                        $historySurfaceMeta = match ($entry['surface'] ?? null) {
                            'housing_dashboard' => [
                                'label' => 'Housing snapshot',
                                'noun' => 'housing options',
                            ],
                            'business_dashboard' => [
                                'label' => 'Business snapshot',
                                'noun' => 'milestones',
                            ],
                            default => [
                                'label' => 'Money snapshot',
                                'noun' => 'transactions',
                            ],
                        };
                        $historyFilters = $entry['filters'] ?? [];
                        $historyFiltersSummary = empty($historyFilters)
                            ? 'No filters captured'
                            : collect($historyFilters)
                                ->map(fn ($value, $key) => sprintf('%s: %s', \Illuminate\Support\Str::headline($key), is_array($value) ? implode(', ', array_map('strval', $value)) : (string) $value))
                                ->implode(' • ');
                        $selectionPreview = $entry['selection_preview'] ?? [];
                    @endphp
                    <article class="ai-context-history__card">
                        <header>
                            <div>
                                <p class="section-eyebrow">{{ $historySurfaceMeta['label'] }}</p>
                                <h3>Selection of {{ $entry['selection_total'] }} {{ $historySurfaceMeta['noun'] }}</h3>
                                <p>{{ $historyFiltersSummary }}</p>
                            </div>
                            <div class="ai-context-history__chip">{{ $entry['context_key'] ?? 'context' }}</div>
                        </header>
                        @if(!empty($selectionPreview))
                            <ul class="ai-context-history__preview">
                                @foreach($selectionPreview as $preview)
                                    <li>
                                        <strong>{{ $preview['description'] ?? 'Selection entry' }}</strong>
                                        @if(!empty($preview['account']))
                                            <span>{{ $preview['account'] }}</span>
                                        @endif
                                        @if(!empty($preview['posted_at']))
                                            <span>{{ $preview['posted_at'] }}</span>
                                        @endif
                                    </li>
                                @endforeach
                            </ul>
                        @endif
                        @if(!empty($entry['prompt']))
                            <p class="ai-context-history__prompt"><strong>Prompt:</strong> {{ $entry['prompt'] }}</p>
                        @endif
                        <div class="ai-context-history__actions">
                            <a class="btn btn--full" href="{{ $entry['resume_url'] }}">Re-open in concierge</a>
                            @if(!empty($entry['context_payload']))
                                <button type="button" class="btn btn--outline" data-copy-payload="{{ $entry['context_payload'] }}">Copy payload</button>
                            @endif
                        </div>
                    </article>
                @endforeach
            </div>
        </section>
    @endif

    <section class="section-shell ai-context-catalog" id="ai-contexts">
        <div class="section-text">
            <p class="section-eyebrow">Available contexts</p>
            <h2 class="heading-tertiary">Guardrails for every workspace</h2>
            <p>Each context shares the educational guardrails Athena enforces inside your dashboards. Use them before you brief a coach, guardian or lender.</p>
        </div>
        <div class="section-media ai-context-catalog__list">
            @foreach($contexts as $key => $meta)
                @php $isActive = isset($requestedContext) && $requestedContext === $key; @endphp
                <article class="ai-context-card {{ $isActive ? 'is-active' : '' }}">
                    <div class="ai-context-card__eyebrow">{{ $key }}</div>
                    <h3>{{ $meta['title'] }}</h3>
                    <p>{{ $meta['guardrails'] }}</p>
                    <div class="ai-context-card__prompt">
                        <span>Starter prompt</span>
                        <p>{{ $meta['placeholder'] }}</p>
                    </div>
                    @if($isActive && $contextSurfaceMeta)
                        <p class="ai-context-card__badge">Live context from your {{ $contextSurfaceMeta['origin_label'] }}</p>
                    @endif
                </article>
            @endforeach
        </div>
        <p class="ai-context-catalog__note">Need another domain? Tap any AI launcher inside housing, business, grants, or wellbeing—each ships with sibling guardrails.</p>
    </section>
@endsection

@push('scripts')
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            document.body.classList.add('ai-concierge-page');
        });

        document.addEventListener('click', (event) => {
            const copyTrigger = event.target.closest('[data-copy-payload]');
            if (!copyTrigger) {
                return;
            }

            event.preventDefault();

            const payload = copyTrigger.getAttribute('data-copy-payload');
            if (!payload || !navigator.clipboard) {
                return;
            }

            const originalLabel = copyTrigger.textContent.trim();
            navigator.clipboard.writeText(payload)
                .then(() => {
                    copyTrigger.textContent = 'Copied!';
                    setTimeout(() => {
                        copyTrigger.textContent = originalLabel;
                    }, 1600);
                })
                .catch(() => {
                    copyTrigger.textContent = 'Copy failed';
                    setTimeout(() => {
                        copyTrigger.textContent = originalLabel;
                    }, 1600);
                });
        });
    </script>
@endpush
