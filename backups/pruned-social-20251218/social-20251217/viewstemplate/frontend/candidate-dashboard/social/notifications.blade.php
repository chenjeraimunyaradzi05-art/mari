<x-app-layout>
    @php
        $notificationsSource = $notifications
            ?? $alerts
            ?? (isset($userNotifications) ? $userNotifications : null)
            ?? (auth()->check() ? auth()->user()->notifications : null);

        if ($notificationsSource instanceof \Illuminate\Pagination\AbstractPaginator) {
            $notificationsCollection = $notificationsSource->getCollection();
        } elseif ($notificationsSource instanceof \Illuminate\Support\Collection) {
            $notificationsCollection = $notificationsSource;
        } elseif (is_array($notificationsSource)) {
            $notificationsCollection = collect($notificationsSource);
        } else {
            $notificationsCollection = collect();
        }

        $notificationsCollection = $notificationsCollection->filter();
        $totalNotifications = $notificationsCount ?? $notificationsCollection->count();
        $unreadCollection = $notificationsCollection->filter(function ($notification) {
            $readAt = data_get($notification, 'read_at');
            return empty($readAt);
        });
        $unreadTotal = $unreadCount ?? $unreadCollection->count();
        $priorityCollection = $notificationsCollection->filter(function ($notification) {
            $priority = strtolower((string) data_get($notification, 'data.priority', data_get($notification, 'priority', 'normal')));
            return in_array($priority, ['high', 'urgent', 'important'], true);
        });
        $priorityTotal = $priorityCollection->count();

        $latestNotification = $notificationsCollection->sortByDesc(function ($notification) {
            $timestamp = data_get($notification, 'created_at')
                ?? data_get($notification, 'updated_at')
                ?? data_get($notification, 'data.timestamp');

            if ($timestamp instanceof \Carbon\CarbonInterface) {
                return $timestamp->valueOf();
            }

            return $timestamp ? strtotime((string) $timestamp) : 0;
        })->first();

        $lastReceivedAt = data_get($latestNotification, 'created_at')
            ?? data_get($latestNotification, 'updated_at');
        $lastReceivedHuman = $lastReceivedAt instanceof \Carbon\CarbonInterface
            ? $lastReceivedAt->diffForHumans(null, true)
            : (is_string($lastReceivedAt) ? \Illuminate\Support\Str::limit($lastReceivedAt, 16) : null);

        $highlightNotifications = $unreadCollection->isNotEmpty()
            ? $unreadCollection->take(6)
            : $notificationsCollection->take(6);

        $formatNumber = function ($value) {
            return $value === null ? '—' : number_format((int) $value);
        };

        $hasMessagesRoute = \Illuminate\Support\Facades\Route::has('member.social.messages');
        $hasConnectionsRoute = \Illuminate\Support\Facades\Route::has('member.social.connections');
        $messagesUrl = $hasMessagesRoute ? route('member.social.messages') : null;
        $connectionsUrl = $hasConnectionsRoute ? route('member.social.connections') : null;
    @endphp

    <div class="notifications-dashboard container py-5 py-md-6">
        <section class="notifications-hero rounded-4 overflow-hidden">
            <div class="notifications-hero__background"></div>
            <div class="notifications-hero__container">
                <div class="notifications-hero__content">
                    <span class="notifications-hero__eyebrow">Signal Boosts</span>
                    <h1 class="notifications-hero__title">Stay tuned to every spark the community sends your way</h1>
                    <p class="notifications-hero__subtitle">From warm invites to project nods, keep your pulse on the gentle nudges guiding your next move.</p>
                    <div class="notifications-hero__cta">
                        <a href="{{ $messagesUrl ?? '#' }}" class="notifications-hero__primary" @unless($messagesUrl) aria-disabled="true" @endunless>
                            <i class="fas fa-comments me-2"></i>Open message center
                        </a>
                        <a href="{{ $connectionsUrl ?? '#' }}" class="notifications-hero__secondary" @unless($connectionsUrl) aria-disabled="true" @endunless>
                            <i class="fas fa-user-friends me-2"></i>Review connections
                        </a>
                    </div>
                </div>
                <div class="notifications-hero__metrics">
                    <div class="hero-stat hero-stat--lilac">
                        <span class="hero-stat__icon"><i class="fas fa-bell"></i></span>
                        <div>
                            <p class="hero-stat__label">Total Alerts</p>
                            <p class="hero-stat__value">{{ $formatNumber($totalNotifications) }}</p>
                            <p class="hero-stat__hint">Lifetime pings</p>
                        </div>
                    </div>
                    <div class="hero-stat hero-stat--rose">
                        <span class="hero-stat__icon"><i class="fas fa-envelope-open"></i></span>
                        <div>
                            <p class="hero-stat__label">Waiting For You</p>
                            <p class="hero-stat__value">{{ $formatNumber($unreadTotal) }}</p>
                            <p class="hero-stat__hint">Needs your glow</p>
                        </div>
                    </div>
                    <div class="hero-stat hero-stat--sunrise">
                        <span class="hero-stat__icon"><i class="fas fa-bolt"></i></span>
                        <div>
                            <p class="hero-stat__label">Priority Signals</p>
                            <p class="hero-stat__value">{{ $formatNumber($priorityTotal) }}</p>
                            <p class="hero-stat__hint">Urgent opportunities</p>
                        </div>
                    </div>
                    <div class="hero-stat hero-stat--indigo">
                        <span class="hero-stat__icon"><i class="fas fa-clock"></i></span>
                        <div>
                            <p class="hero-stat__label">Last Received</p>
                            <p class="hero-stat__value">{{ $lastReceivedHuman ?? '—' }}</p>
                            <p class="hero-stat__hint">Freshest ping</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section class="notifications-highlight mt-5">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-3">
                <div>
                    <h2 class="section-title mb-1">Quick Glances</h2>
                    <p class="section-subtitle mb-0">Jump straight to the alerts guiding today’s momentum</p>
                </div>
                <span class="status-pill">Curated for you</span>
            </div>

            <div class="notifications-highlight-strip">
                @forelse ($highlightNotifications as $notification)
                    @php
                        $title = data_get($notification, 'data.title')
                            ?? data_get($notification, 'data.heading')
                            ?? \Illuminate\Support\Str::of(data_get($notification, 'type', 'Notification'))->classBasename()->headline();
                        $shortTitle = \Illuminate\Support\Str::limit($title, 22);
                        $icon = data_get($notification, 'data.icon') ?? 'fa-bell';
                        $timestampForKey = data_get($notification, 'created_at')
                            ?? data_get($notification, 'updated_at');
                        if ($timestampForKey instanceof \Carbon\CarbonInterface) {
                            $timestampForKey = $timestampForKey->toIso8601String();
                        }
                        $notificationKey = data_get($notification, 'id')
                            ?? data_get($notification, 'uuid')
                            ?? (string) crc32($title . ($timestampForKey ?? ''));
                    @endphp
                    <button type="button" class="notifications-highlight-card" data-notification-target="notification-card-{{ $notificationKey }}">
                        <span class="notifications-highlight-card__icon">
                            <i class="fas {{ $icon }}"></i>
                        </span>
                        <span class="notifications-highlight-card__label">{{ $shortTitle }}</span>
                    </button>
                @empty
                    <div class="notifications-highlight-card notifications-highlight-card--empty">
                        <span class="notifications-highlight-card__icon"><i class="fas fa-bell-slash"></i></span>
                        <span class="notifications-highlight-card__label">All clear for now</span>
                    </div>
                @endforelse
            </div>
        </section>

        <section class="notifications-grid mt-5">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
                <div>
                    <h2 class="section-title mb-1">All Notifications</h2>
                    <p class="section-subtitle mb-0">Keep the rhythm going with timely acknowledgements</p>
                </div>
                <span class="status-pill">{{ $formatNumber($totalNotifications) }} total</span>
            </div>

            @if ($notificationsCollection->isNotEmpty())
                <div class="row g-4">
                    @foreach ($notificationsCollection as $notification)
                        @php
                            $title = data_get($notification, 'data.title')
                                ?? data_get($notification, 'data.heading')
                                ?? \Illuminate\Support\Str::of(data_get($notification, 'type', 'Notification'))->classBasename()->headline();
                            $message = data_get($notification, 'data.message')
                                ?? data_get($notification, 'data.body')
                                ?? data_get($notification, 'data.description');
                            $category = data_get($notification, 'data.category')
                                ?? data_get($notification, 'data.type')
                                ?? data_get($notification, 'type');
                            $categoryLabel = $category ? \Illuminate\Support\Str::of($category)->snake()->replace('_', ' ')->headline() : 'Update';
                            $priority = strtolower((string) data_get($notification, 'data.priority', 'normal'));
                            $isUnread = empty(data_get($notification, 'read_at'));
                            $timestamp = data_get($notification, 'created_at')
                                ?? data_get($notification, 'updated_at');
                            $timestampLabel = $timestamp instanceof \Carbon\CarbonInterface
                                ? $timestamp->diffForHumans()
                                : (is_string($timestamp) ? \Illuminate\Support\Str::limit($timestamp, 24) : 'Recently');
                            $icon = data_get($notification, 'data.icon');
                            $notificationKey = data_get($notification, 'id')
                                ?? data_get($notification, 'uuid')
                                ?? (string) crc32($title . $timestampLabel);
                        @endphp
                        <div class="col-md-6 col-xl-4">
                            <article class="notification-card{{ $isUnread ? ' notification-card--unread' : '' }}" id="notification-card-{{ $notificationKey }}">
                                <header class="notification-card__header">
                                    <span class="notification-badge notification-badge--{{ $priority }}">
                                        <i class="fas {{ $icon ? $icon : 'fa-bell' }} me-2"></i>{{ $categoryLabel }}
                                    </span>
                                    <time class="notification-card__timestamp">
                                        <i class="fas fa-clock me-1"></i>{{ $timestampLabel }}
                                    </time>
                                </header>
                                <div class="notification-card__body">
                                    <h3 class="notification-card__title">{{ $title }}</h3>
                                    @if ($message)
                                        <p class="notification-card__message">{{ \Illuminate\Support\Str::limit(strip_tags((string) $message), 150) }}</p>
                                    @endif
                                </div>
                                <footer class="notification-card__footer">
                                    <button type="button" class="chip-btn">
                                        <i class="fas fa-eye me-2"></i>View details
                                    </button>
                                    @if ($isUnread)
                                        <button type="button" class="chip-btn chip-btn--ghost">
                                            <i class="fas fa-check me-2"></i>Mark read
                                        </button>
                                    @endif
                                    <button type="button" class="chip-btn chip-btn--danger">
                                        <i class="fas fa-times me-2"></i>Clear
                                    </button>
                                </footer>
                            </article>
                        </div>
                    @endforeach
                </div>

                @if ($notificationsSource instanceof \Illuminate\Pagination\AbstractPaginator)
                    <div class="mt-4 d-flex justify-content-center">
                        {{ $notificationsSource->withQueryString()->links() }}
                    </div>
                @endif
            @else
                <div class="empty-state">
                    <div class="empty-state__icon">
                        <i class="fas fa-bell-slash"></i>
                    </div>
                    <h3 class="empty-state__title">Quiet skies today</h3>
                    <p class="empty-state__subtitle">When opportunities arrive, you’ll see them sparkle right here—keep shining in the meantime.</p>
                    <a href="{{ $connectionsUrl ?? '#' }}" class="chip-btn" @unless($connectionsUrl) aria-disabled="true" @endunless>
                        <i class="fas fa-user-plus me-2"></i>Grow your circle
                    </a>
                </div>
            @endif
        </section>
    </div>

    @push('scripts')
        <script>
            document.addEventListener('DOMContentLoaded', function () {
                var highlightButtons = document.querySelectorAll('[data-notification-target]');
                var notificationCards = document.querySelectorAll('.notification-card');

                highlightButtons.forEach(function (button) {
                    button.addEventListener('click', function () {
                        var targetId = button.getAttribute('data-notification-target');
                        var target = targetId ? document.getElementById(targetId) : null;

                        if (!target) {
                            return;
                        }

                        notificationCards.forEach(function (card) {
                            card.classList.remove('notification-card--active');
                        });

                        target.classList.add('notification-card--active');
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    });
                });
            });
        </script>
    @endpush
</x-app-layout>
