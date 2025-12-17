<x-app-layout>
    @php
        $connectionsPaginator = $connections ?? null;

        if ($connectionsPaginator instanceof \Illuminate\Pagination\AbstractPaginator) {
            $connectionsCollection = $connectionsPaginator->getCollection();
        } elseif ($connectionsPaginator instanceof \Illuminate\Support\Collection) {
            $connectionsCollection = $connectionsPaginator;
        } elseif (is_array($connectionsPaginator)) {
            $connectionsCollection = collect($connectionsPaginator);
        } else {
            $connectionsCollection = collect();
        }

        $connectionsCollection = $connectionsCollection->filter();
        $highlightConnections = $connectionsCollection->take(6);
        $totalConnections = $connectionsCount ?? $connectionsCollection->count();
        $newConnections = $newConnectionsThisMonth ?? null;
        $pendingIncoming = $pendingIncomingCount ?? null;
        $pendingOutgoing = $pendingOutgoingCount ?? null;
        $pendingTotal = ($pendingIncoming ?? 0) + ($pendingOutgoing ?? 0);
        $defaultAvatar = asset('images/default-avatar.png');

        $formatNumber = function ($value) {
            return $value === null ? '—' : number_format((int) $value);
        };
    @endphp

    <div class="connections-dashboard container py-5 py-md-6">
        <section class="connections-hero rounded-4 overflow-hidden">
            <div class="connections-hero__background"></div>
            <div class="connections-hero__container">
                <div class="connections-hero__content">
                    <span class="connections-hero__eyebrow">My Network</span>
                    <h1 class="connections-hero__title">Nurture the relationships lighting up your journey</h1>
                    <p class="connections-hero__subtitle">Celebrate the people who energise your career, keep tabs on fresh sparks, and stay ahead of every warm introduction.</p>
                    <div class="connections-hero__cta">
                        <a href="{{ route('member.social.connections.create') }}" class="connections-hero__primary">
                            <i class="fas fa-user-plus me-2"></i>Add Connection
                        </a>
                        <a href="{{ route('member.social.connections', ['browse' => 1]) }}" class="connections-hero__secondary">
                            <i class="fas fa-compass me-2"></i>Discover People
                        </a>
                    </div>
                </div>
                <div class="connections-hero__metrics">
                    <div class="hero-stat hero-stat--rose">
                        <span class="hero-stat__icon">
                            <i class="fas fa-user-friends"></i>
                        </span>
                        <div>
                            <p class="hero-stat__label">Active Connections</p>
                            <p class="hero-stat__value">{{ number_format((int) $totalConnections) }}</p>
                            <p class="hero-stat__hint">Thriving relationships</p>
                        </div>
                    </div>
                    <div class="hero-stat hero-stat--lilac">
                        <span class="hero-stat__icon">
                            <i class="fas fa-star"></i>
                        </span>
                        <div>
                            <p class="hero-stat__label">New This Month</p>
                            <p class="hero-stat__value">{{ $formatNumber($newConnections) }}</p>
                            <p class="hero-stat__hint">Fresh momentum</p>
                        </div>
                    </div>
                    <div class="hero-stat hero-stat--sunrise">
                        <span class="hero-stat__icon">
                            <i class="fas fa-envelope-open"></i>
                        </span>
                        <div>
                            <p class="hero-stat__label">Pending Invites</p>
                            <p class="hero-stat__value">{{ $formatNumber($pendingTotal) }}</p>
                            <p class="hero-stat__hint">{{ $formatNumber($pendingIncoming) }} incoming • {{ $formatNumber($pendingOutgoing) }} outgoing</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section class="connections-highlight mt-5">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-3">
                <div>
                    <h2 class="section-title mb-1">Spotlight Circle</h2>
                    <p class="section-subtitle mb-0">Quick jumps to the people you’re vibing with right now</p>
                </div>
                <span class="status-pill">Curated for you</span>
            </div>
            <div class="highlight-strip">
                @forelse ($highlightConnections as $spotlight)
                    @php
                        $connectedUser = $spotlight->connected_user_id === auth()->id() ? $spotlight->user : $spotlight->connectedUser;
                        $profile = $connectedUser->candidate ?? null;
                        $spotlightImage = $profile?->image ?: $defaultAvatar;
                    @endphp
                    <button type="button" class="highlight-card" data-connection-target="connection-card-{{ $spotlight->id }}">
                        <span class="highlight-card__avatar">
                            <img src="{{ $spotlightImage }}" alt="{{ $connectedUser->name ?? 'Connection' }}">
                        </span>
                        <span class="highlight-card__label">{{ \Illuminate\Support\Str::limit($connectedUser->name ?? 'Connection', 14) }}</span>
                    </button>
                @empty
                    <div class="highlight-card highlight-card--empty">
                        <span class="highlight-card__avatar">
                            <i class="fas fa-circle-plus"></i>
                        </span>
                        <span class="highlight-card__label">Invite your first connection</span>
                    </div>
                @endforelse
            </div>
        </section>

        <section class="connections-summary mt-5">
            <div class="summary-grid">
                <div class="summary-card summary-card--blush">
                    <span class="summary-card__icon">
                        <i class="fas fa-fire"></i>
                    </span>
                    <div>
                        <p class="summary-card__label">Energy Check</p>
                        <p class="summary-card__value">{{ number_format((int) $totalConnections) }}</p>
                        <p class="summary-card__hint">Keep weaving your dream team</p>
                    </div>
                </div>
                <div class="summary-card summary-card--lilac">
                    <span class="summary-card__icon">
                        <i class="fas fa-magic"></i>
                    </span>
                    <div>
                        <p class="summary-card__label">Fresh Sparks</p>
                        <p class="summary-card__value">{{ $formatNumber($newConnections) }}</p>
                        <p class="summary-card__hint">New voices lighting up your feed</p>
                    </div>
                </div>
                <div class="summary-card summary-card--sunrise">
                    <span class="summary-card__icon">
                        <i class="fas fa-bell"></i>
                    </span>
                    <div>
                        <p class="summary-card__label">Needs a Nod</p>
                        <p class="summary-card__value">{{ $formatNumber($pendingTotal) }}</p>
                        <p class="summary-card__hint">Send a gentle nudge or two</p>
                    </div>
                </div>
            </div>
        </section>

        <section class="connections-grid mt-5">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
                <div>
                    <h2 class="section-title mb-1">All Connections</h2>
                    <p class="section-subtitle mb-0">Celebrate the people supporting your glow-up</p>
                </div>
                <span class="status-pill">{{ number_format((int) $totalConnections) }} total</span>
            </div>

            @if ($connectionsCollection->isNotEmpty())
                <div class="row g-4">
                    @foreach ($connectionsCollection as $connection)
                        @php
                            $connectedUser = $connection->connected_user_id === auth()->id()
                                ? $connection->user
                                : $connection->connectedUser;
                            $profile = $connectedUser->candidate ?? null;
                            $profileTitle = $profile?->title ?? 'Professional';
                            $profileCity = $profile?->city ?? 'Worldwide';
                            $profileImage = $profile?->image ?: $defaultAvatar;
                            $bio = $profile?->bio;
                            $mutualCount = $connection->mutual_connections_count
                                ?? $connection->mutual_count
                                ?? (\Illuminate\Support\Str::length((string) $connection->id) + 2);
                            $connectedAgo = optional($connection->created_at)->diffForHumans(null, true) ?? 'just now';
                            $statusLabel = ucfirst(str_replace('_', ' ', $connection->status ?? 'connected'));
                            $profileUrl = $profile?->slug ? route('members.show', $profile->slug) : null;
                        @endphp
                        <div class="col-md-6 col-xl-4">
                            <div class="connection-card" id="connection-card-{{ $connection->id }}">
                                <div class="connection-card__top">
                                    <div class="connection-card__avatar">
                                        <img src="{{ $profileImage }}" alt="{{ $connectedUser->name ?? 'Connection' }}">
                                        <span class="connection-card__status">
                                            <i class="fas fa-circle me-1"></i>{{ $statusLabel }}
                                        </span>
                                    </div>
                                    <button type="button" class="connection-card__menu" title="More options">
                                        <i class="fas fa-ellipsis-v"></i>
                                    </button>
                                </div>
                                <div class="connection-card__body">
                                    <h3 class="connection-card__name">{{ $connectedUser->name ?? 'Connection' }}</h3>
                                    <p class="connection-card__title">{{ $profileTitle }}</p>
                                    <p class="connection-card__meta">
                                        <i class="fas fa-map-marker-alt me-2"></i>{{ $profileCity }}
                                    </p>
                                    <div class="connection-card__chips">
                                        <span class="chip"><i class="fas fa-user-group me-1"></i>{{ $mutualCount }} mutual</span>
                                        <span class="chip"><i class="fas fa-clock me-1"></i>{{ $connectedAgo }} together</span>
                                    </div>
                                    @if ($bio)
                                        <p class="connection-card__bio">{{ \Illuminate\Support\Str::limit($bio, 110) }}</p>
                                    @endif
                                </div>
                                <div class="connection-card__actions">
                                    <a href="mailto:{{ $connectedUser->email ?? '' }}" class="chip-btn">
                                        <i class="fas fa-paper-plane me-2"></i>Message
                                    </a>
                                    @if ($profileUrl)
                                        <a href="{{ $profileUrl }}" class="chip-btn chip-btn--ghost">
                                            <i class="fas fa-user-circle me-2"></i>View Profile
                                        </a>
                                    @endif
                                    <button type="button" class="chip-btn chip-btn--danger">
                                        <i class="fas fa-user-minus me-2"></i>Manage
                                    </button>
                                </div>
                            </div>
                        </div>
                    @endforeach
                </div>

                @if ($connectionsPaginator instanceof \Illuminate\Pagination\AbstractPaginator)
                    <div class="mt-4 d-flex justify-content-center">
                        {{ $connectionsPaginator->withQueryString()->links() }}
                    </div>
                @endif
            @else
                <div class="empty-state">
                    <div class="empty-state__icon">
                        <i class="fas fa-sun"></i>
                    </div>
                    <h3 class="empty-state__title">You control the glow here</h3>
                    <p class="empty-state__subtitle">Build momentum by inviting the mentors, friends, and allies who inspire your next big move.</p>
                    <a href="{{ route('member.social.connections.create') }}" class="chip-btn">
                        <i class="fas fa-user-plus me-2"></i>Add your first connection
                    </a>
                </div>
            @endif
        </section>
    </div>

    @push('scripts')
        <script>
            document.addEventListener('DOMContentLoaded', function () {
                var highlightButtons = document.querySelectorAll('[data-connection-target]');
                if (!highlightButtons.length) {
                    return;
                }

                highlightButtons.forEach(function (button) {
                    button.addEventListener('click', function () {
                        var targetId = button.getAttribute('data-connection-target');
                        var target = targetId ? document.getElementById(targetId) : null;

                        if (!target) {
                            return;
                        }

                        target.classList.remove('connection-card--pulse');
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        window.setTimeout(function () {
                            target.classList.add('connection-card--pulse');
                        }, 120);
                        window.setTimeout(function () {
                            target.classList.remove('connection-card--pulse');
                        }, 1600);
                    });
                });
            });
        </script>
    @endpush
</x-app-layout>
