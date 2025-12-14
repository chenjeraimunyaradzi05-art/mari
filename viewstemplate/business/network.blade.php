@extends('frontend.layouts.master')

@section('contents')
@php
    $experienceChips = [
        'Women’s work',
        'Money',
        'Housing',
        'Wellbeing',
    ];

    $aiContexts = [
        [
            'label' => 'Money',
            'title' => 'Money calm coach',
            'copy' => 'Budgeting, relief funding, and respectful planning prompts.',
            'context' => 'money-budgeting-education',
        ],
        [
            'label' => 'Housing',
            'title' => 'Housing & mortgage explainer',
            'copy' => 'Safe leases, relocation checklists, and trauma-aware finance tips.',
            'context' => 'housing-mortgage-education',
        ],
        [
            'label' => 'Legal',
            'title' => 'Business & legal foundations',
            'copy' => 'Co-founder agreements, procurement compliance, and templates.',
            'context' => 'business-legal-foundations',
        ],
        [
            'label' => 'Wellness',
            'title' => 'Wellbeing & Vipassana reflections',
            'copy' => 'Burnout decompression and nervous system resets on demand.',
            'context' => 'wellbeing-fitness',
        ],
        [
            'label' => 'Marketplace',
            'title' => 'Marketplace concierge',
            'copy' => 'Matches you with suppliers, grants, and mentors in one ask.',
            'context' => 'women-marketplace',
        ],
    ];

    $aiEntryRoute = config('app.platform.ai_entry_route', 'ai.concierge');
    $aiEntryUrl = \Illuminate\Support\Facades\Route::has($aiEntryRoute) ? route($aiEntryRoute) : url('/ai');

    $pillarHighlights = [
        [
            'label' => 'Capital readiness',
            'copy' => 'Grant playbooks, VC office hours, and AI-reviewed decks keep every pitch room calm.',
        ],
        [
            'label' => 'Distribution',
            'copy' => 'Supplier directories, procurement sprints, and co-selling pods unlock new revenue lanes.',
        ],
        [
            'label' => 'Community heat',
            'copy' => 'Earned media templates, social boosts, and spotlight reels celebrate every milestone.',
        ],
        [
            'label' => 'Mentor hour',
            'copy' => 'Concierge matching with women GPs, operators, and creatives for the exact moment you need help.',
        ],
    ];

    $resourceCount = $resources->count();
    $tagCount = count($trendingTags);

    $docLinks = [
        ['label' => 'Charter', 'url' => route('athena.social', [], false).'#charter'],
        ['label' => 'Problem Map', 'url' => route('home').'#impact'],
        ['label' => 'Dream Pathways', 'url' => route('home').'#dream-pathways'],
        ['label' => 'Outcomes', 'url' => route('home').'#outcomes'],
    ];

    $sponsorAds = collect(config('advertising.frontend_preview', []))
        ->map(function ($ad) {
            $media = $ad['media'] ?? null;
            $url = $ad['url'] ?? null;
            if (! $url && $media) {
                $url = asset($media);
            } elseif ($url && ! \Illuminate\Support\Str::startsWith($url, ['http://', 'https://', '/'])) {
                $url = asset($url);
            } elseif ($url && \Illuminate\Support\Str::startsWith($url, '/')) {
                $url = url($url);
            }

            $ctaUrl = $ad['cta_url'] ?? null;
            if (! $ctaUrl && ! empty($ad['cta_route']) && \Illuminate\Support\Facades\Route::has($ad['cta_route'])) {
                $ctaUrl = route($ad['cta_route']);
            } elseif ($ctaUrl && ! \Illuminate\Support\Str::startsWith($ctaUrl, ['http://', 'https://'])) {
                $ctaUrl = url($ctaUrl);
            }

            return [
                'type' => $ad['type'] ?? 'image',
                'url' => $url,
                'label' => $ad['label'] ?? 'Sponsor spotlight',
                'title' => $ad['title'] ?? null,
                'description' => $ad['description'] ?? null,
                'cta_text' => $ad['cta_text'] ?? null,
                'cta_url' => $ctaUrl,
                'external' => (bool) ($ad['external'] ?? false),
            ];
        })
        ->filter(fn ($ad) => ! empty($ad['url']) && ! empty($ad['title']))
        ->values();
@endphp

<section class="network-landing-hero" aria-labelledby="network-landing-heading">
    <div class="network-landing-hero__content">
        <p class="network-eyebrow">For women’s work, money, housing, and wellbeing.</p>
        <h1 id="network-landing-heading">Business Network · Athena Social</h1>
        <p class="network-landing-hero__copy">
            Search respectful pathways, track leads, and summon AI copilots from anywhere in the product. The Business Network keeps jobs, mentors, housing, and grants in one dignified workspace.
        </p>
        <form class="network-search" action="{{ route('home') }}" method="GET" role="search">
            <label class="visually-hidden" for="network-search-input">Search Athena</label>
            <input
                id="network-search-input"
                type="search"
                name="q"
                placeholder="Search jobs, mentors, housing, grants..."
                aria-label="Search jobs, mentors, housing, grants"
            >
            <button type="submit">Search</button>
        </form>

        <div class="network-chip-list">
            @foreach ($experienceChips as $chip)
                <span>{{ $chip }}</span>
            @endforeach
        </div>

        <div class="network-auth-links">
            <a href="{{ route('login') }}">Login</a>
            <span>·</span>
            <a href="{{ route('register') }}">Sign up</a>
        </div>
    </div>
</section>

<section class="network-ai" aria-labelledby="network-ai-concierge">
    <div class="network-ai__intro">
        <div>
            <p class="network-eyebrow">AI · Athena Assist</p>
            <h2 id="network-ai-concierge">Athena AI concierge</h2>
            <p>
                Ask for money, housing, legal, or wellness clarity anywhere. Choose a context, type what feels heavy, and Athena will answer inside this page — no extra navigation required.
            </p>
        </div>
        <div class="network-auth-gate">
            <p>Members can ask private, context-aware questions right from any page.</p>
            <div class="network-auth-gate__actions">
                <a class="btn btn-secondary btn-pill" href="{{ route('login') }}">Log in</a>
                <a class="btn btn-primary btn-pill" href="{{ route('register') }}">Join Athena</a>
            </div>
        </div>
    </div>
    <div class="network-ai__contexts">
        @foreach ($aiContexts as $context)
            @php
                $contextKey = $context['context'] ?? null;
                $contextUrl = $contextKey
                    ? $aiEntryUrl.(str_contains($aiEntryUrl, '?') ? '&' : '?').'context='.urlencode($contextKey)
                    : $aiEntryUrl;
            @endphp
            <a
                class="network-ai-card"
                href="{{ $contextUrl }}"
                data-ai-context="{{ $contextKey }}"
                data-ai-url="{{ $contextUrl }}"
                role="button"
            >
                <p class="network-ai-card__label">{{ $context['label'] }}</p>
                <h3>{{ $context['title'] }}</h3>
                <p>{{ $context['copy'] }}</p>
            </a>
        @endforeach
    </div>

    <div class="network-ai__cta">
        <p>Sign in to use Athena everywhere.</p>
        <p class="network-ai__cta-subtext">Members can start an AI concierge session without leaving their workflow.</p>
    </div>
</section>

@if ($sponsorAds->isNotEmpty())
    <section class="network-sponsor" aria-labelledby="network-sponsor-heading">
        <div class="network-sponsor__header">
            <div>
                <p class="network-eyebrow">Live sponsor preview</p>
                <h2 id="network-sponsor-heading">Advertising partners keeping Athena tools free</h2>
                <p>Seeded creatives rotate through this slot so stakeholders always see how respectful ads surface inside the product — even before campaigns go live.</p>
            </div>
        </div>
        <x-ad-slot :ads="$sponsorAds" position="business-network" layout="strip" />
    </section>
@endif

<section class="network-shell" aria-labelledby="network-heading">
    <header class="network-hero-card">
        <div class="network-hero-card__body">
            <p class="network-eyebrow">Women-owned · Verified · AI enhanced</p>
            <h1 class="network-hero-card__title" id="network-heading">The Business Network</h1>
            <p class="network-hero-card__copy">
                A luxe, women-first deal room where founders, suppliers, mentors, and government buyers meet. Borrowing the calm gradient language from our dashboard so the experience feels cohesive across Athena.
            </p>
            <div class="network-hero-card__actions">
                <a class="btn btn-primary btn-pill" href="{{ route('register') }}">Join &amp; access dashboard</a>
                <a class="link-arrow" href="#resources">Browse featured assets</a>
            </div>
        </div>
        <dl class="network-hero-card__stats" aria-label="Network signals">
            <div>
                <dt>Curated drops</dt>
                <dd>{{ number_format($resourceCount) }}</dd>
            </div>
            <div>
                <dt>Live tags</dt>
                <dd>{{ number_format(max($tagCount, 12)) }}</dd>
            </div>
            <div>
                <dt>Mentor prompts</dt>
                <dd>Weekly</dd>
            </div>
        </dl>
    </header>

    <div class="network-grid">
        <article class="network-panel" aria-labelledby="network-pillars-heading">
            <div class="network-panel__header">
                <div>
                    <p class="network-eyebrow">Pillars</p>
                    <h2 class="network-panel__title" id="network-pillars-heading">Built for ambition</h2>
                    <p class="network-panel__subtitle">Each pillar mirrors the dashboard’s respectful monitoring system so members land the right help at the right time.</p>
                </div>
                <a class="link-arrow" href="{{ route('register') }}">Open member dashboard</a>
            </div>
            <div class="network-pillars-grid">
                @foreach ($pillarHighlights as $pillar)
                    <article class="network-pillar-card">
                        <p class="network-eyebrow network-eyebrow--soft">{{ $pillar['label'] }}</p>
                        <p class="network-pillar-card__copy">{{ $pillar['copy'] }}</p>
                    </article>
                @endforeach
            </div>
        </article>

        <article class="network-panel network-panel--accent" aria-labelledby="network-ai-heading">
            <div class="network-panel__header">
                <div>
                    <p class="network-eyebrow">AI venture coach</p>
                    <h2 class="network-panel__title" id="network-ai-heading">Social energy, curated</h2>
                </div>
                <span class="network-chip">Powered by OpenAI &amp; laravel-social-starter</span>
            </div>
            <p class="network-panel__subtitle">The Business Network layers our social feed with women-first moderation, trending tags, and mentor prompts. It is the warmest corner of Athena.</p>

            <div class="network-tag-cloud" role="list">
                @forelse ($trendingTags as $tag)
                    <span role="listitem">{{ $tag }}</span>
                @empty
                    <span role="listitem">#GlowBoldly</span>
                    <span role="listitem">#DreamClients</span>
                    <span role="listitem">#CapitalCalm</span>
                @endforelse
            </div>

            <div class="network-panel__cta">
                <p class="network-panel__subtitle">“What’s one thing you want from the Business Network this week?”</p>
                <a class="btn btn-secondary btn-pill" href="{{ route('register') }}">Create my profile</a>
            </div>
        </article>
    </div>

    <section id="resources" class="network-panel network-panel--media" aria-labelledby="network-resources-heading">
        <div class="network-panel__header">
            <div>
                <p class="network-eyebrow">Curated drops</p>
                <h2 class="network-panel__title" id="network-resources-heading">Exported assets in action</h2>
                <p class="network-panel__subtitle">Pulled straight from the Business Network dashboard so stakeholders can preview our tone, pacing, and respect for data.</p>
            </div>
            <a class="btn btn-dark btn-pill" href="{{ route('register') }}">Access dashboard</a>
        </div>

        <div class="network-resource-grid">
            @foreach ($resources as $resource)
                <article class="network-resource-card" style="--network-card-color: {{ $resource->hero_color ?? 'rgba(244,114,182,0.1)' }};" aria-label="{{ $resource->title }}">
                    <div class="network-resource-card__badge">{{ $resource->badgeLabel() }}</div>
                    <h3>{{ $resource->title }}</h3>
                    <p>{{ $resource->summary }}</p>
                    <a class="link-arrow" href="{{ $resource->cta_url }}" target="_blank" rel="noopener">{{ $resource->cta_label }}</a>
                </article>
            @endforeach
        </div>
    </section>

    <section class="network-panel network-panel--dual" aria-labelledby="network-community-heading">
        <div class="network-panel__body">
            <p class="network-eyebrow">Community cadence</p>
            <h2 class="network-panel__title" id="network-community-heading">Weekly mentor prompts</h2>
            <p class="network-panel__subtitle">Every Monday, Athena drops fresh prompts, procurement announcements, and capital signals so women-owned businesses never miss a cue.</p>
            <ul class="network-list">
                <li>Respectful moderation and safety tooling mirror the social dashboard.</li>
                <li>AI concierge keeps copy on-tone while honouring consent settings.</li>
                <li>Signals sync with the Business Network waitlists for one-click follow ups.</li>
            </ul>
        </div>
        <div class="network-panel__media" aria-label="AI snippet">
            <p class="network-eyebrow network-eyebrow--soft">AI snippet</p>
            <h3>“What’s one thing you want from the Business Network this week?”</h3>
            <p>Lifted from <code>moneyman-v3.0-COMPLETE.md</code>—ready to paste into the dashboard composer for instant engagement.</p>
            <a class="btn btn-light btn-pill" href="{{ route('register') }}">Start the conversation</a>
        </div>
    </section>
</section>

<section class="network-newsletter" aria-labelledby="network-newsletter-heading">
    <div>
        <p class="network-eyebrow">Stay in the loop</p>
        <h2 id="network-newsletter-heading">Subscribe to our newsletter</h2>
        <p>Get the latest job opportunities and career insights delivered to your inbox. No spam. Unsubscribe anytime.</p>
    </div>
    <form class="network-newsletter__form" action="#" method="POST">
        <label for="network-email">Email address</label>
        <input type="email" id="network-email" name="email" placeholder="Enter your email" required>
        <button type="submit">Notify me</button>
    </form>
</section>

<section class="network-doc-links" aria-label="Athena documentation quick links">
    <div class="network-doc-links__brand">
        <p class="network-eyebrow">Athena</p>
        <p>Career intelligence, respectful monitoring, and whole-of-life planning for women across Australia.</p>
    </div>
    <div class="network-doc-links__routes">
        @foreach ($docLinks as $link)
            <a href="{{ $link['url'] }}">{{ $link['label'] }}</a>
        @endforeach
    </div>
</section>
@endsection

@push('scripts')
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('.network-ai-card[data-ai-context]').forEach((card) => {
                card.addEventListener('click', (event) => {
                    const contextKey = card.dataset.aiContext;
                    const fallbackUrl = card.dataset.aiUrl || card.getAttribute('href');

                    if (!contextKey) {
                        return;
                    }

                    event.preventDefault();

                    const eventDetail = {
                        key: contextKey,
                        autoOpen: true,
                        scroll: true,
                        fallbackUrl,
                    };

                    const dispatched = window.dispatchEvent(new CustomEvent('ai:select-context', { detail: eventDetail }));

                    if (!window.__athenaAiConciergeMounted || dispatched === false) {
                        window.location.href = fallbackUrl;
                    }
                });
            });
        });
    </script>
@endpush

