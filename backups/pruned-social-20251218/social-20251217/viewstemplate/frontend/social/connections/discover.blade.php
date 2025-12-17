@extends('frontend.social.layout')

@section('social-content')
@php
    $metrics = \App\Support\SocialMetrics::forUser(auth()->user());
    $recentConnections = $metrics['recent']['connections'] ?? collect();
    $userId = auth()->id();
    $recentIntros = $recentConnections->map(function ($connection) use ($userId) {
        $other = $connection->connected_user_id === $userId ? $connection->user : $connection->connectedUser;
        $profile = $other?->candidate;
        if (!$other) {
            return null;
        }
        return [
            'name' => $other->name,
            'title' => $profile?->title ?? 'Creative professional',
            'city' => $profile?->city ?? 'Global',
            'image' => $profile?->image ?? asset('images/default-avatar.png'),
        ];
    })->filter()->unique('name')->take(6);

    $vibeFilters = [
        ['label' => 'Brand Storytellers'],
        ['label' => 'Product Visionaries'],
        ['label' => 'Growth Alchemists'],
        ['label' => 'Community Hosts'],
        ['label' => 'Event Curators'],
    ];

    $locations = ['Remote-first', 'Cape Town', 'London', 'Accra', 'Lisbon', 'Dubai'];
    $industries = ['Brand Storytelling', 'Product Design', 'Growth Strategy', 'Community', 'People & Culture'];

    $spotlights = [
        [
            'name' => 'Leila Bloom',
            'title' => 'Brand Strategist - Cape Town',
            'bio' => 'Sculpts founder stories into shimmering launch journeys for heartfelt brands.',
            'tags' => ['Launch Playbooks', 'Brand Voice', 'Mentor'],
            'gradient' => 'from-rose-500 via-pink-500 to-purple-600',
        ],
        [
            'name' => 'Aria Chen',
            'title' => 'Product Designer - Remote',
            'bio' => 'Designs feminine-first dashboards that balance data with delight.',
            'tags' => ['Design Systems', 'Motion', 'Inclusive UX'],
            'gradient' => 'from-fuchsia-500 via-violet-500 to-indigo-500',
        ],
        [
            'name' => 'Noor Almasi',
            'title' => 'Community Architect - Dubai',
            'bio' => 'Hosts intimate founder circles and keeps conversations glowing.',
            'tags' => ['Circle Design', 'Moderation', 'IRL Activations'],
            'gradient' => 'from-amber-400 via-rose-400 to-sky-400',
        ],
    ];

    $journeys = [
        [
            'title' => 'Launch Dream Team',
            'description' => 'Pair marketers, designers, and storytellers ready to co-create magnetic launches.',
            'items' => ['Brand poet for message alchemy', 'UX stylist to finesse flows', 'Growth guide to map conversions'],
        ],
        [
            'title' => 'Community Glow-Up',
            'description' => 'Curate hosts, moderators, and event curators to keep your audience nurtured.',
            'items' => ['Weekly ritual facilitator', 'Voice-note concierge', 'Pop-up event curator'],
        ],
        [
            'title' => 'Founder Care Collective',
            'description' => 'Blend coaches, operations mavens, and finance queens to hold founders gently.',
            'items' => ['Operations genie', 'Money mindset coach', 'Accountability partner'],
        ],
    ];
    $counts = $metrics['counts'] ?? ['connections' => 0, 'pendingInvites' => 0];
    $searchRoute = route('member.social.connections.search');
    $storeRoute = route('member.social.connections.store');
@endphp
<div class="space-y-12 discover-page">
    <section class="discover-hero relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-600 text-white shadow-xl px-8 py-12 md:px-12">
        <span class="discover-hero__halo"></span>
        <span class="discover-hero__orb discover-hero__orb--left"></span>
        <span class="discover-hero__orb discover-hero__orb--right"></span>
        <div class="relative z-10 space-y-8">
            <div class="space-y-4 max-w-3xl">
                <span class="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
                    <i class="fas fa-compass"></i>
                    Discover people
                </span>
                <h1 class="discover-title text-4xl sm:text-5xl leading-tight">Find collaborators ready to bloom with you.</h1>
                <p class="max-w-2xl text-sm sm:text-base text-white/85">Use curated filters, mood-led tags, and real-time cues to discover women and allies designing the future with heart.</p>
            </div>
            <form class="discover-form grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto] items-stretch" data-discover-form data-search-route="{{ $searchRoute }}" data-store-route="{{ $storeRoute }}">
                <div>
                    <label for="discover_keyword" class="discover-field-label">Keyword or vibe</label>
                    <input id="discover_keyword" name="keyword" type="text" class="discover-input" placeholder="Brand launches, wellness tech, community magic..." data-discover-input>
                </div>
                <div>
                    <label for="discover_industry" class="discover-field-label">Focus</label>
                    <select id="discover_industry" name="vibe" class="discover-input" data-discover-vibe>
                        <option value="">All synergies</option>
                        @foreach($industries as $industry)
                            <option value="{{ $industry }}">{{ $industry }}</option>
                        @endforeach
                    </select>
                </div>
                <div>
                    <label for="discover_location" class="discover-field-label">Location aura</label>
                    <select id="discover_location" name="location" class="discover-input" data-discover-location>
                        <option value="">Wherever the spark is</option>
                        @foreach($locations as $location)
                            <option value="{{ $location }}">{{ $location }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="flex items-end">
                    <button type="submit" class="discover-primary-btn" data-discover-submit>
                        <i class="fas fa-wand-magic-sparkles mr-2"></i>Refresh matches
                    </button>
                </div>
                <p class="discover-feedback hidden md:col-span-4" data-discover-feedback></p>
            </form>
            <div class="flex flex-wrap gap-2">
                @foreach($vibeFilters as $filter)
                    <button type="button" class="discover-chip" data-discover-chip>
                        <span class="font-medium">{{ $filter['label'] }}</span>
                    </button>
                @endforeach
            </div>
            <div>
                <button type="button" class="discover-secondary-btn" onclick="openCuratedIntro(this)">
                    <i class="fas fa-heart mr-2"></i>Start curated intro
                </button>
                <p class="discover-feedback hidden mt-3" data-curated-feedback></p>
            </div>
        </div>
    </section>

        <section class="discover-live rounded-3xl border border-fuchsia-100/60 bg-gradient-to-br from-white via-rose-50 to-indigo-50 shadow-xl px-8 py-10 md:px-12 relative overflow-hidden" data-discover-wrapper data-search-route="{{ $searchRoute }}" data-store-route="{{ $storeRoute }}">
            <span class="discover-live__halo discover-live__halo--one"></span>
            <span class="discover-live__halo discover-live__halo--two"></span>
            <div class="relative z-10 space-y-6">
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div class="space-y-2 max-w-2xl">
                        <h2 class="discover-title text-3xl leading-snug text-slate-900">Live matchboard</h2>
                        <p class="text-sm text-slate-600">See who aligns with your filters instantly. Send invites straight from this glowing board.</p>
                    </div>
                    <div class="discover-live__stats grid grid-cols-2 gap-3 text-sm text-slate-600">
                        <div class="discover-live__stat">
                            <span class="discover-live__stat-label">Connected</span>
                            <span class="discover-live__stat-value" data-metric="connections-total">{{ number_format($counts['connections'] ?? 0) }}</span>
                        </div>
                        <div class="discover-live__stat">
                            <span class="discover-live__stat-label">Pending</span>
                            <span class="discover-live__stat-value" data-metric="pending-total">{{ number_format($counts['pendingInvites'] ?? 0) }}</span>
                        </div>
                    </div>
                </div>

                <p class="discover-live__feedback hidden" data-discover-message></p>

                <div class="discover-live__loading hidden" data-discover-loading>
                    <span class="discover-live__spinner"></span>
                    <p>Weaving fresh matches for you...</p>
                </div>

                <div class="discover-live__grid" data-discover-results>
                    <div class="discover-live__empty" data-discover-empty>
                        <i class="fas fa-sparkles"></i>
                        <p>Use the filters above or start typing to reveal your next collaborator.</p>
                    </div>
                </div>
            </div>
        </section>

    <section class="space-y-6">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
                <h2 class="discover-title text-3xl leading-snug text-slate-900">Spotlight muses</h2>
                <p class="text-sm text-slate-600">Handpicked profiles bringing softness, strategy, and soul to their craft.</p>
            </div>
            <a href="{{ route('member.social.connections.create') }}" class="discover-secondary-btn discover-secondary-btn--outline">
                <i class="fas fa-user-plus mr-2"></i>Invite someone now
            </a>
        </div>
        <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            @foreach($spotlights as $spotlight)
                @php
                    $initials = collect(explode(' ', $spotlight['name']))->filter()->map(function ($segment) {
                        return strtoupper(substr($segment, 0, 1));
                    })->take(2)->implode('');
                @endphp
                <article class="discover-card">
                    <div class="discover-card__gradient bg-gradient-to-br {{ $spotlight['gradient'] }}"></div>
                    <div class="discover-card__content">
                        <div class="discover-avatar">{{ $initials }}</div>
                        <div class="space-y-3">
                            <div>
                                <h3 class="discover-card__title">{{ $spotlight['name'] }}</h3>
                                <p class="discover-card__subtitle">{{ $spotlight['title'] }}</p>
                            </div>
                            <p class="discover-card__bio">{{ $spotlight['bio'] }}</p>
                            <div class="flex flex-wrap gap-2">
                                @foreach($spotlight['tags'] as $tag)
                                    <span class="discover-tag">{{ $tag }}</span>
                                @endforeach
                            </div>
                            <button type="button" class="discover-primary-btn discover-primary-btn--compact" onclick="openCuratedIntro(this)">
                                <i class="fas fa-sparkles mr-2"></i>Request warm intro
                            </button>
                        </div>
                    </div>
                </article>
            @endforeach
        </div>
    </section>

    <section class="rounded-3xl bg-white border border-rose-100/70 shadow-xl px-8 py-10 md:px-12">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
                <h2 class="discover-title text-3xl leading-snug text-slate-900">Curated journeys</h2>
                <p class="text-sm text-slate-600 max-w-2xl">Mix and match collaborators using these feminine-forward archetype stacks. Each journey is ready for your next launch wave.</p>
            </div>
        </div>
        <div class="grid gap-6 mt-8 lg:grid-cols-3">
            @foreach($journeys as $journey)
                <div class="discover-journey-card">
                    <h3 class="discover-journey-card__title">{{ $journey['title'] }}</h3>
                    <p class="discover-journey-card__description">{{ $journey['description'] }}</p>
                    <ul class="discover-journey-card__list">
                        @foreach($journey['items'] as $item)
                            <li>
                                <span class="discover-dot"></span>
                                <span>{{ $item }}</span>
                            </li>
                        @endforeach
                    </ul>
                </div>
            @endforeach
        </div>
    </section>

    <section class="space-y-6">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
                <h2 class="discover-title text-3xl leading-snug text-slate-900">Warm intros from your network</h2>
                <p class="text-sm text-slate-600">Peep who recently joined your orbit and queue up a heartfelt follow-up.</p>
            </div>
            <a href="{{ route('member.social.connections') }}" class="discover-secondary-btn discover-secondary-btn--outline">
                <i class="fas fa-users mr-2"></i>Review connections
            </a>
        </div>
        @if($recentIntros->isNotEmpty())
            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                @foreach($recentIntros as $intro)
                    <div class="discover-intro-card">
                        <div class="discover-intro-card__avatar">
                            <img src="{{ $intro['image'] }}" alt="{{ $intro['name'] }}">
                        </div>
                        <div class="space-y-2">
                            <h3 class="discover-intro-card__name">{{ $intro['name'] }}</h3>
                            <p class="discover-intro-card__role">{{ $intro['title'] }}</p>
                            <p class="discover-intro-card__meta">
                                <i class="fas fa-map-marker-alt mr-2"></i>{{ $intro['city'] }}
                            </p>
                        </div>
                        <button type="button" class="discover-primary-btn discover-primary-btn--compact" onclick="openCuratedIntro(this)">
                            <i class="fas fa-envelope-open-text mr-2"></i>Send note
                        </button>
                    </div>
                @endforeach
            </div>
        @else
            <div class="discover-empty">
                <i class="fas fa-sparkles text-2xl mb-3 text-rose-400"></i>
                <p class="text-sm text-slate-600">No fresh intros yet. Explore spotlights above or invite someone dazzling.</p>
            </div>
        @endif
    </section>
</div>
@endsection



@push('scripts')
<script>
(function() {
    function getCsrfToken() {
        var token = document.querySelector('meta[name="csrf-token"]');
        return token ? token.getAttribute('content') : '';
    }

    function escapeHtml(value) {
        if (value === null || value === undefined) {
            return '';
        }
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatNumber(value) {
        var num = Number(value) || 0;
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function updateMetric(key, delta) {
        if (!key || typeof delta !== 'number') {
            return;
        }
        var nodes = document.querySelectorAll('[data-metric="' + key + '"]');
        nodes.forEach(function(node) {
            var current = parseInt(node.getAttribute('data-metric-value') || node.textContent.replace(/[^0-9]/g, ''), 10) || 0;
            var next = Math.max(0, current + delta);
            node.setAttribute('data-metric-value', next);
            node.textContent = formatNumber(next);
        });
    }

    function setButtonLoading(button, isLoading, label) {
        if (!button) {
            return;
        }
        if (isLoading) {
            if (!button.dataset.originalHtml) {
                button.dataset.originalHtml = button.innerHTML;
            }
            button.disabled = true;
            button.innerHTML = '<span>' + escapeHtml(label || 'Sending...') + '</span>';
        } else {
            if (button.dataset.originalHtml) {
                button.innerHTML = button.dataset.originalHtml;
                delete button.dataset.originalHtml;
            }
            button.disabled = false;
        }
    }

    async function postInvite(endpoint, payload) {
        var response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-CSRF-TOKEN': getCsrfToken()
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            var errorData = await response.json().catch(function() {
                return {};
            });
            var errorMessage = errorData && errorData.message ? errorData.message : 'We could not process that invite just yet.';
            throw new Error(errorMessage);
        }

        return response.json();
    }

    function applyStateDelta(state, connection) {
        if (!state || !connection) {
            return;
        }
        if (state === 'created') {
            updateMetric('pending-total', 1);
        }
        if (state === 'connected') {
            updateMetric('connections-total', 1);
            updateMetric('pending-total', -1);
        }
    }

    var discoverForm = document.querySelector('[data-discover-form]');
    var discoverWrapper = document.querySelector('[data-discover-wrapper]');
    var searchRoute = discoverWrapper ? discoverWrapper.getAttribute('data-search-route') : (discoverForm ? discoverForm.getAttribute('data-search-route') : '');
    var storeRoute = discoverWrapper ? discoverWrapper.getAttribute('data-store-route') : (discoverForm ? discoverForm.getAttribute('data-store-route') : '');

    var resultsContainer = discoverWrapper ? discoverWrapper.querySelector('[data-discover-results]') : null;
    var emptyState = discoverWrapper ? discoverWrapper.querySelector('[data-discover-empty]') : null;
    var loadingState = discoverWrapper ? discoverWrapper.querySelector('[data-discover-loading]') : null;
    var boardFeedback = discoverWrapper ? discoverWrapper.querySelector('[data-discover-message]') : null;

    var keywordInput = discoverForm ? discoverForm.querySelector('[data-discover-input]') : null;
    var vibeSelect = discoverForm ? discoverForm.querySelector('[data-discover-vibe]') : null;
    var locationSelect = discoverForm ? discoverForm.querySelector('[data-discover-location]') : null;
    var formFeedback = discoverForm ? discoverForm.querySelector('[data-discover-feedback]') : null;
    var chips = document.querySelectorAll('[data-discover-chip]');
    var searchTimer = null;

    function showFormFeedback(message) {
        if (!formFeedback) {
            return;
        }
        formFeedback.classList.remove('hidden');
        if (!message) {
            formFeedback.classList.add('hidden');
            formFeedback.textContent = '';
            return;
        }
        formFeedback.textContent = message;
    }

    function showBoardFeedback(type, message) {
        if (!boardFeedback) {
            return;
        }
        boardFeedback.classList.remove('hidden', 'discover-live__feedback--success', 'discover-live__feedback--error', 'discover-live__feedback--info');
        if (!message) {
            boardFeedback.classList.add('hidden');
            boardFeedback.textContent = '';
            return;
        }
        boardFeedback.textContent = message;
        if (type) {
            boardFeedback.classList.add('discover-live__feedback--' + type);
        }
    }

    function setBoardLoading(isLoading) {
        if (loadingState) {
            loadingState.classList.toggle('hidden', !isLoading);
        }
        if (resultsContainer) {
            resultsContainer.classList.toggle('is-dimmed', !!isLoading);
        }
    }

    function toggleEmptyState(shouldShow) {
        if (!emptyState) {
            return;
        }
        emptyState.classList.toggle('hidden', !shouldShow);
    }

    function getActiveChips() {
        var values = [];
        chips.forEach(function(chip) {
            if (chip.classList.contains('discover-chip--active')) {
                var text = chip.textContent.trim();
                if (text) {
                    values.push(text);
                }
            }
        });
        return values;
    }

    function buildSearchParams() {
        var params = new URLSearchParams();
        if (keywordInput && keywordInput.value.trim()) {
            params.set('keyword', keywordInput.value.trim());
        }
        var activeChips = getActiveChips();
        var vibeValue = '';
        if (activeChips.length) {
            vibeValue = activeChips.join(', ');
        } else if (vibeSelect && vibeSelect.value) {
            vibeValue = vibeSelect.value;
        }
        if (vibeValue) {
            params.set('vibe', vibeValue);
        }
        if (locationSelect && locationSelect.value) {
            params.set('location', locationSelect.value);
        }
        params.set('limit', '12');
        return params;
    }

    function renderDiscoverResults(items) {
        if (!resultsContainer) {
            return;
        }
        var existing = resultsContainer.querySelectorAll('[data-live-card]');
        existing.forEach(function(card) {
            card.remove();
        });

        if (!Array.isArray(items) || !items.length) {
            toggleEmptyState(true);
            return;
        }

        toggleEmptyState(false);
        var fragment = document.createDocumentFragment();
        items.forEach(function(item) {
            fragment.appendChild(buildDiscoverCard(item));
        });
        resultsContainer.appendChild(fragment);
    }

    function buildDiscoverCard(item) {
        var card = document.createElement('article');
        card.className = 'discover-live-card';
        card.setAttribute('data-live-card', '');
        card.dataset.userId = item.user_id || '';
        card.innerHTML = [
            '<span class="discover-live-card__aurora"></span>',
            '<div class="discover-live-card__content">',
                '<div class="discover-live-card__header">',
                    '<div class="discover-live-card__avatar">',
                        '<img src="' + escapeHtml(item.avatar || '') + '" alt="' + escapeHtml(item.name || 'Collaborator') + '">',
                    '</div>',
                    '<div class="discover-live-card__identity">',
                        '<h3 class="discover-live-card__name">' + escapeHtml(item.name || 'Collaborator') + '</h3>',
                        '<p class="discover-live-card__role">' + escapeHtml(item.title || '') + (item.profession ? ' · ' + escapeHtml(item.profession) : '') + '</p>',
                        '<p class="discover-live-card__location"><i class="fas fa-map-marker-alt"></i> ' + escapeHtml(item.city || 'Global') + '</p>',
                    '</div>',
                    '<span class="discover-live-card__status" data-live-status><i class="fas fa-sun"></i><span data-live-status-label></span></span>',
                '</div>',
                '<div class="discover-live-card__tags" data-live-tags></div>',
                '<div class="discover-live-card__actions">',
                    '<button type="button" class="discover-live-card__cta" data-live-connect data-user-id="' + (item.user_id || '') + '"><i class="fas fa-envelope-open-text"></i><span data-live-cta-label>Invite</span></button>',
                    '<a class="discover-live-card__link" target="_blank" rel="noopener" data-live-profile-link><i class="fas fa-arrow-up-right-from-square"></i>Profile</a>',
                '</div>',
            '</div>'
        ].join('');

        var statusIcon = card.querySelector('.discover-live-card__status i');
        if (statusIcon) {
            statusIcon.className = 'fas fa-sun';
        }

        var tagContainer = card.querySelector('[data-live-tags]');
        if (tagContainer) {
            var tags = Array.isArray(item.tags) ? item.tags.slice(0, 4) : [];
            if (!tags.length) {
                tagContainer.remove();
            } else {
                tagContainer.innerHTML = tags.map(function(tag) {
                    return '<span class="discover-live-card__tag">' + escapeHtml(tag) + '</span>';
                }).join('');
            }
        }

        var profileLink = card.querySelector('[data-live-profile-link]');
        if (profileLink) {
            if (item.profile_url) {
                profileLink.setAttribute('href', item.profile_url);
            } else {
                profileLink.remove();
            }
        }

        updateDiscoverCard(card, item);

        var connectButton = card.querySelector('[data-live-connect]');
        if (connectButton) {
            connectButton.addEventListener('click', function() {
                handleDiscoverConnect(card, connectButton, item.user_id);
            });
        }

        return card;
    }

    function updateDiscoverCard(card, payload) {
        if (!card) {
            return;
        }
        var statusKey = payload.connection_status || payload.status_key || 'new';
        var statusLabel = payload.connection_label || payload.status_label || 'Invite';
        var statusNode = card.querySelector('[data-live-status]');
        var statusLabelNode = card.querySelector('[data-live-status-label]');
        var cta = card.querySelector('[data-live-connect]');
        var ctaLabel = card.querySelector('[data-live-cta-label]');

        if (statusNode) {
            var modifier = 'discover-live-card__status--fresh';
            if (statusKey === 'connected') {
                modifier = 'discover-live-card__status--connected';
            } else if (statusKey === 'pending_outgoing') {
                modifier = 'discover-live-card__status--pending';
            } else if (statusKey === 'pending_incoming') {
                modifier = 'discover-live-card__status--incoming';
            }
            statusNode.className = 'discover-live-card__status ' + modifier;
        }

        if (statusLabelNode) {
            statusLabelNode.textContent = statusLabel;
        }

        if (cta && ctaLabel) {
            if (statusKey === 'connected') {
                ctaLabel.textContent = 'Connected';
                cta.disabled = true;
                cta.classList.add('is-disabled');
            } else if (statusKey === 'pending_outgoing') {
                ctaLabel.textContent = 'Invite pending';
                cta.disabled = true;
                cta.classList.add('is-disabled');
            } else if (statusKey === 'pending_incoming') {
                ctaLabel.textContent = 'Respond via inbox';
                cta.disabled = true;
                cta.classList.add('is-disabled');
            } else {
                ctaLabel.textContent = 'Invite';
                cta.disabled = false;
                cta.classList.remove('is-disabled');
            }
        }

        card.dataset.statusKey = statusKey;
    }

    function handleDiscoverConnect(card, button, userId) {
        if (!storeRoute || !userId) {
            return;
        }
        setButtonLoading(button, true, 'Sending...');
        showBoardFeedback(null, '');
        postInvite(storeRoute, {
            target_user_id: Number(userId),
            invite_type: 'discover_invite'
        }).then(function(result) {
            if (result && result.connection) {
                updateDiscoverCard(card, result.connection);
                applyStateDelta(result.state, result.connection);
            }
            showBoardFeedback('success', result.message || 'Invite sent.');
        }).catch(function(error) {
            showBoardFeedback('error', error.message || 'We could not process that invite just yet.');
        }).finally(function() {
            setButtonLoading(button, false);
        });
    }

    function performDiscoverSearch() {
        if (!searchRoute) {
            return;
        }

        showFormFeedback('Curating luminous matches...');
        showBoardFeedback(null, '');
        setBoardLoading(true);

        var params = buildSearchParams();
        var query = params.toString();
        var url = searchRoute + (query ? '?' + query : '');

        fetch(url, {
            headers: {
                'Accept': 'application/json'
            }
        }).then(function(response) {
            if (!response.ok) {
                throw new Error('Request failed');
            }
            return response.json();
        }).then(function(data) {
            var items = Array.isArray(data.data) ? data.data : [];
            renderDiscoverResults(items);
            var count = Number(data.count || 0);
            if (count > 0) {
                showBoardFeedback('success', 'Refreshed ' + count + ' matches attuned to your filters.');
            } else {
                showBoardFeedback('info', 'No matches yet. Tweak your filters and try again.');
            }
        }).catch(function(error) {
            showBoardFeedback('error', error.message || 'We could not refresh those matches right now. Try again shortly.');
        }).finally(function() {
            setBoardLoading(false);
            showFormFeedback('');
        });
    }

    if (discoverForm) {
        discoverForm.addEventListener('submit', function(event) {
            event.preventDefault();
            performDiscoverSearch();
        });
    }

    if (keywordInput) {
        keywordInput.addEventListener('input', function() {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function() {
                performDiscoverSearch();
            }, 320);
        });
    }

    if (vibeSelect) {
        vibeSelect.addEventListener('change', function() {
            performDiscoverSearch();
        });
    }

    if (locationSelect) {
        locationSelect.addEventListener('change', function() {
            performDiscoverSearch();
        });
    }

    chips.forEach(function(chip) {
        chip.addEventListener('click', function() {
            var isActive = chip.classList.contains('discover-chip--active');
            chips.forEach(function(other) {
                other.classList.remove('discover-chip--active');
            });
            if (!isActive) {
                chip.classList.add('discover-chip--active');
            }
            performDiscoverSearch();
        });
    });

    window.runDiscoverScan = function(event) {
        if (event) {
            event.preventDefault();
        }
        performDiscoverSearch();
    };

    window.openCuratedIntro = function(button) {
        var feedback = document.querySelector('[data-curated-feedback]');
        if (!feedback) {
            return;
        }
        feedback.classList.remove('hidden');
        feedback.textContent = 'We will pair you with a dream collaborator shortly. Expect a gentle ping via notifications.';
        setTimeout(function() {
            feedback.textContent = 'Curated intro request logged. Check your inbox for updates soon!';
        }, 1500);
    };

    performDiscoverSearch();
})();
</script>
@endpush

