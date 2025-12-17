<x-app-layout>
    @php
        $invitationsSource = $invitations
            ?? $invites
            ?? $invitationsList
            ?? null;

        if ($invitationsSource instanceof \Illuminate\Pagination\AbstractPaginator) {
            $invitationsCollection = $invitationsSource->getCollection();
        } elseif ($invitationsSource instanceof \Illuminate\Support\Collection) {
            $invitationsCollection = $invitationsSource;
        } elseif (is_array($invitationsSource)) {
            $invitationsCollection = collect($invitationsSource);
        } else {
            $invitationsCollection = collect();
        }

        $invitationsCollection = $invitationsCollection->filter();

        $totalInvitations = $invitationsCount
            ?? ($invitationsSource instanceof \Illuminate\Pagination\AbstractPaginator
                ? $invitationsSource->total()
                : $invitationsCollection->count());

        $pendingCollection = $invitationsCollection->filter(function ($invitation) {
            $status = strtolower((string) data_get($invitation, 'status', 'pending'));
            return $status === 'pending';
        });
        $acceptedCollection = $invitationsCollection->filter(function ($invitation) {
            $status = strtolower((string) data_get($invitation, 'status'));
            return $status === 'accepted';
        });
        $rejectedCollection = $invitationsCollection->filter(function ($invitation) {
            $status = strtolower((string) data_get($invitation, 'status'));
            return $status === 'rejected';
        });

        $pendingTotal = $pendingCount ?? $pendingCollection->count();
        $acceptedTotal = $acceptedCollection->count();
        $rejectedTotal = $rejectedCollection->count();

        $typeBreakdown = $invitationsCollection
            ->groupBy(function ($invitation) {
                return strtolower((string) data_get($invitation, 'type', 'connection'));
            })
            ->map(function ($groupedInvitations) {
                return $groupedInvitations instanceof \Illuminate\Support\Collection
                    ? $groupedInvitations->count()
                    : (is_array($groupedInvitations) ? count($groupedInvitations) : 0);
            })
            ->sortDesc();

        $primaryInviteType = $typeBreakdown->keys()->first();
        $primaryInviteTypeLabel = $primaryInviteType
            ? \Illuminate\Support\Str::of($primaryInviteType)->replace('_', ' ')->headline()
            : 'Connection';

        $latestInvitation = $invitationsCollection->sortByDesc(function ($invitation) {
            $timestamp = data_get($invitation, 'created_at')
                ?? data_get($invitation, 'updated_at');

            if ($timestamp instanceof \Carbon\CarbonInterface) {
                return $timestamp->valueOf();
            }

            return $timestamp ? strtotime((string) $timestamp) : 0;
        })->first();

        $latestInviteAt = data_get($latestInvitation, 'created_at')
            ?? data_get($latestInvitation, 'updated_at');
        $latestInviteHuman = $latestInviteAt instanceof \Carbon\CarbonInterface
            ? $latestInviteAt->diffForHumans(null, true)
            : (is_string($latestInviteAt) ? \Illuminate\Support\Str::limit($latestInviteAt, 16) : null);

        $highlightInvitations = $pendingCollection->isNotEmpty()
            ? $pendingCollection->take(6)
            : $invitationsCollection->take(6);

        $formatNumber = function ($value) {
            return $value === null ? '—' : number_format((int) $value);
        };

        $defaultAvatar = asset('images/default-avatar.png');

        $hasConnectionsCreate = \Illuminate\Support\Facades\Route::has('member.social.connections.create');
        $hasConnectionsDiscover = \Illuminate\Support\Facades\Route::has('member.social.connections.discover');
        $hasConnectionsIndex = \Illuminate\Support\Facades\Route::has('member.social.connections');

        $createInviteUrl = $hasConnectionsCreate ? route('member.social.connections.create') : null;
        $discoverConnectionsUrl = $hasConnectionsDiscover
            ? route('member.social.connections.discover')
            : ($hasConnectionsIndex ? route('member.social.connections') : null);
    @endphp

    <div class="invites-dashboard container py-5 py-md-6">
        <section class="invites-hero rounded-4 overflow-hidden">
            <div class="invites-hero__background"></div>
            <div class="invites-hero__container">
                <div class="invites-hero__content">
                    <span class="invites-hero__eyebrow">Connection Pathways</span>
                    <h1 class="invites-hero__title">Open the doors that keep your circle expanding</h1>
                    <p class="invites-hero__subtitle">Keep sight of every warm request, celebrate the yeses, and follow up where a little glow of presence can make the difference.</p>
                    <div class="invites-hero__cta">
                        <a href="{{ $createInviteUrl ?? '#' }}" class="invites-hero__primary" @unless($createInviteUrl) aria-disabled="true" @endunless>
                            <i class="fas fa-paper-plane me-2"></i>Send an invite
                        </a>
                        <a href="{{ $discoverConnectionsUrl ?? '#' }}" class="invites-hero__secondary" @unless($discoverConnectionsUrl) aria-disabled="true" @endunless>
                            <i class="fas fa-compass me-2"></i>Explore community
                        </a>
                    </div>
                </div>
                <div class="invites-hero__metrics">
                    <div class="hero-stat hero-stat--lilac">
                        <span class="hero-stat__icon"><i class="fas fa-envelope-open"></i></span>
                        <div>
                            <p class="hero-stat__label">All Invitations</p>
                            <p class="hero-stat__value">{{ $formatNumber($totalInvitations) }}</p>
                            <p class="hero-stat__hint">Lifetime reach-outs</p>
                        </div>
                    </div>
                    <div class="hero-stat hero-stat--rose">
                        <span class="hero-stat__icon"><i class="fas fa-hourglass-half"></i></span>
                        <div>
                            <p class="hero-stat__label">Awaiting Reply</p>
                            <p class="hero-stat__value">{{ $formatNumber($pendingTotal) }}</p>
                            <p class="hero-stat__hint">Gentle nudges welcome</p>
                        </div>
                    </div>
                    <div class="hero-stat hero-stat--sunrise">
                        <span class="hero-stat__icon"><i class="fas fa-handshake"></i></span>
                        <div>
                            <p class="hero-stat__label">Warm Welcomes</p>
                            <p class="hero-stat__value">{{ $formatNumber($acceptedTotal) }}</p>
                            <p class="hero-stat__hint">{{ $formatNumber($rejectedTotal) }} declined • {{ $primaryInviteTypeLabel }}</p>
                        </div>
                    </div>
                    <div class="hero-stat hero-stat--indigo">
                        <span class="hero-stat__icon"><i class="fas fa-clock"></i></span>
                        <div>
                            <p class="hero-stat__label">Last Activity</p>
                            <p class="hero-stat__value">{{ $latestInviteHuman ?? '—' }}</p>
                            <p class="hero-stat__hint">Most recent touchpoint</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section class="invites-highlight mt-5">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-3">
                <div>
                    <h2 class="section-title mb-1">Quick follow-ups</h2>
                    <p class="section-subtitle mb-0">Spot the invites where a timely response keeps momentum humming</p>
                </div>
                <span class="status-pill">Curated from your queue</span>
            </div>

            <div class="invites-highlight-strip">
                @forelse ($highlightInvitations as $invite)
                    @php
                        $status = strtolower((string) data_get($invite, 'status', 'pending'));
                        $type = strtolower((string) data_get($invite, 'type', 'connection'));
                        $sender = data_get($invite, 'sender');
                        $senderName = data_get($sender, 'name', 'Connection');
                        $typeLabel = \Illuminate\Support\Str::of($type)->replace('_', ' ')->headline();
                        $typeIconMap = [
                            'connection' => 'fa-handshake',
                            'group' => 'fa-users',
                            'event' => 'fa-calendar-alt',
                            'collaboration' => 'fa-lightbulb',
                        ];
                        $typeIcon = $typeIconMap[$type] ?? 'fa-handshake';
                        $timestampForKey = data_get($invite, 'created_at') ?? data_get($invite, 'updated_at');
                        if ($timestampForKey instanceof \Carbon\CarbonInterface) {
                            $timestampForKey = $timestampForKey->toIso8601String();
                        }
                        $inviteKey = data_get($invite, 'id')
                            ?? data_get($invite, 'uuid')
                            ?? (string) crc32($senderName . $type . ($timestampForKey ?? ''));
                    @endphp
                    <button type="button" class="invites-highlight-card invites-highlight-card--{{ $status }}" data-invite-target="invite-card-{{ $inviteKey }}">
                        <span class="invites-highlight-card__icon"><i class="fas {{ $typeIcon }}"></i></span>
                        <span class="invites-highlight-card__label">{{ \Illuminate\Support\Str::limit($senderName, 22) }}</span>
                        <span class="invites-highlight-card__meta">{{ $typeLabel }}</span>
                    </button>
                @empty
                    <div class="invites-highlight-card invites-highlight-card--empty">
                        <span class="invites-highlight-card__icon"><i class="fas fa-magic"></i></span>
                        <span class="invites-highlight-card__label">No invites waiting</span>
                        <span class="invites-highlight-card__meta">Send a fresh hello</span>
                    </div>
                @endforelse
            </div>
        </section>

        <section class="invites-grid mt-5">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
                <div>
                    <h2 class="section-title mb-1">All Invitations</h2>
                    <p class="section-subtitle mb-0">Keep the rhythm of your outreach steady and sincere</p>
                </div>
                <span class="status-pill">{{ $formatNumber($totalInvitations) }} total</span>
            </div>

            @if ($invitationsCollection->isNotEmpty())
                <div class="row g-4">
                    @foreach ($invitationsCollection as $invite)
                        @php
                            $status = strtolower((string) data_get($invite, 'status', 'pending'));
                            $statusLabel = \Illuminate\Support\Str::of($status)->replace('_', ' ')->headline();
                            $type = strtolower((string) data_get($invite, 'type', 'connection'));
                            $typeLabel = \Illuminate\Support\Str::of($type)->replace('_', ' ')->headline();
                            $sender = data_get($invite, 'sender');
                            $senderName = data_get($sender, 'name', 'Connection');
                            $senderProfile = data_get($sender, 'candidate');
                            $senderTitle = data_get($senderProfile, 'title', 'Professional cadence');
                            $senderLocation = data_get($senderProfile, 'city')
                                ?? data_get($senderProfile, 'country')
                                ?? 'Across the globe';
                            $senderAvatar = data_get($senderProfile, 'image') ?: $defaultAvatar;
                            $message = data_get($invite, 'message');
                            $sentAt = data_get($invite, 'created_at') ?? data_get($invite, 'updated_at');
                            $sentAtLabel = $sentAt instanceof \Carbon\CarbonInterface
                                ? $sentAt->diffForHumans()
                                : (is_string($sentAt) ? \Illuminate\Support\Str::limit($sentAt, 24) : 'Recently');
                            $typeIconMap = [
                                'connection' => 'fa-handshake',
                                'group' => 'fa-users',
                                'event' => 'fa-calendar-alt',
                                'collaboration' => 'fa-lightbulb',
                            ];
                            $typeIcon = $typeIconMap[$type] ?? 'fa-handshake';
                            $inviteKey = data_get($invite, 'id')
                                ?? data_get($invite, 'uuid')
                                ?? (string) crc32($senderName . $type . $sentAtLabel);
                        @endphp
                        <div class="col-md-6 col-xl-4">
                            <article class="invite-card invite-card--{{ $status }}" id="invite-card-{{ $inviteKey }}">
                                <header class="invite-card__header">
                                    <div class="invite-card__sender">
                                        <span class="invite-card__avatar">
                                            <img src="{{ $senderAvatar }}" alt="{{ $senderName }}">
                                        </span>
                                        <div>
                                            <h3 class="invite-card__name">{{ \Illuminate\Support\Str::limit($senderName, 32) }}</h3>
                                            <p class="invite-card__title">{{ \Illuminate\Support\Str::limit($senderTitle, 42) }}</p>
                                            <p class="invite-card__meta">
                                                <i class="fas fa-map-marker-alt me-1"></i>{{ $senderLocation }}
                                            </p>
                                        </div>
                                    </div>
                                    <div class="invite-card__status">
                                        <span class="invite-status-badge invite-status-badge--{{ $status }}">
                                            <i class="fas fa-circle me-1"></i>{{ $statusLabel }}
                                        </span>
                                        <time class="invite-card__timestamp">
                                            <i class="fas fa-clock me-1"></i>{{ $sentAtLabel }}
                                        </time>
                                    </div>
                                </header>
                                <div class="invite-card__body">
                                    <span class="invite-card__pill">
                                        <i class="fas {{ $typeIcon }} me-2"></i>{{ $typeLabel }} invite
                                    </span>
                                    @if ($message)
                                        <p class="invite-card__message">{{ \Illuminate\Support\Str::limit(strip_tags((string) $message), 180) }}</p>
                                    @else
                                        <p class="invite-card__message invite-card__message--muted">No personal note included—follow up with a warm hello if you feel called.</p>
                                    @endif
                                </div>
                                <footer class="invite-card__footer">
                                    <button type="button" class="chip-btn">
                                        <i class="fas fa-comments me-2"></i>Send a note
                                    </button>
                                    @if ($status === 'pending')
                                        <button type="button" class="chip-btn chip-btn--success">
                                            <i class="fas fa-check me-2"></i>Accept invite
                                        </button>
                                        <button type="button" class="chip-btn chip-btn--danger">
                                            <i class="fas fa-times me-2"></i>Decline
                                        </button>
                                    @else
                                        <button type="button" class="chip-btn chip-btn--ghost">
                                            <i class="fas fa-redo me-2"></i>Review history
                                        </button>
                                    @endif
                                </footer>
                            </article>
                        </div>
                    @endforeach
                </div>

                @if ($invitationsSource instanceof \Illuminate\Pagination\AbstractPaginator)
                    <div class="mt-4 d-flex justify-content-center">
                        {{ $invitationsSource->withQueryString()->links() }}
                    </div>
                @endif
            @else
                <div class="empty-state">
                    <div class="empty-state__icon">
                        <i class="fas fa-envelope-open"></i>
                    </div>
                    <h3 class="empty-state__title">Inbox is clear</h3>
                    <p class="empty-state__subtitle">You’re all caught up—spark a new introduction or revisit past connections to keep things flowing.</p>
                    <a href="{{ $createInviteUrl ?? '#' }}" class="chip-btn" @unless($createInviteUrl) aria-disabled="true" @endunless>
                        <i class="fas fa-paper-plane me-2"></i>Share a fresh invite
                    </a>
                </div>
            @endif
        </section>
    </div>

    @push('scripts')
        <script>
            document.addEventListener('DOMContentLoaded', function () {
                var inviteHighlightButtons = document.querySelectorAll('[data-invite-target]');
                var inviteCards = document.querySelectorAll('.invite-card');

                inviteHighlightButtons.forEach(function (button) {
                    button.addEventListener('click', function () {
                        var targetId = button.getAttribute('data-invite-target');
                        var target = targetId ? document.getElementById(targetId) : null;

                        if (!target) {
                            return;
                        }

                        inviteCards.forEach(function (card) {
                            card.classList.remove('invite-card--active');
                        });

                        target.classList.add('invite-card--active');
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    });
                });
            });
        </script>
    @endpush
</x-app-layout>
