@extends('frontend.social.layout')

@section('social-content')
@php
    $spotlightMetrics = [
        [
            'icon' => 'fas fa-user-astronaut',
            'label' => 'Trusted connections',
            'value' => number_format($counts['connections'] ?? 0),
            'hint' => 'Warm intros already in your orbit.',
        ],
        [
            'icon' => 'fas fa-sparkles',
            'label' => 'Pending invites',
            'value' => number_format($counts['pendingInvites'] ?? 0),
            'hint' => 'Follow-up and convert to glowing yeses.',
        ],
        [
            'icon' => 'fas fa-comment-dots',
            'label' => 'Unread threads',
            'value' => number_format($counts['unreadMessages'] ?? 0),
            'hint' => 'Drop a note and keep the momentum alive.',
        ],
    ];
@endphp
<div class="spotlight-page space-y-14">
    <section class="spotlight-hero">
        <div class="spotlight-hero__bg"></div>
        <div class="spotlight-hero__content">
            <div class="spotlight-hero__intro">
                <span class="spotlight-hero__eyebrow">AI Spotlight</span>
                <h1 class="spotlight-hero__title">Let our AI concierge surface your next radiant connection</h1>
                <p class="spotlight-hero__subtitle">Every refresh summons a fresh constellation of collaborators tuned to your vibe, goals, and storytelling magic.</p>
                <div class="spotlight-hero__cta-group">
                    <a href="{{ route('member.social.connections.create') }}" class="spotlight-hero__cta spotlight-hero__cta--primary">
                        <i class="fas fa-user-plus"></i>
                        Start a new invite
                    </a>
                    <a href="{{ $profileLink }}" class="spotlight-hero__cta spotlight-hero__cta--ghost" target="_blank" rel="noopener">
                        <i class="fas fa-arrow-up-right-from-square"></i>
                        View public profile
                    </a>
                </div>
            </div>
            <div class="spotlight-hero__metrics">
                @foreach ($spotlightMetrics as $metric)
                    <article class="spotlight-metric">
                        <div class="spotlight-metric__icon">
                            <i class="{{ $metric['icon'] }}"></i>
                        </div>
                        <div>
                            <h3 class="spotlight-metric__label">{{ $metric['label'] }}</h3>
                            <p class="spotlight-metric__value">{{ $metric['value'] }}</p>
                            <p class="spotlight-metric__hint">{{ $metric['hint'] }}</p>
                        </div>
                    </article>
                @endforeach
            </div>
        </div>
    </section>

    <section class="spotlight-section">
        <div class="spotlight-section__header">
            <div>
                <h2 class="spotlight-section__title">Curated introductions</h2>
                <p class="spotlight-section__subtitle">Signal-rich, algorithm-approved matches crafted for your energy.</p>
            </div>
            <div class="spotlight-section__actions">
                <span class="spotlight-section__meta" data-spotlight-meta>Loading picks&hellip;</span>
                <button type="button" class="spotlight-refresh" data-action="refresh-spotlight">
                    <i class="fas fa-rotate"></i>
                    Refresh constellation
                </button>
            </div>
        </div>
        <div id="spotlightRecommendations" class="spotlight-grid" aria-live="polite"></div>
    </section>

    <section class="spotlight-section spotlight-section--clusters">
        <div class="spotlight-section__header">
            <div>
                <h2 class="spotlight-section__title">Warm clusters</h2>
                <p class="spotlight-section__subtitle">Micro-communities where your voice will resonate instantly.</p>
            </div>
            <span class="spotlight-section__meta" data-cluster-meta>Calibrating&hellip;</span>
        </div>
        <div id="spotlightClusters" class="spotlight-cluster-grid" aria-live="polite"></div>
    </section>

    <section class="spotlight-footer">
        <div class="spotlight-footer__card">
            <div>
                <h3 class="spotlight-footer__title">Ready to share your glow?</h3>
                <p class="spotlight-footer__subtitle">Copy your public link and invite collaborators into your universe.</p>
            </div>
            <div class="spotlight-footer__actions" data-share-wrapper>
                <button type="button" class="spotlight-footer__cta" data-action="copy-share-link" data-share-link="{{ $profileLink }}">
                    <i class="fas fa-link"></i>
                    Copy profile link
                </button>
                <span class="spotlight-footer__feedback hidden" data-share-feedback></span>
            </div>
        </div>
    </section>
</div>
@endsection



@push('scripts')
<script>
(function () {
    const defaultAvatar = @json($defaultAvatar);
    const inviteComposerUrl = @json(route('member.social.connections.create'));
    let latestRecommendations = [];

    document.addEventListener('DOMContentLoaded', () => {
        setupShareLinkCopy();
        setupRefreshButton();
        loadSpotlightRecommendations();
        loadSpotlightClusters();
    });

    function setupRefreshButton() {
        const button = document.querySelector('[data-action="refresh-spotlight"]');
        if (!button) {
            return;
        }
        button.addEventListener('click', () => {
            button.disabled = true;
            button.classList.add('is-loading');
            button.innerHTML = '<i class="fas fa-spinner-third fa-spin"></i> Summoning matches&hellip;';
            loadSpotlightRecommendations().finally(() => {
                button.disabled = false;
                button.classList.remove('is-loading');
                button.innerHTML = '<i class="fas fa-rotate"></i> Refresh constellation';
            });
        });
    }

    function setupShareLinkCopy() {
        const button = document.querySelector('[data-action="copy-share-link"]');
        if (!button) {
            return;
        }
        button.addEventListener('click', async () => {
            const link = button.getAttribute('data-share-link');
            const feedback = button.parentElement?.querySelector('[data-share-feedback]');
            const success = await copyTextToClipboard(link || '');
            if (success) {
                revealFeedback(feedback, 'Profile link copied. Share the sparkle.');
            } else {
                revealFeedback(feedback, 'Clipboard blocked. Highlight and copy manually.');
            }
        });
    }

    async function loadSpotlightRecommendations(limit = 9) {
        const container = document.getElementById('spotlightRecommendations');
        const meta = document.querySelector('[data-spotlight-meta]');
        if (!container) {
            return Promise.resolve();
        }

        renderRecommendationSkeleton(container);

        try {
            const payload = await fetchRecommendations(limit);
            latestRecommendations = payload;
            if (!payload.length) {
                container.innerHTML = getEmptyRecommendations();
            } else {
                container.innerHTML = payload.map((record, index) => buildRecommendationCard(record, index)).join('');
            }
            bindRecommendationActions(container);
            updateMeta(meta);
        } catch (error) {
            console.error('Unable to refresh spotlight recommendations', error);
            container.innerHTML = getEmptyRecommendations('Unable to refresh picks right now. Try again shortly.');
            bindRecommendationActions(container);
            if (meta) {
                meta.textContent = 'Sync paused';
            }
        }
    }

    async function fetchRecommendations(limit) {
        const service = window.aiFeatures?.getConnectionRecommendations;
        if (!service) {
            return getFallbackRecommendations();
        }

        try {
            const response = await service.call(window.aiFeatures, limit);
            const data = Array.isArray(response?.data)
                ? response.data
                : (Array.isArray(response) ? response : []);
            if (!data.length) {
                return getFallbackRecommendations();
            }
            return data;
        } catch (error) {
            console.error('AI recommendations failed', error);
            return getFallbackRecommendations();
        }
    }

    async function loadSpotlightClusters(limit = 4) {
        const grid = document.getElementById('spotlightClusters');
        const meta = document.querySelector('[data-cluster-meta]');
        if (!grid) {
            return;
        }

        renderClusterSkeleton(grid);
        if (meta) {
            meta.textContent = 'Curating clusters&hellip;';
        }

        try {
            const clusters = await fetchClusters(limit);
            if (!clusters.length) {
                grid.innerHTML = getEmptyClusters();
                if (meta) {
                    meta.textContent = 'More signal needed';
                }
                return;
            }

            grid.innerHTML = clusters.map(buildClusterCard).join('');
            if (meta) {
                meta.textContent = `Refreshed ${new Date().toLocaleTimeString()}`;
            }
        } catch (error) {
            console.error('Unable to refresh clusters', error);
            grid.innerHTML = getEmptyClusters('We could not surface clusters right now. Try again later.');
            if (meta) {
                meta.textContent = 'Sync paused';
            }
        }
    }

    async function fetchClusters(limit) {
        const service = window.aiFeatures?.getConnectionClusters;
        if (!service) {
            return getFallbackClusters();
        }

        try {
            const response = await service.call(window.aiFeatures, limit);
            const data = Array.isArray(response?.data)
                ? response.data
                : (Array.isArray(response) ? response : []);
            if (!data.length) {
                return getFallbackClusters();
            }
            return data;
        } catch (error) {
            console.error('AI cluster fetch failed', error);
            return getFallbackClusters();
        }
    }

    function updateMeta(meta) {
        if (!meta) {
            return;
        }
        if (!latestRecommendations.length) {
            meta.textContent = 'We will refresh again soon.';
            return;
        }
        meta.textContent = `Refreshed ${new Date().toLocaleTimeString()}`;
    }

    function renderRecommendationSkeleton(container) {
        const placeholders = Array.from({ length: 3 }).map(() => '<div class="spotlight-skeleton"></div>').join('');
        container.innerHTML = `<div class="spotlight-loading">${placeholders}</div>`;
    }

    function renderClusterSkeleton(container) {
        const placeholders = Array.from({ length: 3 }).map(() => '<div class="spotlight-skeleton" style="height: 180px;"></div>').join('');
        container.innerHTML = `<div class="spotlight-loading">${placeholders}</div>`;
    }

    function buildRecommendationCard(record, index) {
        const name = escapeHtml(record?.name ?? record?.full_name ?? `Connection ${index + 1}`);
        const title = escapeHtml(record?.title ?? record?.role ?? 'Creative professional');
        const city = escapeHtml(record?.city ?? record?.location ?? 'Remote');
        const image = escapeHtml(record?.image ?? record?.avatar ?? defaultAvatar);
        const scoreRaw = Number(record?.score ?? record?.match_score ?? record?.affinity ?? (92 - index * 3));
        const score = Math.min(100, Math.max(0, Math.round(scoreRaw)));
        const reason = escapeHtml(record?.reason ?? record?.summary ?? 'High overlap in projects, values, and signals.');
        const email = escapeHtml(record?.email ?? '');

        return `
            <article class="spotlight-card">
                <div class="spotlight-card__score">${score}%</div>
                <div class="spotlight-card__header">
                    <div class="spotlight-card__avatar">
                        <img src="${image}" alt="${name}" loading="lazy" decoding="async" width="64" height="64" data-fallback="${defaultAvatar}">
                    </div>
                    <div>
                        <p class="spotlight-card__name">${name}</p>
                        <p class="spotlight-card__title">${title}</p>
                        <p class="spotlight-card__meta"><i class="fas fa-map-pin text-rose-400"></i> ${city}</p>
                    </div>
                </div>
                <p class="spotlight-card__reason">${reason}</p>
                <div class="spotlight-card__actions">
                    <button type="button" class="spotlight-chip spotlight-chip--primary" data-action="spotlight-invite" data-name="${name}">
                        <i class="fas fa-user-plus"></i>
                        Invite
                    </button>
                    <button type="button" class="spotlight-chip spotlight-chip--ghost" data-action="spotlight-message" data-name="${name}" data-email="${email}">
                        <i class="fas fa-comment-dots"></i>
                        Send a note
                    </button>
                </div>
            </article>
        `;
    }

    function bindRecommendationActions(scope) {
        if (!scope) {
            return;
        }
        scope.querySelectorAll('[data-action="spotlight-invite"]').forEach((button) => {
            button.addEventListener('click', () => {
                const name = button.dataset.name || '';
                window.aiSpotlight?.invite(name);
            });
        });
        scope.querySelectorAll('[data-action="spotlight-message"]').forEach((button) => {
            button.addEventListener('click', () => {
                const name = button.dataset.name || '';
                const email = button.dataset.email || '';
                window.aiSpotlight?.message(name, email);
            });
        });
        registerImageFallbacks(scope);
    }

    function buildClusterCard(cluster) {
        const icon = escapeHtml(cluster?.icon ?? 'fas fa-sparkles');
        const label = escapeHtml(cluster?.label ?? 'Emerging opportunity');
        const totalMembers = Number(cluster?.members?.length ?? cluster?.member_count ?? 0);
        const meta = totalMembers > 0
            ? `${totalMembers} aligned profile${totalMembers === 1 ? '' : 's'}`
            : 'Gathering more signal';
        const members = Array.isArray(cluster?.members) ? cluster.members.slice(0, 3) : [];

        const memberMarkup = members
            .map((member, index) => buildClusterMember(member, index))
            .join('') || '<div class="spotlight-cluster__member">We are still collecting signal for this cluster.</div>';

        return `
            <article class="spotlight-cluster">
                <div class="spotlight-cluster__header">
                    <div class="spotlight-cluster__icon"><i class="${icon}"></i></div>
                    <div>
                        <p class="spotlight-cluster__title">${label}</p>
                        <p class="spotlight-cluster__meta">${meta}</p>
                    </div>
                </div>
                <div class="spotlight-cluster__members">
                    ${memberMarkup}
                </div>
            </article>
        `;
    }

    function buildClusterMember(member, index) {
        const name = escapeHtml(member?.name ?? `Prospect ${index + 1}`);
        const reason = escapeHtml(member?.reason ?? member?.summary ?? 'High momentum match.');
        const score = member?.score ?? member?.match_score;
        const scoreBadge = Number.isFinite(Number(score))
            ? `<span class="spotlight-cluster__score">${Number(score)} score</span>`
            : '';

        return `
            <div class="spotlight-cluster__member">
                <span class="spotlight-cluster__name">${name}</span>
                ${scoreBadge}
                <p class="spotlight-cluster__reason">${reason}</p>
            </div>
        `;
    }

    function getEmptyRecommendations(message = 'Once we have more signal we will surface recommendations here.') {
        return `<div class="spotlight-empty">${message}</div>`;
    }

    function getEmptyClusters(message = 'Clusters appear once the AI senses repeating patterns in your network.') {
        return `<div class="spotlight-empty">${message}</div>`;
    }

    function getFallbackRecommendations() {
        return [
            { name: 'Sarah Johnson', title: 'Senior Product Manager', city: 'San Francisco', image: defaultAvatar, score: 92, reason: 'Product strategy maven • 5 shared tools • High collaboration energy.' },
            { name: 'Mike Chen', title: 'Full Stack Developer', city: 'San Francisco', image: defaultAvatar, score: 88, reason: 'Shipping similar stacks • Loves async stand-ups • Shared AI interest.' },
            { name: 'Emma Davis', title: 'UX Designer', city: 'San Jose', image: defaultAvatar, score: 85, reason: 'Design systems expert • Complementary storytelling strengths.' }
        ];
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

    function getFallbackClusters() {
        return [
            {
                icon: 'fas fa-camera-retro',
                label: 'Brand storytellers',
                members: [
                    { name: 'Ivy Roberts', reason: 'Narrative design wizard • Launch campaigns' },
                    { name: 'Liam Perez', reason: 'Documentary-style storytelling • Brand films' }
                ]
            },
            {
                icon: 'fas fa-champagne-glasses',
                label: 'Community hosts',
                members: [
                    { name: 'Jamie Rivera', reason: 'Curates intimate founder salons monthly.' },
                    { name: 'Anita Kapoor', reason: 'Community-led product launches pro.' }
                ]
            },
            {
                icon: 'fas fa-seedling',
                label: 'Wellness innovators',
                members: [
                    { name: 'Solana Lee', reason: 'Breathwork facilitator & retreat planner.' },
                    { name: 'Nico Hunt', reason: 'Holistic performance coach for creatives.' }
                ]
            }
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

    function revealFeedback(target, message) {
        if (!target) {
            return;
        }
        target.textContent = message;
        target.classList.remove('hidden');
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
                // Purposefully fall through to fallback below.
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

    window.aiSpotlight = {
        invite(name) {
            redirectToComposer(name, 'invite');
        },
        message(name, email) {
            if (email) {
                window.location.href = `mailto:${email}`;
                return;
            }
            redirectToComposer(name, 'message');
        }
    };

    function redirectToComposer(name, mode) {
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
        if (mode) {
            destination.searchParams.set('source', `ai-spotlight-${mode}`);
        }
        window.location.href = destination.toString();
    }
})();
</script>
@endpush

