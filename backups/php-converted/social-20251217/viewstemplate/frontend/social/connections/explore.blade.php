    function updateFavoritesSummaryChipStates(type, value, isLocked) {
        if (!favoritesSummaryChips) {
            return;
        }
        favoritesSummaryChips.querySelectorAll('[data-summary-type]').forEach((node) => {
            const nodeType = node.dataset.summaryType || '';
            const nodeValue = node.dataset.summaryValue || '';
            const locked = isLocked && nodeType === type && nodeValue === value;
            if (locked) {
                node.classList.add('is-locked');
                node.setAttribute('aria-pressed', 'true');
            } else {
                node.classList.remove('is-locked');
                node.setAttribute('aria-pressed', 'false');
            }
        });
    }

    function restoreFavoritesSummaryLock({ announce = true } = {}) {
        if (!favoritesSummaryLockedType || !favoritesSummaryLockedValue) {
            return false;
        }
        const chip = favoritesSummaryChips?.querySelector(
            `[data-summary-type="${escapeSelector(favoritesSummaryLockedType)}"][data-summary-value="${escapeSelector(favoritesSummaryLockedValue)}"]`
        );
        if (!chip) {
            favoritesSummaryLockedType = '';
            favoritesSummaryLockedValue = '';
            if (announce) {
                announceFavoritesSummaryStatus('Favorites highlight reset.');
            }
            clearFavoritesSummaryHighlight({ silent: !announce });
            return false;
        }
        setSummaryChipActive(chip);
        const display = getSummaryDisplayText(chip);
        applyFavoritesSummaryHighlight(
            favoritesSummaryLockedType,
            favoritesSummaryLockedValue,
            display,
            { locked: true, silent: !announce }
        );
        return true;
    }

    function handleFavoritesSummaryEscape(event) {
        if (!event || event.key !== 'Escape') {
            return;
        }
        if (!favoritesSummaryLockedType || !favoritesSummaryLockedValue) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        favoritesSummaryLockedType = '';
        favoritesSummaryLockedValue = '';
        clearFavoritesSummaryHighlight({ silent: true });
        announceFavoritesSummaryStatus('Favorites highlight cleared.');
    }
@extends('frontend.social.layout')

@section('social-content')
@php
    $exploreMetrics = [
        [
            'icon' => 'fas fa-globe-americas',
            'label' => 'Global reach',
            'value' => number_format($counts['connections'] ?? 0),
            'hint' => 'Active collaborators across your network.',
        ],
        [
            'icon' => 'fas fa-envelope-open-heart',
            'label' => 'Invites awaiting love',
            'value' => number_format($counts['pendingInvites'] ?? 0),
            'hint' => 'Warm intros ready for a follow-up.',
        ],
        [
            'icon' => 'fas fa-bell',
            'label' => 'Fresh notifications',
            'value' => number_format($counts['unreadNotifications'] ?? 0),
            'hint' => 'Stay in the loop with your community.',
        ],
    ];
@endphp
<div class="explore-page space-y-12">
    <section class="explore-hero">
        <div class="explore-hero__bg"></div>
        <div class="explore-hero__content">
            <div class="explore-hero__intro">
                <span class="explore-hero__eyebrow">Explore People</span>
                <h1 class="explore-hero__title">Discover luminous collaborators aligned with your vibe</h1>
                <p class="explore-hero__subtitle">Search, filter, and fall in love with profiles curated by our AI concierge. Every card reveals a story waiting for your hello.</p>
                <div class="explore-hero__cta-group">
                    <a href="{{ route('member.social.connections.create') }}" class="explore-hero__cta explore-hero__cta--primary">
                        <i class="fas fa-user-plus"></i>
                        Craft an invite
                    </a>
                    <a href="{{ route('member.social.connections.spotlight') }}" class="explore-hero__cta explore-hero__cta--ghost">
                        <i class="fas fa-sparkles"></i>
                        View AI spotlight
                    </a>
                </div>
            </div>
            <div class="explore-hero__metrics">
                @foreach ($exploreMetrics as $metric)
                    <article class="explore-metric">
                        <div class="explore-metric__icon"><i class="{{ $metric['icon'] }}"></i></div>
                        <div>
                            <h3 class="explore-metric__label">{{ $metric['label'] }}</h3>
                            <p class="explore-metric__value">{{ $metric['value'] }}</p>
                        </div>
                    </article>
                @endforeach
            </div>
        </div>
    </section>

    <section class="explore-controls">
        <div class="explore-refine" data-refine-panel>
                <span class="explore-refine__eyebrow">Refine signals</span>
                <h2 class="explore-refine__title">Shape your match stream</h2>
                <p class="explore-refine__note">Layer keywords, locations, and vibes to watch the grid remix itself in real time.</p>
            </div>
            <div class="explore-refine__status">
                <span class="explore-refine__count"><strong data-refine-count>0</strong> in view</span>
                <span class="explore-refine__state" data-refine-state data-state="idle">All filters open. Sorted best fit.</span>
            </div>
            <div class="explore-refine__suggestions" data-refine-suggestions hidden>
                <span class="explore-suggestions__label"><i class="fas fa-wand-magic-sparkles"></i> Quick sparks</span>
                <div class="explore-suggestions__chips" data-refine-suggestions-chips></div>
            </div>
        </div>
        <div class="explore-control explore-control--search">
            <label for="exploreSearch" class="explore-control__label">Search keywords</label>
            <div class="explore-control__field">
                <i class="fas fa-magnifying-glass"></i>
                <input id="exploreSearch" type="search" placeholder="Name, craft, vibe, industry" data-explore-search>
            </div>
        </div>
        <div class="explore-control explore-control--location">
            <label for="exploreLocation" class="explore-control__label">Location hint</label>
            <div class="explore-control__field">
                <i class="fas fa-location-dot"></i>
                <input id="exploreLocation" type="text" placeholder="City, region, or remote" data-explore-location>
            </div>
        </div>
        <div class="explore-vibes">
            <span class="explore-control__label">Vibe filters</span>
            <div class="explore-vibes__chips">
                <button type="button" class="explore-vibe-chip explore-vibe-chip--active" data-explore-vibe="">All vibes</button>
                @foreach ($finderVibes as $vibe)
                    <button type="button" class="explore-vibe-chip" data-explore-vibe="{{ $vibe['value'] }}">{{ $vibe['label'] }}</button>
                @endforeach
            </div>
        </div>
        <div class="explore-control explore-control--sort">
            <label for="exploreSort" class="explore-control__label">Sort matches</label>
            <div class="explore-control__field explore-control__field--select">
                <i class="fas fa-wand-magic-sparkles"></i>
                <select id="exploreSort" data-explore-sort>
                    <option value="best">Best fit first</option>
                    <option value="newest">Newest signals</option>
                    <option value="vibe">Shared vibe</option>
                </select>
                <span class="explore-control__caret"><i class="fas fa-chevron-down"></i></span>
            </div>
        </div>
        <div class="explore-actions">
            <button type="button" class="explore-secondary" data-action="explore-clear">
                <i class="fas fa-broom"></i>
                Clear filters
            </button>
            <button type="button" class="explore-primary" data-action="explore-refresh">
                <i class="fas fa-rotate"></i>
                Refresh matches
            </button>
        </div>
        <div class="explore-active-filters" data-active-filters aria-live="polite"></div>
    </section>

    <section class="explore-favorites" data-favorites-bar aria-live="polite" aria-label="Saved matches" aria-describedby="favoritesActionsHint" tabindex="-1">
        <div class="explore-favorites__header" data-favorites-header hidden>
            <div class="explore-favorites__heading">
                <span class="explore-favorites__title"><i class="fas fa-heart"></i> Saved matches</span>
                <span class="explore-favorites__count" data-favorites-count aria-live="polite">0/6 saved</span>
            </div>
            <div class="explore-favorites__actions">
                <button type="button" class="explore-favorites__scroll" data-action="favorite-scroll" aria-label="Jump to saved matches" hidden>
                    <i class="fas fa-arrow-down-short-wide"></i>
                    Jump to list
                </button>
                <button type="button" class="explore-favorites__copy" data-action="favorite-copy" aria-label="Copy saved matches" disabled>
                    <i class="fas fa-clipboard-list"></i>
                    Copy names
                </button>
                <button type="button" class="explore-favorites__clear" data-action="favorite-clear">
                    <i class="fas fa-broom"></i>
                    Clear saved
                </button>
            </div>
            <div class="explore-favorites__summary" data-favorites-summary hidden aria-describedby="favoritesSummaryHint" role="group">
                <span class="explore-favorites__summary-label"><i class="fas fa-sparkles"></i> Highlights</span>
                <div class="explore-favorites__summary-chips" data-favorites-summary-chips role="list"></div>
                <div
                    class="explore-favorites__summary-detail"
                    data-favorites-summary-detail
                    id="favoritesSummaryDetail"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    hidden
                ></div>
            </div>
            <span id="favoritesSummaryHint" class="visually-hidden">Favorites highlights. Use Left and Right arrow keys to move between chips, Enter to lock, Escape to clear, then Tab to reach detail actions. Activate View matches to jump to the saved list or Copy names to add highlight details to your clipboard. You can also press Control or Command plus C while focused in this area.</span>
            <span class="visually-hidden" data-favorites-summary-status aria-live="polite"></span>
        </div>
    <span id="favoritesActionsHint" class="visually-hidden">Saved matches bar. Use Enter or Space to jump, arrow keys to reorder, Delete to remove, Home or End to send to start or finish.</span>
    <span class="visually-hidden" data-favorites-status aria-live="polite"></span>
        <div class="explore-favorites__content" data-favorites-content>
            <span class="explore-favorites__empty">Tap the hearts on matches to pin your favorites here.</span>
        </div>
        <div class="explore-favorites__undo" data-favorites-undo hidden>
            <span class="explore-favorites__undo-message" data-favorites-undo-message></span>
            <button type="button" class="explore-favorites__undo-button" data-action="favorite-undo" aria-label="Undo last removal" disabled aria-disabled="true">
                <i class="fas fa-rotate-left"></i>
                Undo
            </button>
        </div>
        <span class="explore-favorites__feedback" data-favorites-feedback aria-live="polite" role="status" aria-hidden="true">Saved matches copied.</span>
    </section>

    <section class="explore-results">
        <div class="explore-results__header">
            <div>
                <h2 class="explore-results__title">Curated matches</h2>
                <p class="explore-results__subtitle">Refined suggestions adapt to your filters instantly.</p>
            </div>
            <div class="explore-results__meta">
                <div class="explore-results__counts">
                    <span><strong data-explore-count>0</strong> matches</span>
                    <span class="explore-results__hint" data-explore-hint>Fetching brilliance&hellip;</span>
                    <span class="explore-results__insight" data-explore-insight><i class="fas fa-compass"></i>Dial in filters to surface themes.</span>
                    <div class="explore-insight-chips" data-explore-insight-chips hidden></div>
                </div>
                <div class="explore-share">
                    <button type="button" class="explore-share__cta" data-action="explore-share" data-share-link="">
                        <i class="fas fa-link"></i>
                        Share this view
                    </button>
                    <span class="explore-share__feedback" data-share-feedback>Link copied. Invite your circle.</span>
                </div>
            </div>
        </div>
        <div id="exploreMatches" class="explore-grid" aria-live="polite"></div>
    </section>
</div>
@endsection



@push('scripts')
<script>
(function () {
    const defaultAvatar = @json($defaultAvatar);
    const inviteComposerUrl = @json(route('member.social.connections.create'));
    const SORT_LABELS = {
        best: 'Best fit first',
        newest: 'Newest signals',
        vibe: 'Shared vibe',
    };
    const SORT_DEFAULT = 'best';
    const FAVORITES_STORAGE_KEY = 'ai-explore-favorites';
    const FILTERS_STORAGE_KEY = 'ai-explore-filters';
    const FAVORITES_LIMIT = 6;
    const favoriteIds = new Set();
    const matchLookup = new Map();
    const canUseStorage = detectStorage();

    const state = {
        matches: [],
        filtered: [],
        search: '',
        searchDisplay: '',
        location: '',
        locationDisplay: '',
        vibe: '',
        vibeDisplay: '',
        sort: SORT_DEFAULT,
        sortDisplay: SORT_LABELS[SORT_DEFAULT],
        lastUpdated: null,
        status: 'idle',
        favorites: [],
        activeSuggestions: [],
    };
    let searchInput;
    let locationInput;
    let vibeChips;
    let refreshButton;
    let clearButton;
    let sortSelect;
    let shareButton;
    let shareFeedback;
    let favoritesBar;
    let favoritesHeader;
    let favoritesContent;
    let favoritesClearButton;
    let favoritesCountDisplay;
    let favoritesScrollButton;
    let favoritesCopyButton;
    let favoritesFeedback;
    let favoritesSummaryContainer;
    let favoritesSummaryChips;
    let favoritesSummaryStatus;
    let favoritesSummaryDetail;
    let favoritesSummaryInteractionsBound = false;
    let favoritesSummaryDetailActionsBound = false;
    let favoritesSummaryKeyboardActivation = false;
    let favoritesSummaryDetailActionFromKeyboard = false;
    let favoritesSummaryCopyResetTimer = null;
    let favoritesSummaryActiveType = '';
    let favoritesSummaryActiveValue = '';
    let favoritesSummaryLockedType = '';
    let favoritesSummaryLockedValue = '';
    let favoritesUndoContainer;
    let favoritesUndoMessage;
    let favoritesUndoButton;
    let favoritesStatusLive;
    let refineCountDisplay;
    let refineStateDisplay;
    let refineSuggestions;
    let refineSuggestionsChips;
    let insightChipsContainer;
    let insightMessage;
    let favoritesFeedbackTimer = null;
    let favoritesStatusTimer = null;
    let favoritesUndoTimer = null;
    let favoritesUndoStack = [];
    let shareFeedbackTimer = null;
    let favoritesBarBound = false;
    let favoritesSummaryStatusTimer = null;

    document.addEventListener('DOMContentLoaded', () => {
        favoritesBar = document.querySelector('[data-favorites-bar]');
        favoritesHeader = document.querySelector('[data-favorites-header]');
        favoritesContent = document.querySelector('[data-favorites-content]');
        favoritesCountDisplay = document.querySelector('[data-favorites-count]');
        favoritesScrollButton = document.querySelector('[data-action="favorite-scroll"]');
        favoritesCopyButton = document.querySelector('[data-action="favorite-copy"]');
        favoritesFeedback = document.querySelector('[data-favorites-feedback]');
        favoritesSummaryContainer = document.querySelector('[data-favorites-summary]');
        favoritesSummaryChips = document.querySelector('[data-favorites-summary-chips]');
    favoritesSummaryDetail = document.querySelector('[data-favorites-summary-detail]');
        favoritesSummaryStatus = document.querySelector('[data-favorites-summary-status]');
        favoritesUndoContainer = document.querySelector('[data-favorites-undo]');
        favoritesUndoMessage = document.querySelector('[data-favorites-undo-message]');
        favoritesUndoButton = document.querySelector('[data-action="favorite-undo"]');
        favoritesStatusLive = document.querySelector('[data-favorites-status]');
        refineCountDisplay = document.querySelector('[data-refine-count]');
        refineStateDisplay = document.querySelector('[data-refine-state]');
        refineSuggestions = document.querySelector('[data-refine-suggestions]');
        refineSuggestionsChips = document.querySelector('[data-refine-suggestions-chips]');
        insightChipsContainer = document.querySelector('[data-explore-insight-chips]');
        insightMessage = document.querySelector('[data-explore-insight]');
        favoritesClearButton = document.querySelector('[data-action="favorite-clear"]');

        bindFavoritesSummaryInteractions();
    bindFavoritesSummaryDetailActions();
        document.addEventListener('keydown', handleFavoritesSummaryEscape);

        if (favoritesFeedback) {
            hideFavoritesFeedback();
        }

        hideFavoritesUndo();

        if (favoritesUndoButton) {
            favoritesUndoButton.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                handleFavoritesUndo();
            });
        }

        if (favoritesCopyButton) {
            favoritesCopyButton.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                try {
                    await handleFavoritesCopy();
                } catch (error) {
                    console.warn('Unable to copy favorites', error);
                    syncFavoritesCopyButton();
                    revealFavoritesFeedback('Clipboard blocked. Copy manually.');
                }
            });
        }

        if (favoritesClearButton) {
            favoritesClearButton.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                clearAllFavorites();
            });
        }
        bindFavoritesBarActions();
        hydrateFavoritesFromStorage();
        renderFavoritesBar();
        setupFilters();
        setupExploreShare();
        const hasQueryFilters = hydrateFiltersFromQuery();
        if (!hasQueryFilters) {
            hydrateFiltersFromStorage();
        }
        renderActiveFilters();
        updateRefineMeta();
        updateRefineSuggestions();
        renderExploreInsights();
        updateExploreShareLink();
        loadExploreMatches();
        document.addEventListener('keydown', handleGlobalUndoShortcut);
    });

    function setupFilters() {
        searchInput = document.querySelector('[data-explore-search]');
        locationInput = document.querySelector('[data-explore-location]');
        vibeChips = Array.from(document.querySelectorAll('[data-explore-vibe]'));
        refreshButton = document.querySelector('[data-action="explore-refresh"]');
        clearButton = document.querySelector('[data-action="explore-clear"]');
        sortSelect = document.querySelector('[data-explore-sort]');

        let searchTimer = null;
        if (searchInput) {
            searchInput.addEventListener('input', (event) => {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => {
                    const value = event.target.value || '';
                    state.searchDisplay = value.trim();
                    state.search = value.toLowerCase().trim();
                    applyExploreFilters();
                }, 140);
            });
        }

        if (locationInput) {
            locationInput.addEventListener('input', (event) => {
                const value = event.target.value || '';
                state.locationDisplay = value.trim();
                state.location = value.toLowerCase().trim();
                applyExploreFilters();
            });
        }

        vibeChips.forEach((chip) => {
            chip.addEventListener('click', () => {
                const selected = chip.getAttribute('data-explore-vibe') || '';
                state.vibe = selected.toLowerCase().trim();
                state.vibeDisplay = chip.textContent?.trim() || '';
                vibeChips.forEach((node) => node.classList.toggle('explore-vibe-chip--active', node === chip));
                applyExploreFilters();
            });
        });

        if (sortSelect) {
            sortSelect.value = state.sort;
            sortSelect.addEventListener('change', (event) => {
                const value = (event.target.value || SORT_DEFAULT).toLowerCase();
                applySortSelection(value);
            });
        }

        if (refreshButton) {
            refreshButton.addEventListener('click', () => {
                refreshButton.disabled = true;
                refreshButton.innerHTML = '<i class="fas fa-spinner-third fa-spin"></i> Refreshing&hellip;';
                loadExploreMatches(true).finally(() => {
                    refreshButton.disabled = false;
                    refreshButton.innerHTML = '<i class="fas fa-rotate"></i> Refresh matches';
                });
            });
        }

        if (clearButton) {
            clearButton.addEventListener('click', () => {
                state.search = '';
                state.searchDisplay = '';
                state.location = '';
                state.locationDisplay = '';
                state.vibe = '';
                state.vibeDisplay = '';
                state.sort = SORT_DEFAULT;
                state.sortDisplay = SORT_LABELS[SORT_DEFAULT];
                if (searchInput) {
                    searchInput.value = '';
                }
                if (locationInput) {
                    locationInput.value = '';
                }
                vibeChips.forEach((node, index) => {
                    node.classList.toggle('explore-vibe-chip--active', index === 0);
                });
                if (sortSelect) {
                    sortSelect.value = SORT_DEFAULT;
                }
                applyExploreFilters();
            });
        }
    }

    async function loadExploreMatches(isRefresh = false) {
        const container = document.getElementById('exploreMatches');
        const hint = document.querySelector('[data-explore-hint]');
        if (!container) {
            return Promise.resolve();
        }

        state.status = 'loading';
        updateExploreShareLink();
        renderExploreSkeleton(container);
        updateRefineMeta();
        updateRefineSuggestions();
        renderExploreInsights();
        if (hint) {
            hint.textContent = isRefresh ? 'Refreshing suggestions&hellip;' : 'Fetching brilliance&hellip;';
        }

        try {
            const records = await fetchExploreMatches();
            state.matches = records;
            state.lastUpdated = new Date();
            state.status = 'ready';
            refreshFavoritesFromCollection(records);
            applyExploreFilters();
        } catch (error) {
            console.error('Unable to refresh explore matches', error);
            container.innerHTML = getExploreEmpty('Unable to refresh matches right now. Try again soon.');
            updateExploreCount(0);
            state.matches = [];
            state.filtered = [];
            state.lastUpdated = null;
            state.status = 'error';
            refreshExploreHint();
            renderActiveFilters();
            updateExploreShareLink();
            updateRefineMeta();
            updateRefineSuggestions();
            renderExploreInsights();
        }
    }

    async function fetchExploreMatches(limit = 24) {
        const service = window.aiFeatures?.getSuggestedConnections;
        if (!service) {
            return getExploreFallback();
        }

        try {
            const response = await service.call(window.aiFeatures, limit);
            const data = Array.isArray(response?.data)
                ? response.data
                : (Array.isArray(response) ? response : []);
            if (!data.length) {
                return getExploreFallback();
            }
            return data;
        } catch (error) {
            console.error('Explore fetch failed', error);
            return getExploreFallback();
        }
    }

    function applyExploreFilters() {
        const { matches, search, location, vibe } = state;
        const filtered = matches.filter((item) => {
            const haystack = buildHaystack(item);
            const matchesSearch = !search || haystack.includes(search);
            const matchesLocation = !location || haystack.includes(location);
            const matchesVibe = !vibe || haystack.includes(vibe);
            return matchesSearch && matchesLocation && matchesVibe;
        });

        const sorted = sortExploreMatches(filtered);
        state.filtered = sorted;
        renderExploreMatches(sorted);
        refreshExploreHint();
        renderActiveFilters();
        updateExploreShareLink();
        updateRefineMeta();
        updateRefineSuggestions();
        renderExploreInsights();
        persistFilterState();
    }

    function buildHaystack(record) {
        const parts = [];
        if (record?.name) {
            parts.push(String(record.name));
        }
        if (record?.full_name) {
            parts.push(String(record.full_name));
        }
        if (record?.title) {
            parts.push(String(record.title));
        }
        if (record?.role) {
            parts.push(String(record.role));
        }
        if (record?.city) {
            parts.push(String(record.city));
        }
        if (record?.location) {
            parts.push(String(record.location));
        }
        if (record?.summary) {
            parts.push(String(record.summary));
        }
        if (record?.reason) {
            parts.push(String(record.reason));
        }
        if (Array.isArray(record?.tags)) {
            parts.push(record.tags.join(' '));
        }
        return parts.join(' ').toLowerCase();
    }

    function sortExploreMatches(records) {
        if (!Array.isArray(records) || records.length <= 1) {
            return Array.isArray(records) ? records.slice() : [];
        }
        const mode = SORT_LABELS[state.sort] ? state.sort : SORT_DEFAULT;
        const comparator = getSortComparator(mode);
        return records
            .map((item, index) => ({ item, index }))
            .sort((a, b) => comparator(a.item, b.item, a.index, b.index))
            .map((entry) => entry.item);
    }

    function getSortComparator(mode) {
        switch (mode) {
            case 'newest':
                return compareNewest;
            case 'vibe':
                return compareVibe;
            case 'best':
            default:
                return compareBest;
        }
    }

    function compareBest(a, b, indexA, indexB) {
        const diff = getMatchScore(b) - getMatchScore(a);
        if (diff !== 0) {
            return diff;
        }
        return indexA - indexB;
    }

    function compareNewest(a, b, indexA, indexB) {
        const diff = getMatchTimestamp(b) - getMatchTimestamp(a);
        if (diff !== 0) {
            return diff;
        }
        return compareBest(a, b, indexA, indexB);
    }

    function compareVibe(a, b, indexA, indexB) {
        const tagA = getPrimaryTag(a);
        const tagB = getPrimaryTag(b);
        if (tagA && tagB) {
            const localeDiff = tagA.localeCompare(tagB, undefined, { sensitivity: 'base' });
            if (localeDiff !== 0) {
                return localeDiff;
            }
        } else if (tagA) {
            return -1;
        } else if (tagB) {
            return 1;
        }
        return compareBest(a, b, indexA, indexB);
    }

    function getMatchScore(record) {
        const candidate = Number(
            record?.score ??
            record?.match_score ??
            record?.affinity ??
            record?._score ??
            record?.confidence
        );
        return Number.isFinite(candidate) ? candidate : 0;
    }

    function getMatchTimestamp(record) {
        const candidates = [
            record?.last_seen_at,
            record?.last_seen,
            record?.updated_at,
            record?.recent_activity,
            record?.created_at,
            record?.timestamp,
        ];
        for (const value of candidates) {
            if (!value) {
                continue;
            }
            const date = new Date(value);
            if (!Number.isNaN(date.getTime())) {
                return date.getTime();
            }
        }
        return 0;
    }

    function getPrimaryTag(record) {
        if (Array.isArray(record?.tags) && record.tags.length) {
            const first = record.tags.find((tag) => typeof tag === 'string' && tag.trim().length);
            if (first) {
                return first.trim();
            }
        }
        const vibe = record?.vibe ?? record?.primary_vibe ?? record?.focus;
        if (typeof vibe === 'string' && vibe.trim()) {
            return vibe.trim();
        }
        return '';
    }

    function applySortSelection(value) {
        const mode = SORT_LABELS[value] ? value : SORT_DEFAULT;
        state.sort = mode;
        state.sortDisplay = SORT_LABELS[mode];
        if (sortSelect && sortSelect.value !== mode) {
            sortSelect.value = mode;
        }
        if (!state.matches.length) {
            updateExploreShareLink();
            renderActiveFilters();
            refreshExploreHint();
            updateRefineMeta();
            updateRefineSuggestions();
            renderExploreInsights();
            persistFilterState();
            return;
        }
        applyExploreFilters();
    }

    function renderExploreMatches(records) {
        const container = document.getElementById('exploreMatches');
        if (!container) {
            return;
        }

        matchLookup.clear();

        if (!records.length) {
            container.innerHTML = getExploreEmpty('No matches yet. Adjust your filters or refresh for fresh energy.');
            updateExploreCount(0);
            bindExploreActions(container);
            return;
        }

        const highlightTop = state.sort === SORT_DEFAULT;
        const fragments = [];
        const seenIdentifiers = new Map();
        records.forEach((record, index) => {
            const baseData = extractCardData(record, index);
            const uniqueId = ensureUniqueIdentifier(baseData.id, seenIdentifiers);
            const cardData = uniqueId === baseData.id ? baseData : { ...baseData, id: uniqueId };
            matchLookup.set(cardData.id, cardData);
            fragments.push(buildExploreCard(cardData, highlightTop && index === 0));
        });
        container.innerHTML = fragments.join('');
        updateExploreCount(records.length);
        bindExploreActions(container);
    }

    function refreshExploreHint() {
        const hint = document.querySelector('[data-explore-hint]');
        if (!hint) {
            return;
        }

        if (state.status === 'error') {
            hint.textContent = 'Sync paused. Try again soon.';
            return;
        }

        if (state.status === 'loading' && !state.filtered.length) {
            hint.textContent = 'Gathering matches...';
            return;
        }

        const activeFilters = [];
        if (state.search && state.searchDisplay) {
            activeFilters.push(`keyword "${state.searchDisplay}"`);
        }
        if (state.location && state.locationDisplay) {
            activeFilters.push(`location "${state.locationDisplay}"`);
        }
        if (state.vibe && state.vibeDisplay) {
            activeFilters.push(state.vibeDisplay.toLowerCase());
        }

        if (!state.filtered.length) {
            if (activeFilters.length) {
                hint.textContent = `No matches for ${activeFilters.join(' + ')} yet. Try softening a filter.`;
            } else {
                hint.textContent = 'No curated matches just yet. Refresh for new energy soon.';
            }
            return;
        }

        const parts = [];
        if (activeFilters.length) {
            parts.push(`Filtered by ${activeFilters.join(' + ')}`);
        } else {
            parts.push('Showing all curated matches');
        }
        if (state.lastUpdated instanceof Date) {
            parts.push(`updated ${state.lastUpdated.toLocaleTimeString()}`);
        }
        if (state.sort && state.sort !== SORT_DEFAULT) {
            parts.push(`sorted by ${state.sortDisplay.toLowerCase()}`);
        }
        const topNameRaw = state.filtered[0]?.name || state.filtered[0]?.full_name || '';
        const topName = typeof topNameRaw === 'string' ? topNameRaw.trim() : String(topNameRaw || '').trim();
        if (topName) {
            parts.push(`top profile ${topName}`);
        }
        hint.textContent = `${parts.join(' • ')}.`;
    }

    function updateRefineMeta() {
        if (refineCountDisplay) {
            const visibleCount = state.filtered.length;
            const fallbackCount = state.matches.length;
            let countText = '0';
            if (visibleCount) {
                countText = visibleCount.toLocaleString();
            } else if (state.status === 'loading') {
                countText = '...';
            } else if (fallbackCount) {
                countText = fallbackCount.toLocaleString();
            }
            refineCountDisplay.textContent = countText;
        }

        if (!refineStateDisplay) {
            return;
        }

        const filters = [];
        if (state.searchDisplay) {
            filters.push(`Keyword "${state.searchDisplay}"`);
        }
        if (state.locationDisplay) {
            filters.push(`Location "${state.locationDisplay}"`);
        }
        if (state.vibeDisplay) {
            filters.push(`Vibe ${state.vibeDisplay}`);
        }
        if (state.sort && state.sort !== SORT_DEFAULT) {
            filters.push(`Sort ${state.sortDisplay}`);
        }

        let statusKey = 'idle';
        let message = 'All filters open. Sorted best fit.';

        if (state.status === 'loading') {
            statusKey = 'loading';
            message = state.filtered.length ? 'Refreshing matches...' : 'Gathering matches...';
        } else if (state.status === 'error') {
            statusKey = 'error';
            message = 'Sync paused. Refresh when ready.';
        } else if (!state.filtered.length) {
            if (state.status === 'idle' && !state.matches.length) {
                statusKey = 'idle';
                message = filters.length
                    ? 'Filters ready. Loading matches shortly.'
                    : 'Priming suggestions...';
            } else {
                statusKey = filters.length ? 'empty' : 'idle';
                message = filters.length
                    ? `No matches for ${filters.join(' • ')} yet. Soften a filter.`
                    : 'Awaiting fresh matches. Try a refresh soon.';
            }
        } else {
            statusKey = 'ready';
            const parts = [];
            if (filters.length) {
                parts.push(filters.join(' • '));
            } else {
                parts.push('All filters open');
            }
            if (state.lastUpdated instanceof Date) {
                parts.push(`Updated ${state.lastUpdated.toLocaleTimeString()}`);
            }
            message = parts.join(' • ');
        }

        refineStateDisplay.textContent = message;
        refineStateDisplay.dataset.state = statusKey;
    }

    function collectExploreStats(records) {
        const summary = {
            total: Array.isArray(records) ? records.length : 0,
            tags: [],
            locations: [],
        };
        if (!Array.isArray(records) || !records.length) {
            return summary;
        }

        const tagTally = new Map();
        const locationTally = new Map();

        records.forEach((record) => {
            if (Array.isArray(record?.tags)) {
                record.tags.forEach((tag) => {
                    const label = pickText(tag);
                    if (!label) {
                        return;
                    }
                    const key = label.toLowerCase();
                    const current = tagTally.get(key) || { label, count: 0 };
                    current.count += 1;
                    current.label = label;
                    tagTally.set(key, current);
                });
            }

            const location = pickText(record?.city, record?.location);
            if (!location) {
                return;
            }
            const locationKey = location.toLowerCase();
            const locationEntry = locationTally.get(locationKey) || { label: location, count: 0 };
            locationEntry.count += 1;
            locationEntry.label = location;
            locationTally.set(locationKey, locationEntry);
        });

        summary.tags = Array.from(tagTally.values()).sort((a, b) => {
            if (b.count !== a.count) {
                return b.count - a.count;
            }
            return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
        });

        summary.locations = Array.from(locationTally.values()).sort((a, b) => {
            if (b.count !== a.count) {
                return b.count - a.count;
            }
            return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
        });

        return summary;
    }

    function updateRefineSuggestions() {
        if (!refineSuggestions || !refineSuggestionsChips) {
            state.activeSuggestions = [];
            return;
        }

        if (state.status === 'error' || (state.status === 'loading' && !state.filtered.length)) {
            refineSuggestions.hidden = true;
            refineSuggestionsChips.innerHTML = '';
            state.activeSuggestions = [];
            return;
        }

        const source = state.filtered.length ? state.filtered : state.matches;
        if (!Array.isArray(source) || !source.length) {
            refineSuggestions.hidden = true;
            refineSuggestionsChips.innerHTML = '';
            state.activeSuggestions = [];
            return;
        }

        const stats = collectExploreStats(source);
        const chips = [];
        const used = new Set();
        const suggestionKeys = [];
        const activeSearch = (state.searchDisplay || '').toLowerCase();
        const activeLocation = (state.locationDisplay || '').toLowerCase();
        const MAX_CHIPS = 3;

        const addChip = (label, type, count) => {
            const normalized = typeof label === 'string' ? label.trim() : String(label || '').trim();
            if (!normalized) {
                return;
            }
            const key = `${type}:${normalized.toLowerCase()}`;
            if (used.has(key)) {
                return;
            }
            if (type === 'search' && activeSearch && normalized.toLowerCase() === activeSearch) {
                return;
            }
            if (type === 'location' && activeLocation && normalized.toLowerCase() === activeLocation) {
                return;
            }
            if (chips.length >= MAX_CHIPS) {
                return;
            }
            chips.push(buildSuggestionChip(normalized, type, count));
            used.add(key);
            suggestionKeys.push(key);
        };

        stats.tags.forEach((entry) => addChip(entry.label, 'search', entry.count));
        stats.locations.forEach((entry) => addChip(entry.label, 'location', entry.count));

        if (!chips.length) {
            refineSuggestions.hidden = true;
            refineSuggestionsChips.innerHTML = '';
            state.activeSuggestions = [];
            return;
        }

        refineSuggestions.hidden = false;
        refineSuggestionsChips.innerHTML = chips.join('');
        state.activeSuggestions = suggestionKeys;
        bindSuggestionChips();
    }

    function buildSuggestionChip(label, type, count) {
        const iconClass = type === 'location' ? 'fas fa-location-dot' : 'fas fa-hashtag';
        const aria = type === 'location'
            ? `Filter matches near ${label}`
            : `Filter matches mentioning ${label}`;
        const tooltip = count && Number.isFinite(count)
            ? `${count} match${count === 1 ? '' : 'es'} highlighted`
            : 'Apply this quick filter';
        const safeLabel = escapeHtml(label);
        const safeTooltip = escapeHtml(tooltip);
        const safeAria = escapeHtml(aria);
        const safeDataValue = escapeHtml(label);
        return `
            <button type="button" class="explore-suggestion-chip" data-suggestion-type="${type}" data-suggestion-value="${safeDataValue}" data-suggestion-label="${safeLabel}" title="${safeTooltip}" aria-label="${safeAria}" tabindex="0">
                <i class="${iconClass}"></i>
                <span>${safeLabel}</span>
            </button>
        `;
    }

    function bindSuggestionChips() {
        if (!refineSuggestionsChips) {
            return;
        }
        refineSuggestionsChips.querySelectorAll('[data-suggestion-type]').forEach((chip) => {
            chip.addEventListener('click', handleSuggestionActivate);
            chip.addEventListener('keydown', handleSuggestionKeydown);
        });
    }

    function handleSuggestionActivate(event) {
        const chip = event.currentTarget || event.target.closest('[data-suggestion-type]');
        if (!chip) {
            return;
        }
        const type = chip.dataset.suggestionType || 'search';
        const value = chip.dataset.suggestionValue || '';
        const label = chip.dataset.suggestionLabel || value;
        applySuggestion(type, value, label);
    }

    function handleSuggestionKeydown(event) {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }
        event.preventDefault();
        handleSuggestionActivate(event);
    }

    function applySuggestion(type, value, displayValue) {
        const normalizedRaw = typeof value === 'string' ? value.trim() : String(value || '').trim();
        const displayRaw = typeof displayValue === 'string' ? displayValue.trim() : '';
        const displayText = displayRaw || normalizedRaw;

        if (!normalizedRaw && type !== 'vibe' && type !== 'sort') {
            return;
        }

        switch (type) {
            case 'location':
                state.locationDisplay = displayText;
                state.location = normalizedRaw.toLowerCase();
                if (locationInput) {
                    locationInput.value = displayText;
                    try {
                        locationInput.focus({ preventScroll: true });
                    } catch (error) {
                        locationInput.focus();
                    }
                }
                applyExploreFilters();
                break;
            case 'vibe': {
                const normalizedValue = normalizedRaw.toLowerCase();
                state.vibe = normalizedValue;
                state.vibeDisplay = normalizedValue ? (displayText || normalizedRaw) : '';
                if (Array.isArray(vibeChips) && vibeChips.length) {
                    let matched = false;
                    vibeChips.forEach((chip, index) => {
                        const chipValue = (chip.getAttribute('data-explore-vibe') || '').toLowerCase().trim();
                        const isMatch = normalizedValue ? chipValue === normalizedValue : chipValue === '' || (!chipValue && index === 0);
                        chip.classList.toggle('explore-vibe-chip--active', isMatch);
                        if (isMatch && !matched) {
                            matched = true;
                            try {
                                chip.focus({ preventScroll: true });
                            } catch (error) {
                                chip.focus();
                            }
                        }
                    });
                    if (!matched && vibeChips[0]) {
                        vibeChips[0].classList.add('explore-vibe-chip--active');
                    }
                }
                applyExploreFilters();
                break;
            }
            case 'sort': {
                const normalizedValue = normalizedRaw.toLowerCase() || SORT_DEFAULT;
                applySortSelection(normalizedValue);
                break;
            }
            case 'search':
            default:
                state.searchDisplay = displayText;
                state.search = normalizedRaw.toLowerCase();
                if (searchInput) {
                    searchInput.value = displayText;
                    try {
                        searchInput.focus({ preventScroll: true });
                    } catch (error) {
                        searchInput.focus();
                    }
                }
                applyExploreFilters();
                break;
        }
    }

    function renderActiveFilters() {
        const container = document.querySelector('[data-active-filters]');
        if (!container) {
            return;
        }

        const filters = [];
        if (state.search && state.searchDisplay) {
            filters.push({ key: 'search', label: `Search: ${state.searchDisplay}` });
        }
        if (state.location && state.locationDisplay) {
            filters.push({ key: 'location', label: `Location: ${state.locationDisplay}` });
        }
        if (state.vibe && state.vibeDisplay) {
            filters.push({ key: 'vibe', label: `Vibe: ${state.vibeDisplay}` });
        }
        if (state.sort && state.sort !== SORT_DEFAULT) {
            filters.push({ key: 'sort', label: `Sort: ${state.sortDisplay}` });
        }

        if (!filters.length) {
            container.innerHTML = '<div class="explore-active-filters__empty">All filters open. Layer on specifics when ready.</div>';
            return;
        }

        const chipsMarkup = filters
            .map((filter) => `<button type="button" class="explore-active-chip" data-remove-filter="${filter.key}"><span>${filter.label}</span><i class="fas fa-xmark"></i></button>`)
            .join('');
        const clearChip = '<button type="button" class="explore-active-chip explore-active-chip--clear" data-remove-filter="all"><i class="fas fa-bolt"></i>Clear all</button>';
        container.innerHTML = `
            <span class="explore-active-filters__label">Active filters</span>
            <div class="explore-active-filters__chips">
                ${chipsMarkup}${filters.length > 1 ? clearChip : ''}
            </div>
        `;
        container.querySelectorAll('[data-remove-filter]').forEach((button) => {
            button.addEventListener('click', handleRemoveFilter);
        });
    }

    function renderExploreInsights() {
        if (!insightMessage) {
            insightMessage = document.querySelector('[data-explore-insight]');
        }
        if (!insightMessage) {
            return;
        }
        if (!insightChipsContainer) {
            insightChipsContainer = document.querySelector('[data-explore-insight-chips]');
        }

        if (state.status === 'error') {
            insightMessage.innerHTML = '<i class="fas fa-triangle-exclamation"></i>Sync paused. Refresh when ready.';
            clearInsightChips();
            return;
        }

        if (state.status === 'loading' && !state.filtered.length) {
            insightMessage.innerHTML = '<i class="fas fa-compass"></i>Gathering fresh matches&hellip;';
            clearInsightChips();
            return;
        }

        if (!state.filtered.length) {
            insightMessage.innerHTML = '<i class="fas fa-compass"></i>Dial in filters to surface themes.';
            clearInsightChips();
            return;
        }
        const stats = collectExploreStats(state.filtered);
        const topTag = stats.tags[0];
        const topLocation = stats.locations[0];
        const phrases = [];

        if (topTag) {
            const safeTag = escapeHtml(topTag.label);
            phrases.push(`Trending: ${safeTag} (${topTag.count} match${topTag.count === 1 ? '' : 'es'})`);
        }
        if (topLocation) {
            const safeLocation = escapeHtml(topLocation.label);
            phrases.push(`${topLocation.count} match${topLocation.count === 1 ? '' : 'es'} near ${safeLocation}`);
        }
        if (!phrases.length) {
            const total = stats.total;
            phrases.push(`${total} curated match${total === 1 ? '' : 'es'} ready to explore`);
        }

        if (state.sort === 'newest') {
            phrases.push('Newest signals first');
        } else if (state.sort === 'vibe') {
            phrases.push('Grouped by shared vibe');
        }

        insightMessage.innerHTML = `<i class="fas fa-compass"></i>${phrases.join(' • ')}`;
        renderInsightChips(stats);
    }

    function clearInsightChips() {
        if (!insightChipsContainer) {
            insightChipsContainer = document.querySelector('[data-explore-insight-chips]');
        }
        if (!insightChipsContainer) {
            return;
        }
        insightChipsContainer.innerHTML = '';
        insightChipsContainer.hidden = true;
    }

    function renderInsightChips(stats) {
        if (!insightChipsContainer) {
            insightChipsContainer = document.querySelector('[data-explore-insight-chips]');
        }
        if (!insightChipsContainer) {
            return;
        }

        if (!stats || !stats.total) {
            clearInsightChips();
            return;
        }

        const suggestionKeys = Array.isArray(state.activeSuggestions)
            ? new Set(state.activeSuggestions.map((key) => String(key || '').toLowerCase()))
            : new Set();
        const usedKeys = new Set();
        const chips = [];
        const MAX_INSIGHT_CHIPS = 4;

        const addChip = (icon, label, descriptor, key, action = null) => {
            if (chips.length >= MAX_INSIGHT_CHIPS) {
                return;
            }
            const normalizedLabel = typeof label === 'string' ? label.trim() : String(label || '').trim();
            if (!normalizedLabel) {
                return;
            }
            const normalizedKey = (key || normalizedLabel).toLowerCase();
            if (suggestionKeys.has(normalizedKey) || usedKeys.has(normalizedKey)) {
                return;
            }
            const descriptorText = typeof descriptor === 'string' ? descriptor.trim() : '';
            const safeLabel = escapeHtml(normalizedLabel);
            const safeDescriptor = descriptorText ? escapeHtml(descriptorText) : '';
            const chipText = descriptorText ? `${safeLabel} (${safeDescriptor})` : safeLabel;
            const interactive = action && typeof action.type === 'string' && action.type.trim().length;
            let markup = '';

            if (interactive) {
                const actionType = escapeHtml(action.type.trim());
                const actionValueRaw = typeof action.value === 'undefined' ? normalizedLabel : action.value;
                const actionLabelRaw = typeof action.label === 'undefined' ? normalizedLabel : action.label;
                const tooltipRaw = action.tooltip;
                const ariaRaw = action.aria;
                const actionValue = escapeHtml(String(actionValueRaw ?? ''));
                const actionLabel = escapeHtml(String(actionLabelRaw ?? normalizedLabel));
                const tooltipAttr = tooltipRaw ? ` title="${escapeHtml(String(tooltipRaw))}"` : '';
                const ariaBase = ariaRaw
                    ? String(ariaRaw)
                    : (descriptorText ? `${normalizedLabel} (${descriptorText})` : normalizedLabel);
                const ariaLabel = escapeHtml(ariaBase);
                markup = `<button type="button" class="explore-insight-chip explore-insight-chip--interactive" data-insight-action="${actionType}" data-insight-value="${actionValue}" data-insight-label="${actionLabel}"${tooltipAttr} aria-label="${ariaLabel}"><i class="${icon}"></i><span>${chipText}</span></button>`;
            } else {
                markup = `<span class="explore-insight-chip"><i class="${icon}"></i><span>${chipText}</span></span>`;
            }

            chips.push(markup);
            usedKeys.add(normalizedKey);
        };

        const totalDescriptor = stats.total === 1 ? '1 match' : `${stats.total} matches`;
        addChip('fas fa-users', `${stats.total} in view`, totalDescriptor, 'insight:total');

        if (Array.isArray(stats.tags)) {
            for (const entry of stats.tags) {
                if (chips.length >= MAX_INSIGHT_CHIPS) {
                    break;
                }
                const rawLabel = typeof entry?.label === 'string' ? entry.label : String(entry?.label || '');
                const trimmedLabel = rawLabel.trim();
                if (!trimmedLabel) {
                    continue;
                }
                const key = `search:${trimmedLabel.toLowerCase()}`;
                const descriptor = `${entry.count} match${entry.count === 1 ? '' : 'es'}`;
                addChip(
                    'fas fa-hashtag',
                    `#${trimmedLabel}`,
                    descriptor,
                    key,
                    {
                        type: 'search',
                        value: trimmedLabel,
                        label: trimmedLabel,
                        tooltip: `Filter matches mentioning ${trimmedLabel}`,
                        aria: `Filter matches mentioning ${trimmedLabel}`,
                    }
                );
            }
        }

        if (Array.isArray(stats.locations)) {
            for (const entry of stats.locations) {
                if (chips.length >= MAX_INSIGHT_CHIPS) {
                    break;
                }
                const rawLabel = typeof entry?.label === 'string' ? entry.label : String(entry?.label || '');
                const trimmedLabel = rawLabel.trim();
                if (!trimmedLabel) {
                    continue;
                }
                const key = `location:${trimmedLabel.toLowerCase()}`;
                const descriptor = `${entry.count} nearby`;
                addChip(
                    'fas fa-location-dot',
                    trimmedLabel,
                    descriptor,
                    key,
                    {
                        type: 'location',
                        value: trimmedLabel,
                        label: trimmedLabel,
                        tooltip: `Filter matches near ${trimmedLabel}`,
                        aria: `Filter matches near ${trimmedLabel}`,
                    }
                );
            }
        }

        if (chips.length < MAX_INSIGHT_CHIPS && state.vibeDisplay) {
            const vibeLabel = state.vibeDisplay.trim();
            if (vibeLabel) {
                const vibeKey = state.vibe ? `vibe:${state.vibe.toLowerCase()}` : `vibe:${vibeLabel.toLowerCase()}`;
                const descriptor = state.vibe ? 'Tap to clear' : 'Preferred vibe';
                addChip(
                    'fas fa-wand-magic-sparkles',
                    vibeLabel,
                    descriptor,
                    vibeKey,
                    {
                        type: 'vibe',
                        value: '',
                        label: '',
                        tooltip: 'Clear vibe filter',
                        aria: 'Clear vibe filter',
                    }
                );
            }
        }

        if (chips.length < MAX_INSIGHT_CHIPS && state.sort && state.sort !== SORT_DEFAULT) {
            addChip(
                'fas fa-arrow-down-wide-short',
                state.sortDisplay,
                'Tap to reset',
                `sort:${state.sort}`,
                {
                    type: 'sort',
                    value: SORT_DEFAULT,
                    label: SORT_LABELS[SORT_DEFAULT],
                    tooltip: 'Return to best fit sorting',
                    aria: 'Reset sorting to best fit',
                }
            );
        }

        if (!chips.length) {
            clearInsightChips();
            return;
        }

        insightChipsContainer.innerHTML = chips.join('');
        insightChipsContainer.hidden = false;
        bindInsightChipActions();
    }

    function bindInsightChipActions() {
        if (!insightChipsContainer) {
            return;
        }
        insightChipsContainer.querySelectorAll('[data-insight-action]').forEach((chip) => {
            chip.addEventListener('click', handleInsightChipActivate);
            chip.addEventListener('keydown', handleInsightChipKeydown);
        });
    }

    function handleInsightChipActivate(event) {
        const chip = event.currentTarget || event.target.closest('[data-insight-action]');
        if (!chip) {
            return;
        }
        const action = chip.dataset.insightAction || '';
        const value = chip.dataset.insightValue || '';
        const label = chip.dataset.insightLabel || value;
        switch (action) {
            case 'search':
            case 'location':
            case 'vibe':
            case 'sort':
                applySuggestion(action, value, label);
                break;
            default:
                break;
        }
    }

    function handleInsightChipKeydown(event) {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }
        event.preventDefault();
        handleInsightChipActivate(event);
    }

    function updateExploreShareLink() {
        if (!shareButton) {
            return;
        }
        shareButton.dataset.shareLink = buildExploreShareLink();
        shareButton.disabled = state.status === 'loading';
    }

    function buildExploreShareLink() {
        const destination = new URL(window.location.href);
        destination.search = '';
        destination.hash = '';
        const hasSearch = typeof state.searchDisplay === 'string' && state.searchDisplay.trim() !== '';
        const hasLocation = typeof state.locationDisplay === 'string' && state.locationDisplay.trim() !== '';
        const hasVibe = typeof state.vibeDisplay === 'string' && state.vibe && state.vibe.trim() !== '';

        if (hasSearch) {
            destination.searchParams.set('search', state.searchDisplay.trim());
        }
        if (hasLocation) {
            destination.searchParams.set('location', state.locationDisplay.trim());
        }
        if (hasVibe) {
            destination.searchParams.set('vibe', state.vibe.trim());
        }
        if (state.sort && state.sort !== SORT_DEFAULT) {
            destination.searchParams.set('sort', state.sort);
        }
        return destination.toString();
    }

    function revealShareFeedback(message) {
        if (!shareFeedback) {
            return;
        }
        shareFeedback.textContent = message;
        shareFeedback.classList.add('is-visible');
        if (shareFeedbackTimer) {
            clearTimeout(shareFeedbackTimer);
        }
        shareFeedbackTimer = setTimeout(() => {
            shareFeedback?.classList.remove('is-visible');
        }, 2800);
    }

    async function copyTextToClipboard(text) {
        const content = typeof text === 'string' ? text : '';
        if (!content.trim()) {
            return false;
        }
        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(content);
                return true;
            } catch (error) {
                // Falls back to manual approach below when clipboard access fails.
            }
        }
        try {
            const textarea = document.createElement('textarea');
            textarea.value = content;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'absolute';
            textarea.style.opacity = '0';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            const succeeded = document.execCommand('copy');
            document.body.removeChild(textarea);
            return succeeded;
        } catch (error) {
            return false;
        }
    }

    function handleRemoveFilter(event) {
        const key = event?.currentTarget?.dataset?.removeFilter;
        if (!key) {
            return;
        }
        removeFilter(key);
    }

    function removeFilter(key) {
        switch (key) {
            case 'search':
                state.search = '';
                state.searchDisplay = '';
                if (searchInput) {
                    searchInput.value = '';
                }
                break;
            case 'location':
                state.location = '';
                state.locationDisplay = '';
                if (locationInput) {
                    locationInput.value = '';
                }
                break;
            case 'vibe':
                state.vibe = '';
                state.vibeDisplay = '';
                if (vibeChips?.length) {
                    vibeChips.forEach((chip, index) => {
                        chip.classList.toggle('explore-vibe-chip--active', index === 0);
                    });
                }
                break;
            case 'sort':
                state.sort = SORT_DEFAULT;
                state.sortDisplay = SORT_LABELS[SORT_DEFAULT];
                if (sortSelect) {
                    sortSelect.value = SORT_DEFAULT;
                }
                break;
            case 'all':
                state.search = '';
                state.searchDisplay = '';
                state.location = '';
                state.locationDisplay = '';
                state.vibe = '';
                state.vibeDisplay = '';
                state.sort = SORT_DEFAULT;
                state.sortDisplay = SORT_LABELS[SORT_DEFAULT];
                if (searchInput) {
                    searchInput.value = '';
                }
                if (locationInput) {
                    locationInput.value = '';
                }
                if (vibeChips?.length) {
                    vibeChips.forEach((chip, index) => {
                        chip.classList.toggle('explore-vibe-chip--active', index === 0);
                    });
                }
                if (sortSelect) {
                    sortSelect.value = SORT_DEFAULT;
                }
                break;
            default:
                return;
        }
        applyExploreFilters();
    }

    function buildExploreCard(cardData, isTopMatch = false) {
        const identifier = escapeHtml(cardData?.id ?? '');
        const rawName = cardData?.name ?? 'Connection';
        const name = escapeHtml(rawName);
        const rawTitle = cardData?.title ?? 'Creative professional';
        const title = escapeHtml(rawTitle);
        const rawLocation = cardData?.location ?? 'Remote';
        const city = escapeHtml(rawLocation);
        const rawImage = cardData?.image ?? defaultAvatar;
        const image = escapeHtml(rawImage || defaultAvatar);
        const rawSummary = cardData?.summary ?? 'Curious, collaborative, and excited to connect.';
        const summary = escapeHtml(rawSummary);
        const tags = Array.isArray(cardData?.tags) ? cardData.tags : [];
        const score = Number.isFinite(cardData?.score) ? cardData.score : 0;
        const rawEmail = cardData?.email ?? '';
        const email = escapeHtml(rawEmail);
        const topMatchClass = isTopMatch ? ' explore-card--top-match' : '';
        const topBadge = isTopMatch
            ? '<span class="explore-card__badge"><i class="fas fa-sparkles"></i>Top match</span>'
            : '';
        const isFavorite = cardData?.id ? favoriteIds.has(cardData.id) : false;
        const favoriteClass = isFavorite ? ' is-active' : '';
        const cardFavoriteClass = isFavorite ? ' explore-card--favorite' : '';
        const ariaLabel = isFavorite
            ? `Remove ${rawName} from saved matches`
            : `Save ${rawName} for later`;
        const encodedTags = encodeFavoriteTags(tags);
        const buttonHintParts = [];
        if (Number.isFinite(cardData?.score)) {
            buttonHintParts.push(`${cardData.score}% match`);
        }
        if (rawTitle) {
            buttonHintParts.push(rawTitle);
        }
        if (rawLocation) {
            buttonHintParts.push(rawLocation);
        }
        const buttonHint = buttonHintParts.length ? ` title="${escapeHtml(buttonHintParts.join(' • '))}"` : '';

        return `
            <article class="explore-card${topMatchClass}${cardFavoriteClass}" data-match-id="${identifier}">
                ${topBadge}
                <button type="button" class="explore-card__favorite${favoriteClass}" data-action="explore-favorite" data-favorite-id="${identifier}" data-favorite-name="${name}" data-favorite-title="${title}" data-favorite-location="${city}" data-favorite-image="${image}" data-favorite-score="${Number.isFinite(cardData?.score) ? cardData.score : ''}" data-favorite-tags="${escapeHtml(encodedTags)}" data-favorite-email="${email}" aria-pressed="${isFavorite ? 'true' : 'false'}" aria-label="${escapeHtml(ariaLabel)}"${buttonHint}>
                    <i class="fas fa-heart"></i>
                </button>
                <div class="explore-card__score">${score}%</div>
                <div class="explore-card__header">
                    <div class="explore-card__avatar">
                        <img src="${image}" alt="${name}" loading="lazy" decoding="async" width="58" height="58" data-fallback="${defaultAvatar}">
                    </div>
                    <div>
                        <p class="explore-card__name">${name}</p>
                        <p class="explore-card__title">${title}</p>
                        <p class="explore-card__meta"><i class="fas fa-location-dot"></i> ${city}</p>
                    </div>
                </div>
                <p class="explore-card__bio">${summary}</p>
                ${renderExploreTags(tags)}
                <div class="explore-card__actions">
                    <button type="button" class="explore-card__cta explore-card__cta--primary" data-action="explore-invite" data-name="${name}">
                        <i class="fas fa-user-plus"></i>
                        Invite
                    </button>
                    <button type="button" class="explore-card__cta explore-card__cta--ghost" data-action="explore-message" data-name="${name}" data-email="${email}">
                        <i class="fas fa-comment-dots"></i>
                        Message
                    </button>
                </div>
            </article>
        `;
    }

    function renderExploreTags(tags) {
        if (!tags.length) {
            return '';
        }
        const markup = tags
            .filter(Boolean)
            .map((tag) => `<span class="explore-card__tag"><i class="fas fa-star"></i>${escapeHtml(tag)}</span>`)
            .join('');
        return `<div class="explore-card__tags">${markup}</div>`;
    }

    function encodeFavoriteTags(tags) {
        if (!Array.isArray(tags) || !tags.length) {
            return '';
        }
        return tags
            .map((tag) => encodeURIComponent(typeof tag === 'string' ? tag : String(tag || '')))
            .join(',');
    }

    function decodeFavoriteTags(value) {
        if (!value) {
            return [];
        }
        return value
            .split(',')
            .map((token) => {
                if (!token) {
                    return '';
                }
                try {
                    return decodeURIComponent(token);
                } catch (error) {
                    return token;
                }
            })
            .map((tag) => tag.trim())
            .filter(Boolean)
            .slice(0, 4);
    }

    function handleFavoriteToggle(button) {
        if (!button) {
            return;
        }
        const id = button.dataset.favoriteId || '';
        if (!id) {
            return;
        }
        if (favoriteIds.has(id)) {
            const removal = removeFavorite(id);
            updateFavoriteButtonState(id, false);
            renderFavoritesBar();
            persistFavorites();
            if (removal?.entry) {
                const remaining = state.favorites.length;
                const status = remaining
                    ? `${removal.entry.name || 'Saved match'} removed. ${remaining}/${FAVORITES_LIMIT} saved. Undo available.`
                    : 'No saved matches remaining. Undo available.';
                announceFavoritesStatus(status);
                showFavoritesUndo({
                    entries: [removal.entry],
                    indices: [removal.index],
                    type: 'single',
                });
            }
            return;
        }
        const payload = matchLookup.get(id) || buildFavoriteFromDataset(button);
        if (!payload) {
            return;
        }
        if (!addFavorite(payload)) {
            return;
        }
        hideFavoritesUndo();
        updateFavoriteButtonState(id, true);
        renderFavoritesBar();
        persistFavorites();
        const savedCount = state.favorites.length;
        const addedMessage = savedCount >= FAVORITES_LIMIT
            ? `${payload.name || 'Match'} saved. Favorites list is full.`
            : `${payload.name || 'Match'} saved. ${savedCount}/${FAVORITES_LIMIT} saved.`;
        announceFavoritesStatus(addedMessage);
        const card = button.closest('.explore-card');
        if (card) {
            card.classList.add('explore-card--flash');
            setTimeout(() => card.classList.remove('explore-card--flash'), 1500);
        }
    }

    function addFavorite(entry) {
        const normalized = normalizeFavoriteEntry(entry);
        if (!normalized) {
            return false;
        }
        const filtered = state.favorites.filter((item) => item.id !== normalized.id);
        filtered.unshift(normalized);
        if (filtered.length > FAVORITES_LIMIT) {
            filtered.length = FAVORITES_LIMIT;
        }
        state.favorites = filtered;
        rebuildFavoriteIds();
        hideFavoritesUndo();
        return true;
    }

    function removeFavorite(id) {
        if (!id) {
            return null;
        }
        const index = state.favorites.findIndex((entry) => entry.id === id);
        if (index === -1) {
            return null;
        }
        const [removed] = state.favorites.splice(index, 1);
        rebuildFavoriteIds();
        if (!removed) {
            return null;
        }
        return {
            entry: { ...removed, tags: Array.isArray(removed.tags) ? [...removed.tags] : [] },
            index,
        };
    }

    function promoteFavorite(id) {
        return moveFavoriteToIndex(id, 0);
    }

    function moveFavoriteBy(id, delta) {
        if (!id || !Number.isFinite(delta) || delta === 0) {
            return false;
        }
        const index = state.favorites.findIndex((entry) => entry.id === id);
        if (index === -1) {
            return false;
        }
        const targetIndex = Math.max(0, Math.min(state.favorites.length - 1, index + Math.trunc(delta)));
        if (targetIndex === index) {
            return false;
        }
        return moveFavoriteToIndex(id, targetIndex);
    }

    function moveFavoriteToIndex(id, targetIndex) {
        if (!id || !Number.isFinite(targetIndex)) {
            return false;
        }
        const clampedTarget = Math.max(0, Math.min(state.favorites.length - 1, Math.trunc(targetIndex)));
        const index = state.favorites.findIndex((entry) => entry.id === id);
        if (index === -1 || index === clampedTarget) {
            return false;
        }
        const [entry] = state.favorites.splice(index, 1);
        if (!entry) {
            return false;
        }
        state.favorites.splice(clampedTarget, 0, entry);
        rebuildFavoriteIds();
        return true;
    }

    function clearAllFavorites() {
        if (!state.favorites.length) {
            return;
        }
        const previousEntries = state.favorites.map((entry) => ({
            ...entry,
            tags: Array.isArray(entry.tags) ? [...entry.tags] : [],
        }));
        const previousIds = state.favorites.map((entry) => entry.id).filter(Boolean);
        state.favorites = [];
        rebuildFavoriteIds();
        hideFavoritesFeedback();
        renderFavoritesBar();
        persistFavorites();
        previousIds.forEach((id) => updateFavoriteButtonState(id, false));
        showFavoritesUndo({
            entries: previousEntries,
            type: 'clear',
        });
        announceFavoritesStatus('Saved matches cleared. Undo available.');
    }

    function rebuildFavoriteIds() {
        favoriteIds.clear();
        state.favorites.forEach((entry) => {
            if (entry?.id) {
                favoriteIds.add(entry.id);
            }
        });
    }

    function updateFavoriteButtonState(id, isFavorite) {
        if (!id) {
            return;
        }
        document.querySelectorAll('[data-action="explore-favorite"]').forEach((button) => {
            if ((button.dataset.favoriteId || '') !== id) {
                return;
            }
            button.classList.toggle('is-active', isFavorite);
            button.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
            const targetName = button.dataset.favoriteName || 'this match';
            const label = isFavorite
                ? `Remove ${targetName} from saved matches`
                : `Save ${targetName} for later`;
            button.setAttribute('aria-label', label);
            const card = button.closest('.explore-card');
            if (card) {
                card.classList.toggle('explore-card--favorite', isFavorite);
            }
        });
    }

    function renderFavoritesBar() {
        if (!favoritesBar || !favoritesContent) {
            return;
        }
        const count = state.favorites.length;
        const isFull = count >= FAVORITES_LIMIT;
        favoritesBar.dataset.count = String(count);
        favoritesBar.dataset.limit = String(FAVORITES_LIMIT);
        favoritesBar.classList.toggle('explore-favorites--full', isFull);
        favoritesBar.classList.toggle('explore-favorites--empty', count === 0);

        if (favoritesHeader) {
            favoritesHeader.hidden = false;
            favoritesHeader.classList.toggle('is-empty', count === 0);
        }
        if (favoritesCountDisplay) {
            const baseText = `${count}/${FAVORITES_LIMIT} saved`;
            favoritesCountDisplay.textContent = isFull ? `${baseText} • List full` : baseText;
            favoritesCountDisplay.dataset.state = isFull ? 'full' : (count ? 'active' : 'idle');
        }
        if (favoritesClearButton) {
            const disabled = count === 0;
            favoritesClearButton.disabled = disabled;
            favoritesClearButton.setAttribute('aria-disabled', disabled ? 'true' : 'false');
            favoritesClearButton.classList.toggle('is-disabled', disabled);
        }
        if (favoritesScrollButton) {
            const shouldShow = count > 2;
            favoritesScrollButton.hidden = !shouldShow;
            favoritesScrollButton.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
        }
        syncFavoritesCopyButton();
        renderFavoritesSummary(state.favorites);

        if (!count) {
            hideFavoritesFeedback();
            favoritesContent.innerHTML = `<span class="explore-favorites__empty"><i class="fas fa-heart-circle-plus"></i> Save standout matches to revisit quickly (up to ${FAVORITES_LIMIT}).</span>`;
            return;
        }

        const chipsMarkup = state.favorites
            .map((favorite, index, collection) => buildFavoriteChipMarkup(favorite, index, collection.length))
            .join('');
        const limitNotice = isFull
            ? '<div class="explore-favorites__limit" role="status"><i class="fas fa-circle-exclamation"></i>Saved list is full. Remove one to add another.</div>'
            : '';
        favoritesContent.innerHTML = chipsMarkup + limitNotice;
    }

    function renderFavoritesSummary(favorites) {
        if (!favoritesSummaryContainer || !favoritesSummaryChips) {
            return;
        }
        bindFavoritesSummaryInteractions();
        if (!Array.isArray(favorites) || !favorites.length) {
            favoritesSummaryContainer.hidden = true;
            favoritesSummaryChips.innerHTML = '';
            favoritesSummaryLockedType = '';
            favoritesSummaryLockedValue = '';
            clearFavoritesSummaryHighlight({ silent: true });
            return;
        }
        const chips = buildFavoritesSummaryChips(favorites);
        if (!chips.length) {
            favoritesSummaryContainer.hidden = true;
            favoritesSummaryChips.innerHTML = '';
            favoritesSummaryLockedType = '';
            favoritesSummaryLockedValue = '';
            clearFavoritesSummaryHighlight({ silent: true });
            return;
        }
        favoritesSummaryContainer.hidden = false;
        favoritesSummaryChips.innerHTML = chips.join('');
        if (!restoreFavoritesSummaryLock({ announce: false })) {
            clearFavoritesSummaryHighlight({ silent: true });
        }
    }

    function buildFavoritesSummaryChips(favorites) {
        const detailChips = [];
        const topLocations = getTopCountedValues(
            favorites.map((favorite) => favorite?.location || ''),
            2,
        );
        const topTags = getTopCountedValues(
            favorites.flatMap((favorite) => (Array.isArray(favorite?.tags) ? favorite.tags : [])),
            2,
        );
        const averageScore = getAverageFavoriteScore(favorites);

        topLocations.forEach((entry) => {
            const nameMatches = collectFavoriteNames(
                favorites,
                (favorite) => normalizeSummaryToken(favorite?.location || '') === entry.key,
            );
            const remainingMatches = Math.max(0, entry.count - nameMatches.length);
            const nameSummary = formatSummaryNameList(nameMatches, remainingMatches);
            const description = entry.count > 1
                ? `Top location ${entry.label}, ${entry.count} favorites`
                : `Top location ${entry.label}`;
            detailChips.push(buildFavoritesSummaryChip('fas fa-map-pin', entry.label, entry.count, {
                type: 'location',
                value: entry.key,
                display: entry.label,
                description,
                names: nameMatches,
                remaining: remainingMatches,
            }));
        });

        topTags.forEach((entry) => {
            const label = entry.label.startsWith('#') ? entry.label : `#${entry.label}`;
            const tagMatches = collectFavoriteNames(
                favorites,
                (favorite) => Array.isArray(favorite?.tags)
                    ? favorite.tags.some((tag) => normalizeSummaryToken(tag) === entry.key)
                    : false,
            );
            const remainingMatches = Math.max(0, entry.count - tagMatches.length);
            const nameSummary = formatSummaryNameList(tagMatches, remainingMatches);
            const description = entry.count > 1
                ? `Popular tag ${label}, ${entry.count} favorites`
                : `Popular tag ${label}`;
            detailChips.push(buildFavoritesSummaryChip('fas fa-hashtag', label, entry.count, {
                type: 'tag',
                value: entry.key,
                display: label,
                description,
                names: tagMatches,
                remaining: remainingMatches,
            }));
        });

        const highestScoreValue = getHighestFavoriteScoreValue(favorites);
        const chips = detailChips.slice(0, averageScore !== null ? 3 : 4);
        if (averageScore !== null) {
            const scoreDescriptionParts = [`Average match score ${averageScore} percent`];
            let topScoreNames = [];
            let remainingTopScore = 0;
            if (highestScoreValue !== null) {
                const topScoreFavorites = favorites.filter((favorite) => Number(favorite?.score) === highestScoreValue);
                topScoreNames = collectFavoriteNames(favorites, (favorite) => Number(favorite?.score) === highestScoreValue);
                remainingTopScore = Math.max(0, topScoreFavorites.length - topScoreNames.length);
                const tiedCount = topScoreFavorites.length;
                scoreDescriptionParts.push(
                    tiedCount > 1
                        ? `Highest match ${highestScoreValue}% across ${tiedCount} favorites`
                        : `Highest match ${highestScoreValue}%`
                );
            }
            const scoreDescription = scoreDescriptionParts.join('. ');
            chips.push(buildFavoritesSummaryChip('fas fa-wand-magic-sparkles', `${averageScore}% avg match`, null, {
                type: 'score',
                value: 'score',
                display: `${averageScore}% avg match`,
                description: scoreDescription,
                names: topScoreNames,
                remaining: remainingTopScore,
            }));
        }

        return chips;
    }

    function normalizeSummaryToken(value) {
        if (typeof value !== 'string') {
            return '';
        }
        const trimmed = value.trim();
        if (!trimmed) {
            return '';
        }
        const withoutHash = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
        return withoutHash.toLowerCase().replace(/\s+/g, ' ');
    }

    function collectFavoriteNames(favorites, predicate, limit = 3) {
        if (!Array.isArray(favorites) || !favorites.length) {
            return [];
        }
        const results = [];
        favorites.forEach((favorite) => {
            if (results.length >= limit) {
                return;
            }
            if (!predicate(favorite)) {
                return;
            }
            const name = typeof favorite?.name === 'string' ? favorite.name.trim() : '';
            if (name) {
                results.push(name);
            }
        });
        return results;
    }

    function formatSummaryNameList(names, remaining) {
        if (!Array.isArray(names) || !names.length) {
            if (remaining <= 0) {
                return '';
            }
            const moreLabel = remaining === 1 ? 'favorite' : 'favorites';
            return `${remaining} more ${moreLabel}`;
        }
        const joined = names.join(', ');
        if (remaining > 0) {
            const moreLabel = remaining === 1 ? 'favorite' : 'favorites';
            return `${joined}, plus ${remaining} more ${moreLabel}`;
        }
        return joined;
    }

    function getTopCountedValues(values, limit) {
        const counts = new Map();
        values
            .map((value) => (typeof value === 'string' ? value.trim() : ''))
            .filter(Boolean)
            .forEach((value) => {
                const key = normalizeSummaryToken(value);
                if (!key) {
                    return;
                }
                const existing = counts.get(key);
                if (existing) {
                    existing.count += 1;
                } else {
                    counts.set(key, { count: 1, label: value, key });
                }
            });
        return Array.from(counts.values())
            .sort((a, b) => {
                if (b.count !== a.count) {
                    return b.count - a.count;
                }
                return a.label.localeCompare(b.label);
            })
            .slice(0, Math.max(0, limit));
    }

    function getAverageFavoriteScore(favorites) {
        const scores = favorites
            .map((favorite) => Number.isFinite(favorite?.score) ? Number(favorite.score) : null)
            .filter((value) => value !== null);
        if (!scores.length) {
            return null;
        }
        const total = scores.reduce((sum, score) => sum + score, 0);
        return Math.round(total / scores.length);
    }

    function getHighestFavoriteScoreValue(favorites) {
        if (!Array.isArray(favorites) || !favorites.length) {
            return null;
        }
        let maxScore = Number.NEGATIVE_INFINITY;
        favorites.forEach((favorite) => {
            const score = Number(favorite?.score);
            if (Number.isFinite(score) && score > maxScore) {
                maxScore = score;
            }
        });
        if (maxScore === Number.NEGATIVE_INFINITY) {
            return null;
        }
        return maxScore;
    }

    function buildFavoritesSummaryChip(icon, label, count, options = {}) {
        const safeIcon = escapeHtml(icon);
        const safeLabel = escapeHtml(label);
        const showCount = Number.isFinite(count) && count > 1;
        const visualCount = showCount ? `(${count})` : '';
        const typeToken = typeof options.type === 'string' ? options.type.trim().toLowerCase() : '';
        const valueToken = typeof options.value === 'string' ? options.value.trim() : '';
        const description = typeof options.description === 'string' ? options.description.trim() : '';
        const names = Array.isArray(options.names) ? options.names.filter((name) => typeof name === 'string' && name.trim()) : [];
        const remaining = Number.isFinite(options.remaining) ? Math.max(0, Math.trunc(options.remaining)) : 0;
        const nameSummary = formatSummaryNameList(names, remaining);
        const serializedNames = names.length ? names.map((name) => name.trim()).filter(Boolean).join('|') : '';
        const attrParts = [];
        if (typeToken) {
            attrParts.push(`data-summary-type="${escapeHtml(typeToken)}"`);
        }
        if (valueToken) {
            attrParts.push(`data-summary-value="${escapeHtml(valueToken)}"`);
        }
        if (typeof options.display === 'string' && options.display.trim()) {
            attrParts.push(`data-summary-display="${escapeHtml(options.display.trim())}"`);
        }
        if (serializedNames) {
            attrParts.push(`data-summary-names="${escapeHtml(serializedNames)}"`);
        }
        attrParts.push(`data-summary-remaining="${escapeHtml(String(remaining))}"`);
        const attrString = attrParts.length ? ` ${attrParts.join(' ')}` : '';
        let accessibleLabel = description || (showCount ? `${label} appears in ${count} favorites` : label);
        if (nameSummary) {
            const includePhrase = `Includes ${nameSummary}.`;
            accessibleLabel = accessibleLabel ? `${accessibleLabel}. ${includePhrase}` : includePhrase;
        }
        if (!accessibleLabel) {
            accessibleLabel = label;
        }
        const safeAccessibleLabel = escapeHtml(accessibleLabel);
        const tooltipPieces = [];
        if (nameSummary) {
            tooltipPieces.push(`Includes ${nameSummary}`);
        }
        if (showCount) {
            tooltipPieces.push(`${count} favorite${count === 1 ? '' : 's'}`);
        }
        const titleAttr = tooltipPieces.length ? ` title="${escapeHtml(tooltipPieces.join(' • '))}"` : '';
        const parts = [
            `<button type="button" class="explore-favorites__summary-chip"${attrString}${titleAttr} aria-label="${safeAccessibleLabel}" aria-pressed="false" aria-haspopup="true" aria-expanded="false" aria-controls="favoritesSummaryDetail">`,
            `<i class="${safeIcon}"></i>`,
            `<span class="explore-favorites__summary-text">${safeLabel}</span>`,
        ];
        if (visualCount) {
            parts.push(`<span class="explore-favorites__summary-count">${escapeHtml(visualCount)}</span>`);
        }
        parts.push('</button>');
        return parts.join('');
    }

    // Link summary chips with the saved list for quicker pattern spotting.
    function bindFavoritesSummaryInteractions() {
        if (!favoritesSummaryContainer || favoritesSummaryInteractionsBound) {
            return;
        }
        favoritesSummaryContainer.addEventListener('pointerover', handleFavoritesSummaryPointerOver);
        favoritesSummaryContainer.addEventListener('pointerleave', handleFavoritesSummaryPointerLeave);
        favoritesSummaryContainer.addEventListener('focusin', handleFavoritesSummaryFocusIn);
        favoritesSummaryContainer.addEventListener('focusout', handleFavoritesSummaryFocusOut);
    favoritesSummaryContainer.addEventListener('click', handleFavoritesSummaryClick);
    favoritesSummaryContainer.addEventListener('keydown', handleFavoritesSummaryKeydown);
        favoritesSummaryInteractionsBound = true;
    }

    function bindFavoritesSummaryDetailActions() {
        if (!favoritesSummaryDetail || favoritesSummaryDetailActionsBound) {
            return;
        }
        favoritesSummaryDetail.addEventListener('click', handleFavoritesSummaryDetailClick);
        favoritesSummaryDetail.addEventListener('keydown', handleFavoritesSummaryDetailKeydown);
        favoritesSummaryDetailActionsBound = true;
    }

    function handleFavoritesSummaryDetailClick(event) {
        const control = event.target.closest('[data-action]');
        if (!control || !favoritesSummaryDetail?.contains(control)) {
            return;
        }
        const action = control.dataset.action;
        if (!action) {
            return;
        }
        if (favoritesSummaryDetailActionFromKeyboard) {
            favoritesSummaryDetailActionFromKeyboard = false;
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        performFavoritesSummaryDetailAction(action);
    }

    function handleFavoritesSummaryDetailKeydown(event) {
        const isCopyShortcut = (event.ctrlKey || event.metaKey) && (event.key === 'c' || event.key === 'C');
        if (isCopyShortcut) {
            event.preventDefault();
            event.stopPropagation();
            favoritesSummaryDetailActionFromKeyboard = true;
            copyFavoritesSummaryDetail()
                .catch((error) => {
                    console.warn('Unable to copy highlight details', error);
                    announceFavoritesSummaryStatus('Clipboard blocked. Copy highlight details manually.');
                })
                .finally(() => {
                    window.requestAnimationFrame(() => {
                        favoritesSummaryDetailActionFromKeyboard = false;
                    });
                });
            return;
        }
        const control = event.target.closest('[data-action]');
        if (!control || !favoritesSummaryDetail?.contains(control)) {
            return;
        }
        const { key } = event;
        if (key !== 'Enter' && key !== ' ') {
            return;
        }
        const action = control.dataset.action;
        if (!action) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        favoritesSummaryDetailActionFromKeyboard = true;
        performFavoritesSummaryDetailAction(action);
        window.requestAnimationFrame(() => {
            favoritesSummaryDetailActionFromKeyboard = false;
        });
    }

    function performFavoritesSummaryDetailAction(action) {
        if (action === 'favorites-summary-focus') {
            focusFavoritesSummaryDetailTarget();
        } else if (action === 'favorites-summary-copy') {
            copyFavoritesSummaryDetail().catch((error) => {
                console.warn('Unable to copy highlight details', error);
                announceFavoritesSummaryStatus('Clipboard blocked. Copy highlight details manually.');
            });
        }
    }

    function focusFavoritesSummaryDetailTarget() {
        if (!favoritesSummaryDetail) {
            return;
        }
        const hasMatches = favoritesSummaryDetail.dataset.highlightHasMatches === 'true';
        if (!hasMatches) {
            return;
        }
        const type = favoritesSummaryDetail.dataset.highlightType || favoritesSummaryActiveType;
        const value = favoritesSummaryDetail.dataset.highlightValue || favoritesSummaryActiveValue;
        if (!type) {
            return;
        }
        focusFirstFavoriteForSummary(type, value);
    }

    function focusFavoritesSummaryDetailButton() {
        if (!favoritesSummaryDetail || favoritesSummaryDetail.hidden) {
            return;
        }
        const button = favoritesSummaryDetail.querySelector('[data-action="favorites-summary-focus"]');
        if (!button) {
            return;
        }
        window.requestAnimationFrame(() => {
            if (typeof button.focus === 'function') {
                button.focus();
            }
        });
    }

    async function copyFavoritesSummaryDetail() {
        if (!favoritesSummaryDetail) {
            return;
        }
        const hasMatches = favoritesSummaryDetail.dataset.highlightHasMatches === 'true';
        const payload = favoritesSummaryDetail.dataset.highlightCopy || '';
        const copyButton = getFavoritesSummaryDetailCopyButton();
        if (!hasMatches || !payload.trim()) {
            announceFavoritesSummaryStatus('No highlight details available to copy yet.');
            return;
        }
        const success = await copyTextToClipboard(payload);
        if (success) {
            announceFavoritesSummaryStatus('Highlight details copied to clipboard.');
            markFavoritesSummaryDetailCopied();
            if (copyButton && typeof copyButton.focus === 'function') {
                copyButton.focus();
            }
        } else {
            announceFavoritesSummaryStatus('Clipboard blocked. Copy highlight details manually.');
            resetFavoritesSummaryDetailCopyState();
        }
    }

    function getFavoritesSummaryDetailCopyButton() {
        if (!favoritesSummaryDetail || favoritesSummaryDetail.hidden) {
            return null;
        }
        return favoritesSummaryDetail.querySelector('[data-action="favorites-summary-copy"]');
    }

    function resetFavoritesSummaryDetailCopyState() {
        if (favoritesSummaryCopyResetTimer) {
            window.clearTimeout(favoritesSummaryCopyResetTimer);
            favoritesSummaryCopyResetTimer = null;
        }
        const button = getFavoritesSummaryDetailCopyButton();
        if (!button) {
            return;
        }
        button.classList.remove('is-copied');
        button.dataset.copied = 'false';
        const labelNode = button.querySelector('.explore-favorites__summary-detail-button-label');
        const defaultLabel = button.dataset.originalLabel || (labelNode?.textContent || 'Copy names');
        const defaultAria = button.dataset.originalAriaLabel || button.getAttribute('aria-label') || 'Copy highlight names to clipboard';
        const icon = button.querySelector('i');
        if (labelNode) {
            labelNode.textContent = defaultLabel;
        }
        button.setAttribute('aria-label', defaultAria);
        if (icon) {
            icon.classList.remove('fa-check');
            icon.classList.add('fa-copy');
        }
    }

    function markFavoritesSummaryDetailCopied() {
        const button = getFavoritesSummaryDetailCopyButton();
        if (!button) {
            return;
        }
        const labelNode = button.querySelector('.explore-favorites__summary-detail-button-label');
        const icon = button.querySelector('i');
        button.classList.add('is-copied');
        button.dataset.copied = 'true';
        if (labelNode) {
            labelNode.textContent = 'Copied!';
        }
        button.setAttribute('aria-label', 'Highlight details copied to clipboard');
        if (icon) {
            icon.classList.remove('fa-copy');
            icon.classList.add('fa-check');
        }
        if (favoritesSummaryCopyResetTimer) {
            window.clearTimeout(favoritesSummaryCopyResetTimer);
        }
        favoritesSummaryCopyResetTimer = window.setTimeout(() => {
            favoritesSummaryCopyResetTimer = null;
            resetFavoritesSummaryDetailCopyState();
        }, 2200);
    }

    function handleFavoritesSummaryPointerOver(event) {
        const chip = event.target.closest('[data-summary-type]');
        if (!chip || !favoritesSummaryContainer?.contains(chip)) {
            return;
        }
        if (favoritesSummaryLockedType && favoritesSummaryLockedValue) {
            return;
        }
        const type = chip.dataset.summaryType || '';
        const value = chip.dataset.summaryValue || '';
        if (!type) {
            return;
        }
        setSummaryChipActive(chip);
        const display = getSummaryDisplayText(chip);
        applyFavoritesSummaryHighlight(type, value, display, { locked: false, silent: false });
    }

    function handleFavoritesSummaryPointerLeave() {
        if (favoritesSummaryLockedType && favoritesSummaryLockedValue) {
            restoreFavoritesSummaryLock({ announce: false });
            return;
        }
        clearFavoritesSummaryHighlight();
    }

    function handleFavoritesSummaryFocusIn(event) {
        const chip = event.target.closest('[data-summary-type]');
        if (!chip || !favoritesSummaryContainer?.contains(chip)) {
            return;
        }
        if (favoritesSummaryLockedType && favoritesSummaryLockedValue) {
            return;
        }
        const type = chip.dataset.summaryType || '';
        const value = chip.dataset.summaryValue || '';
        if (!type) {
            return;
        }
        setSummaryChipActive(chip);
        const display = getSummaryDisplayText(chip);
        applyFavoritesSummaryHighlight(type, value, display);
    }

    function handleFavoritesSummaryFocusOut(event) {
        const nextTarget = event.relatedTarget;
        if (nextTarget && favoritesSummaryContainer?.contains(nextTarget)) {
            return;
        }
        if (favoritesSummaryLockedType && favoritesSummaryLockedValue) {
            restoreFavoritesSummaryLock({ announce: false });
            return;
        }
        clearFavoritesSummaryHighlight();
    }

    function handleFavoritesSummaryClick(event) {
        const chip = event.target.closest('[data-summary-type]');
        if (!chip || !favoritesSummaryContainer?.contains(chip)) {
            return;
        }
        const type = chip.dataset.summaryType || '';
        const value = chip.dataset.summaryValue || '';
        if (!type) {
            return;
        }
        const activatedFromKeyboard = favoritesSummaryKeyboardActivation;
        favoritesSummaryKeyboardActivation = false;
        const isToggleable = favoritesSummaryLockedType === type && favoritesSummaryLockedValue === value;
        if (isToggleable) {
            favoritesSummaryLockedType = '';
            favoritesSummaryLockedValue = '';
            chip.classList.remove('is-locked');
            clearFavoritesSummaryHighlight({ silent: true });
            announceFavoritesSummaryStatus('Favorites highlight cleared.');
            return;
        }
        favoritesSummaryLockedType = type;
        favoritesSummaryLockedValue = value;
        setSummaryChipActive(chip);
        const display = getSummaryDisplayText(chip);
        applyFavoritesSummaryHighlight(type, value, display, { locked: true });
        if (activatedFromKeyboard) {
            focusFavoritesSummaryDetailButton();
        } else {
            focusFirstFavoriteForSummary(type, value);
        }
    }

    function handleFavoritesSummaryKeydown(event) {
        if (!favoritesSummaryChips) {
            return;
        }
        const key = event.key;
        const isNavigationKey = key === 'ArrowRight' || key === 'ArrowLeft' || key === 'ArrowUp' || key === 'ArrowDown' || key === 'Home' || key === 'End';
        const isActivationKey = key === 'Enter' || key === ' ';
        if (!isNavigationKey && !isActivationKey) {
            return;
        }
        const chips = Array.from(favoritesSummaryChips.querySelectorAll('[data-summary-type]'));
        if (!chips.length) {
            return;
        }
        const activeElement = document.activeElement;
        let index = chips.indexOf(activeElement);
        if (isActivationKey) {
            if (index !== -1) {
                event.preventDefault();
                favoritesSummaryKeyboardActivation = true;
                chips[index].click();
                favoritesSummaryKeyboardActivation = false;
            }
            return;
        }
        event.preventDefault();
        if (index === -1) {
            index = 0;
        }
        let nextIndex = index;
        if (key === 'ArrowRight' || key === 'ArrowDown') {
            nextIndex = (index + 1) % chips.length;
        } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
            nextIndex = (index - 1 + chips.length) % chips.length;
        } else if (key === 'Home') {
            nextIndex = 0;
        } else if (key === 'End') {
            nextIndex = chips.length - 1;
        }
        const targetChip = chips[nextIndex];
        if (targetChip && typeof targetChip.focus === 'function') {
            targetChip.focus();
        }
    }

    function applyFavoritesSummaryHighlight(type, value, displayLabel = '', options = {}) {
        if (!favoritesContent) {
            return;
        }
        favoritesSummaryActiveType = type;
        favoritesSummaryActiveValue = value;
        const summaryChip = favoritesSummaryChips
            ? favoritesSummaryChips.querySelector(`[data-summary-type="${escapeSelector(type)}"][data-summary-value="${escapeSelector(value)}"]`)
            : null;
        const chips = Array.from(favoritesContent.querySelectorAll('.explore-favorite-chip[data-favorite-id]'));
        if (!chips.length) {
            return;
        }
        let matches = [];
        let maxScore = null;
        if (type === 'location') {
            matches = chips.filter((chip) => (chip.dataset.favoriteLocation || '') === value);
        } else if (type === 'tag') {
            matches = chips.filter((chip) => {
                const tokens = (chip.dataset.favoriteTags || '').split('|').filter(Boolean);
                return tokens.includes(value);
            });
        } else if (type === 'score') {
            const highest = getHighestFavoriteScoreValue(state.favorites);
            if (Number.isFinite(highest)) {
                matches = chips.filter((chip) => Number(chip.dataset.favoriteScore) === highest);
                maxScore = highest;
            }
        }
        const matchSet = new Set(matches);
        const shouldDim = matchSet.size > 0;
        chips.forEach((chip) => {
            const isMatch = matchSet.has(chip);
            chip.classList.toggle('is-summary-highlight', isMatch);
            chip.classList.toggle('is-summary-muted', shouldDim && !isMatch);
        });
        updateFavoritesSummaryChipStates(type, value, options.locked === true);
        const matchCount = matchSet.size;
        const effectiveLabel = (displayLabel || value || '').trim();
        const namesDetail = getSummaryNamesDetail(summaryChip, matchCount);
        const namesList = summaryChip?.dataset.summaryNames
            ? summaryChip.dataset.summaryNames.split('|').map((name) => name.trim()).filter(Boolean)
            : [];
        const remainingAttr = summaryChip?.dataset.summaryRemaining;
        const remainingNames = Number.isFinite(Number(remainingAttr))
            ? Math.max(0, Number(remainingAttr))
            : 0;
        let emptyMessage = '';
        let highlightMessage = '';
        if (type === 'location') {
            if (matchCount) {
                highlightMessage = `Highlighting ${matchCount} saved favorite${matchCount > 1 ? 's' : ''} in ${effectiveLabel || 'this location'}.`;
            } else {
                highlightMessage = effectiveLabel
                    ? `No saved favorites currently in ${effectiveLabel}.`
                    : 'No saved favorites currently in this location.';
                emptyMessage = effectiveLabel
                    ? `No saved favorites in ${effectiveLabel} yet. Save a match here to unlock this highlight.`
                    : 'No saved favorites in this location yet. Save a match here to unlock this highlight.';
            }
        } else if (type === 'tag') {
            if (matchCount) {
                highlightMessage = `Highlighting ${matchCount} saved favorite${matchCount > 1 ? 's' : ''} with ${effectiveLabel || 'this tag'}.`;
            } else {
                highlightMessage = effectiveLabel
                    ? `No saved favorites currently tagged ${effectiveLabel}.`
                    : 'No saved favorites currently tagged with this highlight.';
                emptyMessage = effectiveLabel
                    ? `No saved favorites tagged ${effectiveLabel} yet. Add this highlight to a favorite to reveal more.`
                    : 'No saved favorites carry this highlight yet. Tag a favorite to reveal more.';
            }
        } else if (type === 'score') {
            if (matchCount && Number.isFinite(maxScore)) {
                highlightMessage = matchCount === 1
                    ? `Highlighting top saved match at ${maxScore}% match score.`
                    : `Highlighting ${matchCount} top saved matches tied at ${maxScore}% match score.`;
            } else {
                highlightMessage = 'No match score highlight available yet.';
                emptyMessage = 'No match score highlight yet. Save more favorites with AI scores to surface this view.';
            }
        }
        if (matchCount && namesDetail) {
            if (highlightMessage.endsWith('.')) {
                highlightMessage = highlightMessage.slice(0, -1);
            }
            highlightMessage = `${highlightMessage}, including ${namesDetail}.`;
        }
        if (options.locked && highlightMessage) {
            highlightMessage = `${highlightMessage} Press Escape to clear.`;
        }
        renderFavoritesSummaryDetail({
            type,
            displayLabel: effectiveLabel,
            namesDetail,
            matchCount,
            emptyMessage,
            namesList,
            remainingNames,
            highlightValue: value,
            locked: options.locked === true,
        });
        if (options.silent) {
            return;
        }
        announceFavoritesSummaryStatus(highlightMessage);
    }

    function focusFirstFavoriteForSummary(type, value) {
        if (!favoritesContent) {
            return;
        }
        const chips = Array.from(favoritesContent.querySelectorAll('.explore-favorite-chip[data-favorite-id]'));
        if (!chips.length) {
            return;
        }
        let target = null;
        if (type === 'location') {
            target = chips.find((chip) => (chip.dataset.favoriteLocation || '') === value) || null;
        } else if (type === 'tag') {
            target = chips.find((chip) => {
                const tokens = (chip.dataset.favoriteTags || '').split('|').filter(Boolean);
                return tokens.includes(value);
            }) || null;
        } else if (type === 'score') {
            const highest = getHighestFavoriteScoreValue(state.favorites);
            if (Number.isFinite(highest)) {
                target = chips.find((chip) => Number(chip.dataset.favoriteScore) === highest) || null;
            }
        }
        if (!target) {
            return;
        }
        const id = target.dataset.favoriteId || '';
        if (!id) {
            return;
        }
        focusFavoriteChipById(id);
        scrollToFavoriteCard(id);
    }

    function clearFavoritesSummaryHighlight(options = {}) {
        favoritesSummaryActiveType = '';
        favoritesSummaryActiveValue = '';
        setSummaryChipActive(null);
        updateFavoritesSummaryChipStates('', '', false);
        if (!options.silent) {
            announceFavoritesSummaryStatus('');
        }
        clearFavoritesSummaryDetail();
        if (!favoritesContent) {
            return;
        }
        favoritesContent.querySelectorAll('.explore-favorite-chip').forEach((chip) => {
            chip.classList.remove('is-summary-highlight', 'is-summary-muted');
        });
    }

    function setSummaryChipActive(chip) {
        if (!favoritesSummaryChips) {
            return;
        }
        favoritesSummaryChips.querySelectorAll('[data-summary-type]').forEach((node) => {
            const isActive = node === chip;
            node.classList.toggle('is-active', isActive);
            if (isActive) {
                node.setAttribute('aria-describedby', 'favoritesSummaryDetail');
            } else {
                node.removeAttribute('aria-describedby');
            }
            node.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        });
    }

    function getSummaryDisplayText(chip) {
        if (!chip) {
            return '';
        }
        const datasetDisplay = chip.dataset.summaryDisplay || chip.dataset.summaryValue || '';
        if (datasetDisplay) {
            return datasetDisplay;
        }
        const textNode = chip.querySelector('.explore-favorites__summary-text');
        if (textNode?.textContent) {
            return textNode.textContent.trim();
        }
        return typeof chip.textContent === 'string' ? chip.textContent.trim() : '';
    }

    function getSummaryNamesDetail(chip, matchCount) {
        if (!chip || !matchCount) {
            return '';
        }
        const namesAttr = chip.dataset.summaryNames || '';
        const remainingAttr = chip.dataset.summaryRemaining;
        const names = namesAttr
            .split('|')
            .map((name) => name.trim())
            .filter(Boolean);
        const remaining = Number.isFinite(Number(remainingAttr)) ? Math.max(0, Number(remainingAttr)) : 0;
        return formatSummaryNameList(names, remaining);
    }

    function renderFavoritesSummaryDetail(payload) {
        if (!favoritesSummaryDetail) {
            return;
        }
        const type = payload?.type || '';
        const matchCount = Number.isFinite(Number(payload?.matchCount)) ? Number(payload.matchCount) : 0;
        const displayLabel = typeof payload?.displayLabel === 'string' ? payload.displayLabel.trim() : '';
        const namesDetail = typeof payload?.namesDetail === 'string' ? payload.namesDetail.trim() : '';
        const locked = Boolean(payload?.locked);
        const emptyMessage = typeof payload?.emptyMessage === 'string' ? payload.emptyMessage.trim() : '';
        const namesList = Array.isArray(payload?.namesList)
            ? payload.namesList.map((name) => (typeof name === 'string' ? name.trim() : '')).filter(Boolean)
            : [];
        const remainingNames = Number.isFinite(Number(payload?.remainingNames)) ? Math.max(0, Number(payload.remainingNames)) : 0;
        const highlightValue = typeof payload?.highlightValue === 'string' ? payload.highlightValue : '';
        if (!matchCount && !emptyMessage) {
            clearFavoritesSummaryDetail();
            return;
        }
        const icon = type === 'location'
            ? 'fas fa-map-pin'
            : type === 'tag'
                ? 'fas fa-hashtag'
                : 'fas fa-wand-magic-sparkles';
        const scopeLabel = displayLabel || (type === 'score' ? 'Top match score' : 'Highlight');
        const details = [];
        if (matchCount) {
            if (scopeLabel) {
                details.push(scopeLabel);
            }
            if (namesDetail) {
                details.push(`Includes ${namesDetail}`);
            } else {
                details.push(`Includes ${matchCount} saved favorite${matchCount === 1 ? '' : 's'}`);
            }
        } else if (emptyMessage) {
            details.push(emptyMessage);
        }
        if (locked) {
            details.push('Locked highlight');
        }
        let copyPayload = '';
        if (matchCount) {
            const copyLines = [];
            const headerLine = scopeLabel ? scopeLabel : 'Highlight';
            const countLine = `${matchCount} saved match${matchCount === 1 ? '' : 'es'}`;
            copyLines.push(`${headerLine} — ${countLine}`);
            if (namesList.length) {
                const baseNames = namesList.join(', ');
                const moreSuffix = remainingNames > 0 ? ` (+${remainingNames} more)` : '';
                copyLines.push(`Names: ${baseNames}${moreSuffix}`);
            } else if (namesDetail) {
                copyLines.push(`Includes ${namesDetail}`);
            }
            if (locked) {
                copyLines.push('Highlight locked');
            }
            copyPayload = copyLines.join('\n');
        }
        const rawDetails = details.join(' • ');
        const safeDetails = escapeHtml(rawDetails);
        const fragments = [
            `<i class="${icon}" aria-hidden="true"></i>`,
            `<span class="explore-favorites__summary-detail-text">${safeDetails}</span>`,
        ];
        let accessibleNamesSummary = '';
        if (matchCount && namesList.length) {
            const badgeMarkup = namesList
                .map((name) => `<span class="explore-favorites__summary-detail-name" aria-hidden="true">${escapeHtml(name)}</span>`)
                .join('');
            const remainingMarkup = remainingNames > 0
                ? `<span class="explore-favorites__summary-detail-name explore-favorites__summary-detail-name--more" aria-hidden="true">+${escapeHtml(String(remainingNames))} more</span>`
                : '';
            const badges = `<span class="explore-favorites__summary-detail-names" aria-hidden="true">${badgeMarkup}${remainingMarkup}</span>`;
            fragments.push(badges);
            accessibleNamesSummary = `Names: ${namesList.join(', ')}${remainingNames > 0 ? `, plus ${remainingNames} more` : ''}.`;
        } else if (matchCount && namesDetail) {
            accessibleNamesSummary = `Names: ${namesDetail}.`;
        }
        if (matchCount) {
            const viewMatchesLabel = matchCount === 1 ? 'View match' : `View ${matchCount} matches`;
            const safeViewLabel = escapeHtml(viewMatchesLabel);
            const fullAriaLabel = escapeHtml(`${viewMatchesLabel} in saved list`);
            fragments.push(
                `<button type="button" class="explore-favorites__summary-detail-button" data-action="favorites-summary-focus" aria-label="${fullAriaLabel}"><i class="fas fa-arrow-down-long" aria-hidden="true"></i><span class="explore-favorites__summary-detail-button-label">${safeViewLabel}</span><span class="visually-hidden"> in saved list</span></button>`
            );
            const copyLabel = matchCount === 1 ? 'Copy name' : 'Copy names';
            const safeCopyLabel = escapeHtml(copyLabel);
            const copyAria = matchCount === 1 ? 'Copy highlight name to clipboard' : 'Copy highlight names to clipboard';
            const fullCopyAria = escapeHtml(copyAria);
            fragments.push(
                `<button type="button" class="explore-favorites__summary-detail-button explore-favorites__summary-detail-button--copy" data-action="favorites-summary-copy" aria-label="${fullCopyAria}" data-original-label="${safeCopyLabel}" data-original-aria-label="${fullCopyAria}"><i class="fas fa-copy" aria-hidden="true"></i><span class="explore-favorites__summary-detail-button-label">${safeCopyLabel}</span><span class="visually-hidden"> from highlight</span></button>`
            );
        }
        if (locked) {
            fragments.push('<span class="explore-favorites__summary-detail-lock"><i class="fas fa-lock" aria-hidden="true"></i><span class="visually-hidden">Highlight locked</span></span>');
        }
        if (accessibleNamesSummary) {
            fragments.push(`<span class="visually-hidden explore-favorites__summary-detail-accessible">${escapeHtml(accessibleNamesSummary)}</span>`);
        }
        favoritesSummaryDetail.innerHTML = fragments.join('');
        favoritesSummaryDetail.hidden = false;
        favoritesSummaryDetail.setAttribute('aria-hidden', 'false');
        if (type) {
            favoritesSummaryDetail.dataset.highlightType = type;
        } else {
            delete favoritesSummaryDetail.dataset.highlightType;
        }
        favoritesSummaryDetail.dataset.highlightCount = String(matchCount);
        favoritesSummaryDetail.dataset.highlightLocked = locked ? 'true' : 'false';
        if (scopeLabel) {
            favoritesSummaryDetail.dataset.highlightLabel = scopeLabel;
        } else {
            delete favoritesSummaryDetail.dataset.highlightLabel;
        }
        favoritesSummaryDetail.dataset.highlightHasMatches = matchCount > 0 ? 'true' : 'false';
        favoritesSummaryDetail.dataset.highlightNameCount = String(namesList.length);
        if (namesList.length) {
            favoritesSummaryDetail.dataset.highlightNames = namesList.join('|');
        } else {
            delete favoritesSummaryDetail.dataset.highlightNames;
        }
        if (remainingNames > 0) {
            favoritesSummaryDetail.dataset.highlightNamesRemaining = String(remainingNames);
        } else {
            delete favoritesSummaryDetail.dataset.highlightNamesRemaining;
        }
        if (highlightValue) {
            favoritesSummaryDetail.dataset.highlightValue = highlightValue;
        } else {
            delete favoritesSummaryDetail.dataset.highlightValue;
        }
        if (copyPayload) {
            favoritesSummaryDetail.dataset.highlightCopy = copyPayload;
        } else {
            delete favoritesSummaryDetail.dataset.highlightCopy;
        }
        if (accessibleNamesSummary) {
            favoritesSummaryDetail.dataset.highlightAccessibleSummary = accessibleNamesSummary;
        } else {
            delete favoritesSummaryDetail.dataset.highlightAccessibleSummary;
        }
        if (rawDetails) {
            favoritesSummaryDetail.setAttribute('title', rawDetails);
        } else {
            favoritesSummaryDetail.removeAttribute('title');
        }
        resetFavoritesSummaryDetailCopyState();
    }

    function clearFavoritesSummaryDetail() {
        if (!favoritesSummaryDetail) {
            return;
        }
        if (favoritesSummaryCopyResetTimer) {
            window.clearTimeout(favoritesSummaryCopyResetTimer);
            favoritesSummaryCopyResetTimer = null;
        }
        favoritesSummaryDetail.hidden = true;
        favoritesSummaryDetail.setAttribute('aria-hidden', 'true');
        favoritesSummaryDetail.innerHTML = '';
        favoritesSummaryDetail.removeAttribute('title');
        delete favoritesSummaryDetail.dataset.highlightType;
        delete favoritesSummaryDetail.dataset.highlightCount;
        delete favoritesSummaryDetail.dataset.highlightLocked;
        delete favoritesSummaryDetail.dataset.highlightLabel;
        delete favoritesSummaryDetail.dataset.highlightHasMatches;
        delete favoritesSummaryDetail.dataset.highlightNames;
        delete favoritesSummaryDetail.dataset.highlightNameCount;
        delete favoritesSummaryDetail.dataset.highlightNamesRemaining;
        delete favoritesSummaryDetail.dataset.highlightValue;
        delete favoritesSummaryDetail.dataset.highlightCopy;
        delete favoritesSummaryDetail.dataset.highlightAccessibleSummary;
    }

    function syncFavoritesCopyButton(forceDisabled) {
        if (!favoritesCopyButton) {
            return;
        }
        const disabled = typeof forceDisabled === 'boolean' ? forceDisabled : state.favorites.length === 0;
        favoritesCopyButton.disabled = disabled;
        favoritesCopyButton.setAttribute('aria-disabled', disabled ? 'true' : 'false');
        favoritesCopyButton.classList.toggle('is-disabled', disabled);
    }

    async function handleFavoritesCopy() {
        if (!favoritesCopyButton) {
            return;
        }
        if (!state.favorites.length) {
            syncFavoritesCopyButton();
            return;
        }
        const payload = buildFavoritesClipboardText();
        if (!payload.trim()) {
            revealFavoritesFeedback('Clipboard blocked. Copy manually.');
            syncFavoritesCopyButton();
            return;
        }
        syncFavoritesCopyButton(true);
        const success = await copyTextToClipboard(payload);
        syncFavoritesCopyButton();
        revealFavoritesFeedback(success ? 'Saved matches copied.' : 'Clipboard blocked. Copy manually.');
    }

    function buildFavoritesClipboardText() {
        if (!state.favorites.length) {
            return '';
        }
        const header = 'Saved matches from Explore:';
        const clean = (value) => {
            if (value === null || value === undefined) {
                return '';
            }
            const text = typeof value === 'string' ? value : String(value);
            return text.replace(/\s+/g, ' ').trim();
        };
        const lines = state.favorites.map((favorite, index) => {
            const details = [];
            const name = clean(favorite.name) || 'Saved match';
            const title = clean(favorite.title);
            const location = clean(favorite.location);
            if (title) {
                details.push(title);
            }
            if (location) {
                details.push(location);
            }
            if (Number.isFinite(favorite.score)) {
                details.push(`${favorite.score}% match`);
            }
            const topTagToken = Array.isArray(favorite.tags) && favorite.tags.length ? favorite.tags[0] : '';
            const tag = clean(topTagToken);
            if (tag) {
                const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;
                details.push(normalizedTag);
            }
            const suffix = details.length ? ` — ${details.join(' • ')}` : '';
            return `${index + 1}. ${name}${suffix}`;
        });
        return [header, ...lines].join('\n');
    }

    function revealFavoritesFeedback(message) {
        if (!favoritesFeedback) {
            return;
        }
        const text = typeof message === 'string' && message.trim() ? message.trim() : 'Saved matches copied.';
        favoritesFeedback.textContent = text;
        favoritesFeedback.classList.add('is-visible');
        favoritesFeedback.setAttribute('aria-hidden', 'false');
        if (favoritesFeedbackTimer) {
            clearTimeout(favoritesFeedbackTimer);
        }
        favoritesFeedbackTimer = setTimeout(() => {
            favoritesFeedback?.classList.remove('is-visible');
            favoritesFeedback?.setAttribute('aria-hidden', 'true');
            favoritesFeedbackTimer = null;
        }, 2600);
    }

    function hideFavoritesFeedback() {
        if (!favoritesFeedback) {
            return;
        }
        favoritesFeedback.classList.remove('is-visible');
        favoritesFeedback.setAttribute('aria-hidden', 'true');
        if (favoritesFeedbackTimer) {
            clearTimeout(favoritesFeedbackTimer);
            favoritesFeedbackTimer = null;
        }
    }

    function announceFavoritesStatus(message) {
        if (!favoritesStatusLive) {
            return;
        }
        const text = typeof message === 'string' ? message.trim() : '';
        if (!text) {
            return;
        }
        if (favoritesStatusTimer) {
            clearTimeout(favoritesStatusTimer);
            favoritesStatusTimer = null;
        }
        favoritesStatusLive.textContent = '';
        favoritesStatusTimer = window.setTimeout(() => {
            favoritesStatusLive.textContent = '';
            favoritesStatusTimer = null;
        }, 2200);
        favoritesStatusLive.textContent = text;
    }

    function announceFavoritesSummaryStatus(message) {
        if (!favoritesSummaryStatus) {
            return;
        }
        if (favoritesSummaryStatusTimer) {
            clearTimeout(favoritesSummaryStatusTimer);
            favoritesSummaryStatusTimer = null;
        }
        const text = typeof message === 'string' ? message.trim() : '';
        favoritesSummaryStatus.textContent = '';
        if (!text) {
            return;
        }
        favoritesSummaryStatusTimer = window.setTimeout(() => {
            favoritesSummaryStatus.textContent = text;
            favoritesSummaryStatusTimer = null;
        }, 60);
    }

    function hideFavoritesUndo(clearPayload = true) {
        if (favoritesUndoContainer) {
            favoritesUndoContainer.hidden = true;
        }
        if (favoritesUndoMessage) {
            favoritesUndoMessage.textContent = '';
        }
        if (favoritesUndoButton) {
            favoritesUndoButton.disabled = true;
            favoritesUndoButton.setAttribute('aria-disabled', 'true');
        }
        if (clearPayload) {
            favoritesUndoStack = [];
        }
        clearFavoritesUndoTimer();
    }

    function showFavoritesUndo(payload) {
        if (!favoritesUndoContainer || !favoritesUndoMessage) {
            favoritesUndoStack = [];
            return;
        }
        const entries = Array.isArray(payload?.entries)
            ? payload.entries
                .map((entry) => ({
                    ...entry,
                    tags: Array.isArray(entry?.tags) ? [...entry.tags] : [],
                }))
                .filter((entry) => entry && entry.id)
            : [];
        if (!entries.length) {
            hideFavoritesUndo();
            return;
        }
        const indices = Array.isArray(payload?.indices)
            ? payload.indices.map((value) => (Number.isFinite(value) ? Number(value) : null))
            : [];
        const type = payload?.type === 'clear' ? 'clear' : 'single';
        favoritesUndoStack.push({ entries, indices, type });
        if (favoritesUndoStack.length > 5) {
            favoritesUndoStack = favoritesUndoStack.slice(-5);
        }
        updateFavoritesUndoMessage();
        favoritesUndoContainer.hidden = false;
        if (favoritesUndoButton) {
            favoritesUndoButton.disabled = false;
            favoritesUndoButton.setAttribute('aria-disabled', 'false');
        }
        clearFavoritesUndoTimer();
        favoritesUndoTimer = window.setTimeout(() => {
            hideFavoritesUndo(true);
        }, 10000);
    }

    function handleFavoritesUndo() {
        if (!favoritesUndoStack.length) {
            hideFavoritesUndo();
            return;
        }
        const payload = favoritesUndoStack.pop();
        const hasMore = favoritesUndoStack.length > 0;
        if (hasMore) {
            updateFavoritesUndoMessage();
            favoritesUndoContainer.hidden = false;
            if (favoritesUndoButton) {
                favoritesUndoButton.disabled = false;
                favoritesUndoButton.setAttribute('aria-disabled', 'false');
            }
        } else {
            hideFavoritesUndo(false);
        }
        clearFavoritesUndoTimer();
        let restoredCount = 0;
        let restoredEntries = [];
        if (payload.type === 'clear') {
            const normalized = payload.entries
                .map((entry) => normalizeFavoriteEntry(entry))
                .filter(Boolean);
            if (normalized.length) {
                const merged = [];
                const seen = new Set();
                normalized.forEach((entry) => {
                    if (!entry.id || seen.has(entry.id)) {
                        return;
                    }
                    merged.push(entry);
                    seen.add(entry.id);
                });
                state.favorites.forEach((entry) => {
                    if (!entry.id || seen.has(entry.id)) {
                        return;
                    }
                    merged.push(entry);
                    seen.add(entry.id);
                });
                state.favorites = merged.slice(0, FAVORITES_LIMIT);
                restoredCount = Math.min(normalized.length, FAVORITES_LIMIT);
                restoredEntries = normalized.slice(0, restoredCount);
            }
        } else {
            const entry = normalizeFavoriteEntry(payload.entries[0]);
            if (entry && entry.id && !favoriteIds.has(entry.id)) {
                let targetIndex = 0;
                if (Array.isArray(payload.indices) && Number.isFinite(payload.indices[0])) {
                    const candidate = Number(payload.indices[0]);
                    targetIndex = Math.max(0, Math.min(candidate, state.favorites.length));
                }
                state.favorites.splice(targetIndex, 0, entry);
                if (state.favorites.length > FAVORITES_LIMIT) {
                    state.favorites.length = FAVORITES_LIMIT;
                }
                restoredCount = 1;
                restoredEntries = [entry];
            }
        }
        rebuildFavoriteIds();
        renderFavoritesBar();
        persistFavorites();
        if (!restoredCount) {
            if (!hasMore) {
                hideFavoritesUndo();
            } else {
                restartFavoritesUndoTimer();
            }
            return;
        }
        const focusId = payload.type === 'single'
            ? payload.entries[0]?.id
            : state.favorites[0]?.id;
        if (focusId) {
            focusFavoriteChipById(focusId);
        }
        restoredEntries.forEach((entry) => {
            if (entry?.id && favoriteIds.has(entry.id)) {
                updateFavoriteButtonState(entry.id, true);
            }
        });
        const statusMessage = payload.type === 'single'
            ? `${payload.entries[0]?.name || 'Saved match'} restored.`
            : restoredCount === 1
                ? `${payload.entries[0]?.name || 'Saved match'} restored.`
                : `Restored ${restoredCount} saved matches.`;
        announceFavoritesStatus(statusMessage);
        if (hasMore) {
            restartFavoritesUndoTimer();
        }
    }

    function updateFavoritesUndoMessage() {
        if (!favoritesUndoMessage || !favoritesUndoStack.length) {
            hideFavoritesUndo();
            return;
        }
        const top = favoritesUndoStack[favoritesUndoStack.length - 1];
        const count = top.entries.length;
        const baseName = count === 1
            ? (top.entries[0]?.name || 'Saved match')
            : `${count} saved matches`;
        const baseMessage = top.type === 'clear'
            ? `Removed ${baseName}.`
            : `Removed ${baseName}.`;
        const remaining = favoritesUndoStack.length - 1;
        const suffix = remaining > 0
            ? ` ${remaining} more undo option${remaining > 1 ? 's' : ''} pending.`
            : '';
        favoritesUndoMessage.textContent = `${baseMessage} Undo?${suffix ? ` ${suffix}` : ''}`;
    }

    function clearFavoritesUndoTimer() {
        if (favoritesUndoTimer) {
            clearTimeout(favoritesUndoTimer);
            favoritesUndoTimer = null;
        }
    }

    function restartFavoritesUndoTimer() {
        clearFavoritesUndoTimer();
        favoritesUndoTimer = window.setTimeout(() => {
            hideFavoritesUndo(true);
        }, 10000);
    }

    function handleGlobalUndoShortcut(event) {
        if (!event) {
            return;
        }
        const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
        if (key !== 'z' || (!event.ctrlKey && !event.metaKey) || event.shiftKey) {
            return;
        }
        if (isEditableElement(event.target) && event.target !== favoritesUndoButton) {
            return;
        }
        if (!favoritesUndoStack.length) {
            return;
        }
        event.preventDefault();
        handleFavoritesUndo();
    }

    function isEditableElement(element) {
        if (!element) {
            return false;
        }
        if (element.isContentEditable) {
            return true;
        }
        const tag = element.tagName;
        if (!tag) {
            return false;
        }
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
            return true;
        }
        const role = element.getAttribute?.('role');
        return role === 'textbox';
    }

    function buildFavoriteChipMarkup(favorite, index, total) {
        const safeId = escapeHtml(favorite.id);
        const safeName = escapeHtml(favorite.name);
        const safeImage = escapeHtml(favorite.image || defaultAvatar);
        const position = Number.isFinite(index) ? index + 1 : 1;
        const totalCount = Number.isFinite(total) && total > 0 ? total : state.favorites.length || 1;
        const hintParts = [];
        if (Number.isFinite(favorite.score)) {
            hintParts.push(`${favorite.score}% match`);
        }
        if (favorite.title) {
            hintParts.push(favorite.title);
        }
        if (favorite.location) {
            hintParts.push(favorite.location);
        }
        const hintAttr = hintParts.length ? ` title="${escapeHtml(hintParts.join(' • '))}"` : '';
        const topTag = Array.isArray(favorite.tags) && favorite.tags.length ? favorite.tags[0] : '';
        const metaLabelRaw = topTag ? `#${topTag}` : (favorite.location || '');
        const metaLabel = metaLabelRaw ? escapeHtml(metaLabelRaw) : '';
        const metaIcon = topTag ? 'fas fa-hashtag' : (favorite.location ? 'fas fa-location-dot' : '');
        const metaMarkup = metaLabel
            ? `<span class="explore-favorite-chip__meta">${metaIcon ? `<i class="${metaIcon}"></i>` : ''}${metaLabel}</span>`
            : '';
        const orderMarkup = `<span class="explore-favorite-chip__order" aria-hidden="true">${position}</span>`;
        const ariaLabel = `Jump to ${safeName} (favorite ${position} of ${totalCount})`;
        const normalizedLocationToken = normalizeSummaryToken(favorite.location || '');
        const normalizedTagTokens = Array.isArray(favorite.tags)
            ? favorite.tags
                .map((tag) => normalizeSummaryToken(tag))
                .filter(Boolean)
            : [];
        const summaryLocationAttr = normalizedLocationToken ? ` data-favorite-location="${escapeHtml(normalizedLocationToken)}"` : '';
        const summaryTagsAttr = normalizedTagTokens.length ? ` data-favorite-tags="${escapeHtml(normalizedTagTokens.join('|'))}"` : '';
        const summaryScoreAttr = Number.isFinite(favorite.score) ? ` data-favorite-score="${escapeHtml(String(favorite.score))}"` : '';
        return `
            <div class="explore-favorite-chip" data-favorite-id="${safeId}" data-action="favorite-jump"${summaryLocationAttr}${summaryTagsAttr}${summaryScoreAttr} role="button" tabindex="0"${hintAttr} aria-label="${ariaLabel}">
                <span class="explore-favorite-chip__avatar">${orderMarkup}<img src="${safeImage}" alt="" loading="lazy" decoding="async"></span>
                <span class="explore-favorite-chip__text">
                    <span class="explore-favorite-chip__name">${safeName}</span>
                    ${metaMarkup}
                </span>
                <span class="explore-favorite-chip__actions" role="group" aria-label="Saved match actions">
                    <button type="button" class="explore-favorite-chip__promote" data-action="favorite-promote" data-favorite-id="${safeId}" aria-label="Move ${safeName} to the top of saved matches">
                        <i class="fas fa-arrow-up"></i>
                    </button>
                    <button type="button" class="explore-favorite-chip__remove" data-action="favorite-remove" data-favorite-id="${safeId}" aria-label="Remove ${safeName} from saved matches">
                        <i class="fas fa-xmark"></i>
                    </button>
                </span>
            </div>
        `;
    }

    function bindFavoritesBarActions() {
        if (!favoritesBar || favoritesBarBound) {
            return;
        }
        favoritesBar.addEventListener('click', handleFavoritesBarClick);
        favoritesBar.addEventListener('keydown', handleFavoritesBarKeydown);
        favoritesBarBound = true;
    }

    function handleFavoritesBarClick(event) {
        if (!favoritesBar) {
            return;
        }
        const clearTrigger = event.target.closest('[data-action="favorite-clear"]');
        if (clearTrigger && favoritesBar.contains(clearTrigger)) {
            event.preventDefault();
            clearAllFavorites();
            return;
        }
        const scrollTrigger = event.target.closest('[data-action="favorite-scroll"]');
        if (scrollTrigger && favoritesBar.contains(scrollTrigger)) {
            event.preventDefault();
            if (state.favorites.length) {
                scrollToFavoriteCard(state.favorites[0]?.id || '');
            }
            return;
        }
        const copyTrigger = event.target.closest('[data-action="favorite-copy"]');
        if (copyTrigger && favoritesBar.contains(copyTrigger)) {
            event.preventDefault();
            handleFavoritesCopy().catch((error) => {
                console.warn('Unable to copy favorites', error);
                syncFavoritesCopyButton();
                revealFavoritesFeedback('Clipboard blocked. Copy manually.');
            });
            return;
        }
        const promoteTrigger = event.target.closest('[data-action="favorite-promote"]');
        if (promoteTrigger && favoritesBar.contains(promoteTrigger)) {
            event.preventDefault();
            event.stopPropagation();
            const id = promoteTrigger.dataset.favoriteId || '';
            if (!id) {
                return;
            }
            const entry = state.favorites.find((favorite) => favorite.id === id);
            if (!promoteFavorite(id)) {
                return;
            }
            renderFavoritesBar();
            persistFavorites();
            const position = state.favorites.findIndex((favorite) => favorite.id === id);
            if (entry && position !== -1) {
                announceFavoritesStatus(`${entry.name || 'Saved match'} moved to position ${position + 1} of ${state.favorites.length}.`);
            }
            focusFavoriteChipById(id);
            return;
        }
        const removeTrigger = event.target.closest('[data-action="favorite-remove"]');
        if (removeTrigger && favoritesBar.contains(removeTrigger)) {
            event.stopPropagation();
            const id = removeTrigger.dataset.favoriteId || '';
            if (!id) {
                return;
            }
            const removal = removeFavorite(id);
            updateFavoriteButtonState(id, false);
            renderFavoritesBar();
            persistFavorites();
            if (removal?.entry) {
                const remaining = state.favorites.length;
                const message = remaining
                    ? `${removal.entry.name || 'Saved match'} removed. ${remaining}/${FAVORITES_LIMIT} saved. Undo available.`
                    : 'No saved matches remaining. Undo available.';
                announceFavoritesStatus(message);
                showFavoritesUndo({
                    entries: [removal.entry],
                    indices: [removal.index],
                    type: 'single',
                });
            }
            return;
        }
        const chip = event.target.closest('.explore-favorite-chip[data-favorite-id]');
        if (!chip || !favoritesBar.contains(chip)) {
            return;
        }
        const id = chip.dataset.favoriteId || '';
        if (id) {
            scrollToFavoriteCard(id);
        }
    }

    function handleFavoritesBarKeydown(event) {
        const chip = event.target.closest('.explore-favorite-chip[data-favorite-id]');
        if (!chip) {
            return;
        }
        const id = chip.dataset.favoriteId || '';
        if (!id) {
            return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            scrollToFavoriteCard(id);
            return;
        }
        if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            const chips = Array.from(favoritesContent?.querySelectorAll('.explore-favorite-chip') || []);
            const chipIndex = Math.max(0, chips.indexOf(chip));
            const removal = removeFavorite(id);
            updateFavoriteButtonState(id, false);
            renderFavoritesBar();
            persistFavorites();
            focusFavoriteChipNear(chipIndex);
            if (removal?.entry) {
                const remaining = state.favorites.length;
                const message = remaining
                    ? `${removal.entry.name || 'Saved match'} removed. ${remaining}/${FAVORITES_LIMIT} saved. Undo available.`
                    : 'No saved matches remaining. Undo available.';
                announceFavoritesStatus(message);
                showFavoritesUndo({
                    entries: [removal.entry],
                    indices: [removal.index],
                    type: 'single',
                });
            }
            return;
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            const entry = state.favorites.find((favorite) => favorite.id === id);
            if (moveFavoriteBy(id, -1)) {
                renderFavoritesBar();
                persistFavorites();
                focusFavoriteChipById(id);
                const position = state.favorites.findIndex((favorite) => favorite.id === id);
                if (entry && position !== -1) {
                    announceFavoritesStatus(`${entry.name || 'Saved match'} moved to position ${position + 1} of ${state.favorites.length}.`);
                }
            }
            return;
        }
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            const entry = state.favorites.find((favorite) => favorite.id === id);
            if (moveFavoriteBy(id, 1)) {
                renderFavoritesBar();
                persistFavorites();
                focusFavoriteChipById(id);
                const position = state.favorites.findIndex((favorite) => favorite.id === id);
                if (entry && position !== -1) {
                    announceFavoritesStatus(`${entry.name || 'Saved match'} moved to position ${position + 1} of ${state.favorites.length}.`);
                }
            }
            return;
        }
        if (event.key === 'Home') {
            event.preventDefault();
            const entry = state.favorites.find((favorite) => favorite.id === id);
            if (moveFavoriteToIndex(id, 0)) {
                renderFavoritesBar();
                persistFavorites();
                focusFavoriteChipById(id);
                if (entry) {
                    announceFavoritesStatus(`${entry.name || 'Saved match'} moved to position 1 of ${state.favorites.length}.`);
                }
            }
            return;
        }
        if (event.key === 'End') {
            event.preventDefault();
            const entry = state.favorites.find((favorite) => favorite.id === id);
            if (moveFavoriteToIndex(id, state.favorites.length - 1)) {
                renderFavoritesBar();
                persistFavorites();
                focusFavoriteChipById(id);
                if (entry) {
                    announceFavoritesStatus(`${entry.name || 'Saved match'} moved to position ${state.favorites.length} of ${state.favorites.length}.`);
                }
            }
        }
    }

    function focusFavoriteChipNear(preferredIndex) {
        if (!favoritesContent) {
            return;
        }
        const index = Number.isFinite(preferredIndex) ? preferredIndex : 0;
        // Keeps keyboard focus anchored after the favorites list rebuilds.
        requestAnimationFrame(() => {
            const chips = Array.from(favoritesContent.querySelectorAll('.explore-favorite-chip'));
            if (chips.length) {
                const safeIndex = index < chips.length ? index : chips.length - 1;
                const target = chips[Math.max(0, safeIndex)];
                target?.focus();
                return;
            }
            if (favoritesUndoContainer && !favoritesUndoContainer.hidden && favoritesUndoButton && !favoritesUndoButton.disabled) {
                favoritesUndoButton.focus();
                return;
            }
            if (favoritesCopyButton && !favoritesCopyButton.disabled) {
                favoritesCopyButton.focus();
                return;
            }
            if (favoritesClearButton && !favoritesClearButton.disabled) {
                favoritesClearButton.focus();
                return;
            }
            if (favoritesBar) {
                favoritesBar.focus({ preventScroll: true });
            }
        });
    }

    function focusFavoriteChipById(id) {
        if (!id || !favoritesContent) {
            return;
        }
        requestAnimationFrame(() => {
            const selector = `.explore-favorite-chip[data-favorite-id="${escapeSelector(id)}"]`;
            const chip = favoritesContent.querySelector(selector);
            if (chip) {
                chip.focus();
                chip.classList.add('is-promoted');
                setTimeout(() => chip.classList.remove('is-promoted'), 1400);
            }
        });
    }

    function scrollToFavoriteCard(id) {
        if (!id) {
            return;
        }
        const selector = `[data-match-id="${escapeSelector(id)}"]`;
        const card = document.querySelector(selector);
        if (!card) {
            return;
        }
        updateFavoriteButtonState(id, true);
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('explore-card--flash');
        setTimeout(() => card.classList.remove('explore-card--flash'), 1500);
    }

    function refreshFavoritesFromCollection(records) {
        if (!Array.isArray(records) || !records.length || !state.favorites.length) {
            return;
        }
        const updated = new Map();
        const seenIdentifiers = new Map();
        records.forEach((record, index) => {
            const baseData = extractCardData(record, index);
            const uniqueId = ensureUniqueIdentifier(baseData.id, seenIdentifiers);
            const cardData = uniqueId === baseData.id ? baseData : { ...baseData, id: uniqueId };
            if (favoriteIds.has(cardData.id)) {
                updated.set(cardData.id, normalizeFavoriteEntry(cardData));
            }
        });
        if (!updated.size) {
            return;
        }
        let changed = false;
        state.favorites = state.favorites.map((favorite) => {
            const replacement = updated.get(favorite.id);
            if (replacement) {
                if (hasFavoriteChanged(favorite, replacement)) {
                    changed = true;
                }
                return replacement;
            }
            return favorite;
        });
        rebuildFavoriteIds();
        if (changed) {
            renderFavoritesBar();
            persistFavorites();
        }
    }

    function hydrateFavoritesFromStorage() {
        state.favorites = [];
        rebuildFavoriteIds();
        if (!canUseStorage) {
            return;
        }
        try {
            const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
            if (!raw) {
                return;
            }
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                return;
            }
            const restored = parsed
                .map((entry) => normalizeFavoriteEntry(entry))
                .filter(Boolean)
                .slice(0, FAVORITES_LIMIT);
            state.favorites = restored;
            rebuildFavoriteIds();
        } catch (error) {
            console.warn('Unable to restore favorites', error);
            state.favorites = [];
            rebuildFavoriteIds();
        }
    }

    function persistFavorites() {
        if (!canUseStorage) {
            return;
        }
        try {
            const payload = state.favorites.slice(0, FAVORITES_LIMIT).map((entry) => ({
                id: entry.id,
                name: entry.name,
                title: entry.title,
                location: entry.location,
                image: entry.image,
                score: entry.score,
                tags: entry.tags,
            }));
            window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(payload));
        } catch (error) {
            console.warn('Unable to persist favorites', error);
        }
    }

    function normalizeFavoriteEntry(entry) {
        if (!entry || typeof entry !== 'object') {
            return null;
        }
        const id = normalizeIdentifierPart(entry.id);
        if (!id) {
            return null;
        }
        const name = pickText(entry.name, 'Saved match');
        const title = pickText(entry.title);
        const location = pickText(entry.location);
        const image = pickText(entry.image, defaultAvatar) || defaultAvatar;
        const scoreCandidate = Number(entry.score);
        const score = Number.isFinite(scoreCandidate) ? Math.min(100, Math.max(0, Math.round(scoreCandidate))) : null;
        const tags = Array.isArray(entry.tags)
            ? entry.tags
                .map((tag) => pickText(tag))
                .filter(Boolean)
                .slice(0, 4)
            : [];
        return {
            id,
            name,
            title,
            location,
            image,
            score,
            tags,
        };
    }

    function buildFavoriteFromDataset(button) {
        if (!button) {
            return null;
        }
        const tags = decodeFavoriteTags(button.dataset.favoriteTags || '');
        return normalizeFavoriteEntry({
            id: button.dataset.favoriteId,
            name: button.dataset.favoriteName,
            title: button.dataset.favoriteTitle,
            location: button.dataset.favoriteLocation,
            image: button.dataset.favoriteImage,
            score: button.dataset.favoriteScore,
            tags,
        });
    }

    function hasFavoriteChanged(previousEntry, nextEntry) {
        if (!previousEntry || !nextEntry) {
            return true;
        }
        if (previousEntry.id !== nextEntry.id) {
            return true;
        }
        if (previousEntry.name !== nextEntry.name) {
            return true;
        }
        if (previousEntry.title !== nextEntry.title) {
            return true;
        }
        if (previousEntry.location !== nextEntry.location) {
            return true;
        }
        if (previousEntry.image !== nextEntry.image) {
            return true;
        }
        if ((previousEntry.score ?? null) !== (nextEntry.score ?? null)) {
            return true;
        }
        const prevTags = previousEntry.tags || [];
        const nextTags = nextEntry.tags || [];
        if (prevTags.length !== nextTags.length) {
            return true;
        }
        for (let index = 0; index < prevTags.length; index += 1) {
            if (prevTags[index] !== nextTags[index]) {
                return true;
            }
        }
        return false;
    }

    function extractCardData(record, index) {
        const id = getRecordIdentifier(record, index);
        const name = pickText(record?.name, record?.full_name, `Connection ${index + 1}`) || `Connection ${index + 1}`;
        const title = pickText(record?.title, record?.role, 'Creative professional') || 'Creative professional';
        const location = pickText(record?.city, record?.location, 'Remote') || 'Remote';
        const image = pickText(record?.image, record?.avatar, defaultAvatar) || defaultAvatar;
        const summary = pickText(record?.bio, record?.summary, record?.reason, 'Curious, collaborative, and excited to connect.') || 'Curious, collaborative, and excited to connect.';
        const tags = Array.isArray(record?.tags)
            ? record.tags
                .map((tag) => pickText(tag))
                .filter(Boolean)
                .slice(0, 4)
            : [];
        const scoreCandidates = [
            record?.score,
            record?.match_score,
            record?.affinity,
            record?._score,
            record?.confidence,
        ];
        const firstScore = scoreCandidates.find((candidate) => Number.isFinite(Number(candidate)));
        const fallbackScore = 88 - index * 2;
        const scoreValue = Number.isFinite(Number(firstScore)) ? Number(firstScore) : fallbackScore;
        const clampedScore = Math.min(100, Math.max(0, Math.round(scoreValue)));
        const email = pickText(record?.email, record?.contact_email, record?.primary_email);
        return {
            id,
            name,
            title,
            location,
            image,
            summary,
            tags,
            score: clampedScore,
            email,
        };
    }

    function ensureUniqueIdentifier(id, seenMap) {
        const base = id || 'match';
        const count = seenMap.get(base) || 0;
        seenMap.set(base, count + 1);
        if (count === 0) {
            return base;
        }
        return `${base}#${count}`;
    }

    function getRecordIdentifier(record, index) {
        const primary = [
            record?.id,
            record?.uuid,
            record?.profile_id,
            record?.connection_id,
            record?.slug,
            record?.handle,
            record?.email,
        ];
        for (const candidate of primary) {
            const normalized = normalizeIdentifierPart(candidate);
            if (normalized) {
                return normalized;
            }
        }
        const fallbackParts = [
            record?.name,
            record?.full_name,
            record?.title,
            record?.role,
            record?.city,
            record?.location,
        ]
            .map(normalizeIdentifierPart)
            .filter(Boolean);
        if (fallbackParts.length) {
            const joined = fallbackParts.join('-').toLowerCase().replace(/\s+/g, '-');
            const sanitized = joined
                .replace(/[^a-z0-9_-]+/g, '-')
                .replace(/-{2,}/g, '-')
                .replace(/^-|-$/g, '');
            if (sanitized) {
                return sanitized.length > 120 ? sanitized.slice(0, 120) : sanitized;
            }
        }
        return `match-${index}`;
    }

    function normalizeIdentifierPart(value) {
        if (value === null || value === undefined) {
            return '';
        }
        if (typeof value === 'string') {
            return value.trim();
        }
        if (typeof value === 'number') {
            return String(value);
        }
        if (typeof value === 'object' && value !== null && typeof value.toString === 'function') {
            return value.toString().trim();
        }
        return '';
    }

    function pickText(...values) {
        for (const value of values) {
            if (value === null || value === undefined) {
                continue;
            }
            const text = typeof value === 'string' ? value : String(value);
            const trimmed = text.trim();
            if (trimmed) {
                return trimmed;
            }
        }
        return '';
    }

    function escapeSelector(value) {
        const raw = value === undefined || value === null ? '' : String(value);
        if (window.CSS?.escape) {
            return CSS.escape(raw);
        }
        return raw.replace(/([ !"#$%&'()*+,./:;<=>?@[\]^`{|}~])/g, '\\$1');
    }

    function detectStorage() {
        if (typeof window === 'undefined' || !window.localStorage) {
            return false;
        }
        try {
            const probe = '__explore_storage_probe__';
            window.localStorage.setItem(probe, '1');
            window.localStorage.removeItem(probe);
            return true;
        } catch (error) {
            return false;
        }
    }

    function bindExploreActions(scope) {
        if (!scope) {
            return;
        }
        scope.querySelectorAll('[data-action="explore-invite"]').forEach((button) => {
            button.addEventListener('click', () => {
                const name = button.dataset.name || '';
                window.aiExplore?.invite(name);
            });
        });
        scope.querySelectorAll('[data-action="explore-message"]').forEach((button) => {
            button.addEventListener('click', () => {
                const name = button.dataset.name || '';
                const email = button.dataset.email || '';
                window.aiExplore?.message(name, email);
            });
        });
        scope.querySelectorAll('[data-action="explore-favorite"]').forEach((button) => {
            button.addEventListener('click', () => {
                handleFavoriteToggle(button);
            });
        });
        registerImageFallbacks(scope);
    }

    function renderExploreSkeleton(container) {
        const placeholders = Array.from({ length: 3 }).map(() => '<div class="explore-skeleton"></div>').join('');
        container.innerHTML = `<div class="explore-loading">${placeholders}</div>`;
    }

    function updateExploreCount(total) {
        const counter = document.querySelector('[data-explore-count]');
        if (counter) {
            counter.textContent = total.toLocaleString();
        }
    }

    function getExploreEmpty(message) {
        return `<div class="explore-empty">${message}</div>`;
    }

    function getExploreFallback() {
        return [
            { name: 'Alina Gomez', title: 'Community Architect', city: 'Remote • LATAM', tags: ['Creator economies', 'Soft launches'], score: 89, bio: 'Hosts intimate launches for beauty founders. Obsessed with crafting ritual-rich experiences.' },
            { name: 'Dev Patel', title: 'Full Stack Storyteller', city: 'London', tags: ['Creative code', 'Immersive web'], score: 86, bio: 'Builds interactive brand experiences blending 3D narratives with clean engineering.' },
            { name: 'Kara Imani', title: 'Wellness Producer', city: 'Los Angeles', tags: ['Sound bath', 'Retreat design'], score: 84, bio: 'Curates sensory retreats for founders. Loves weaving in breathwork & experiential art.' },
            { name: 'Noah Lin', title: 'Product Strategist', city: 'Singapore', tags: ['Growth loops', 'Product discovery'], score: 82, bio: 'Focuses on mindful growth for early-stage SaaS teams across APAC.' }
        ];
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

    function registerImageFallbacks(scope) {
        if (!scope) {
            return;
        }
        scope.querySelectorAll('img[data-fallback]').forEach((img) => {
            if (img.dataset.fallbackBound === '1') {
                return;
            }
            img.dataset.fallbackBound = '1';
            if (!img.getAttribute('loading')) {
                img.setAttribute('loading', 'lazy');
            }
            if (!img.getAttribute('decoding')) {
                img.setAttribute('decoding', 'async');
            }
            if (!img.getAttribute('src') || img.getAttribute('src') === 'undefined') {
                img.src = img.dataset.fallback || defaultAvatar;
                img.dataset.usingFallback = '1';
            }
            img.addEventListener('error', () => {
                if (img.dataset.usingFallback === '1') {
                    return;
                }
                img.dataset.usingFallback = '1';
                img.src = img.dataset.fallback || defaultAvatar;
            });
        });
    }

    window.aiExplore = {
        invite(name) {
            redirectToComposer(name, 'explore-invite');
        },
        message(name, email) {
            if (email) {
                window.location.href = `mailto:${email}`;
                return;
            }
            redirectToComposer(name, 'explore-message');
        }
    };

    function redirectToComposer(name, source) {
        const base = inviteComposerUrl || window.location.pathname;
        let destination;
        try {
            destination = new URL(base, window.location.origin);
        } catch (error) {
            destination = new URL(window.location.href);
            destination.pathname = base;
        }
        if (name) {
            destination.searchParams.set('match_name', name);
        }
        if (source) {
            destination.searchParams.set('source', source);
        }
        window.location.href = destination.toString();
    }
})();
</script>
@endpush

