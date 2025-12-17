<x-app-layout>
    @php
        $messagesSource = $threads ?? $conversations ?? $messages ?? null;

        if ($messagesSource instanceof \Illuminate\Pagination\AbstractPaginator) {
            $messagesCollection = $messagesSource->getCollection();
        } elseif ($messagesSource instanceof \Illuminate\Support\Collection) {
            $messagesCollection = $messagesSource;
        } elseif (is_array($messagesSource)) {
            $messagesCollection = collect($messagesSource);
        } else {
            $messagesCollection = collect();
        }

        $messagesCollection = $messagesCollection->filter();
        $conversationsTotal = $conversationsCount ?? $messagesCollection->count();
        $unreadTotal = $unreadConversationsCount
            ?? $messagesCollection->filter(function ($thread) {
                $unread = (int) data_get($thread, 'unread_count', data_get($thread, 'unreadCount', 0));
                return $unread > 0;
            })->count();
        $unreadMessages = $unreadMessagesCount
            ?? $messagesCollection->reduce(function ($carry, $thread) {
                $unread = (int) data_get($thread, 'unread_count', data_get($thread, 'unreadCount', 0));
                return $carry + max($unread, 0);
            }, 0);
        $recentThread = $messagesCollection->sortByDesc(function ($thread) {
            $timestamp = data_get($thread, 'last_message_at')
                ?? data_get($thread, 'updated_at')
                ?? data_get($thread, 'created_at');

            return $timestamp instanceof \Carbon\CarbonInterface ? $timestamp->valueOf() : ($timestamp ? strtotime((string) $timestamp) : 0);
        })->first();
        $lastReplyAt = $lastReplyAt
            ?? data_get($recentThread, 'last_message_at')
            ?? data_get($recentThread, 'updated_at')
            ?? data_get($recentThread, 'created_at');
        $lastReplyHuman = $lastReplyAt instanceof \Carbon\CarbonInterface
            ? $lastReplyAt->diffForHumans(null, true)
            : (is_string($lastReplyAt) ? \Illuminate\Support\Str::limit($lastReplyAt, 16) : null);
        $defaultAvatar = asset('images/default-avatar.png');
        $conversationHighlights = $messagesCollection->take(6);

        $formatNumber = function ($value) {
            return $value === null ? '—' : number_format((int) $value);
        };
        $previewPlaceholder = 'Message hidden for privacy.';
        $formatMessagePreview = static function ($payload, string $fallback = '', int $limit = 110) use ($previewPlaceholder) {
            $isRedacted = false;
            $body = null;

            if (is_array($payload) || $payload instanceof \ArrayAccess) {
                $isRedacted = (bool) data_get($payload, 'is_redacted', false);
                $body = data_get($payload, 'body')
                    ?? data_get($payload, 'content')
                    ?? data_get($payload, 'metadata.preview');
            } elseif (is_object($payload)) {
                $isRedacted = (bool) ($payload->is_redacted ?? false);
                $body = $payload->body
                    ?? $payload->content
                    ?? data_get($payload, 'metadata.preview');
            } elseif (is_string($payload)) {
                $body = $payload;
            }

            if ($isRedacted) {
                return $previewPlaceholder;
            }

            if (is_string($body) && $body !== '') {
                return \Illuminate\Support\Str::limit(strip_tags($body), $limit);
            }

            return $fallback;
        };
    @endphp

    <div class="messages-dashboard container py-5 py-md-6">
        <section class="messages-hero rounded-4 overflow-hidden">
            <div class="messages-hero__background"></div>
            <div class="messages-hero__container">
                <div class="messages-hero__content">
                    <span class="messages-hero__eyebrow">Conversations</span>
                    <h1 class="messages-hero__title">Keep the dialogue glowing with the people who champion you</h1>
                    <p class="messages-hero__subtitle">Pick up momentum with quick replies, heartfelt check-ins, and gentle nudges to stay in flow with your warmest advocates.</p>
                    <div class="messages-hero__cta">
                        <a href="{{ route('member.social.connections', ['browse' => 1]) }}" class="messages-hero__primary">
                            <i class="fas fa-compass me-2"></i>Find new sparks
                        </a>
                        <a href="{{ route('member.social.connections') }}#start-conversation" class="messages-hero__secondary">
                            <i class="fas fa-paper-plane me-2"></i>Start a note
                        </a>
                    </div>
                </div>
                <div class="messages-hero__metrics">
                    <div class="hero-stat hero-stat--lilac">
                        <span class="hero-stat__icon">
                            <i class="fas fa-comments"></i>
                        </span>
                        <div>
                            <p class="hero-stat__label">Active Threads</p>
                            <p class="hero-stat__value">{{ $formatNumber($conversationsTotal) }}</p>
                            <p class="hero-stat__hint">Conversations in motion</p>
                        </div>
                    </div>
                    <div class="hero-stat hero-stat--rose">
                        <span class="hero-stat__icon">
                            <i class="fas fa-envelope"></i>
                        </span>
                        <div>
                            <p class="hero-stat__label">Waiting Replies</p>
                            <p class="hero-stat__value">{{ $formatNumber($unreadMessages) }}</p>
                            <p class="hero-stat__hint">Across {{ $formatNumber($unreadTotal) }} threads</p>
                        </div>
                    </div>
                    <div class="hero-stat hero-stat--sunrise">
                        <span class="hero-stat__icon">
                            <i class="fas fa-clock"></i>
                        </span>
                        <div>
                            <p class="hero-stat__label">Last Reply</p>
                            <p class="hero-stat__value">{{ $lastReplyHuman ?? '—' }}</p>
                            <p class="hero-stat__hint">Freshest conversation energy</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section class="messages-highlight mt-5">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-3">
                <div>
                    <h2 class="section-title mb-1">Quick Catch-ups</h2>
                    <p class="section-subtitle mb-0">Jump straight into the threads that are lighting up your inbox</p>
                </div>
                <span class="status-pill">Fresh conversations</span>
            </div>

            <div class="messages-highlight-strip">
                @forelse ($conversationHighlights as $thread)
                    @php
                        $otherUser = data_get($thread, 'otherUser');
                        $participantName = data_get($thread, 'name')
                            ?? data_get($thread, 'title')
                            ?? data_get($otherUser, 'name')
                            ?? data_get($thread, 'subject')
                            ?? 'Conversation';
                        $avatar = data_get($otherUser, 'avatar_url')
                            ?? data_get($otherUser, 'avatar')
                            ?? data_get($otherUser, 'profile_photo_url')
                            ?? $defaultAvatar;
                        $threadKey = data_get($thread, 'id')
                            ?? data_get($thread, 'conversation_id')
                            ?? data_get($thread, 'thread_id')
                            ?? (string) crc32($participantName);
                    @endphp
                    <button type="button" class="messages-highlight-card" data-thread-target="thread-card-{{ $threadKey }}">
                        <span class="messages-highlight-card__avatar">
                            <img src="{{ $avatar }}" alt="{{ $participantName }}">
                        </span>
                        <span class="messages-highlight-card__label">{{ \Illuminate\Support\Str::limit($participantName, 16) }}</span>
                    </button>
                @empty
                    <div class="messages-highlight-card messages-highlight-card--empty">
                        <span class="messages-highlight-card__avatar">
                            <i class="fas fa-sparkles"></i>
                        </span>
                        <span class="messages-highlight-card__label">No conversations yet</span>
                    </div>
                @endforelse
            </div>
        </section>

        <section class="messages-grid mt-5">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
                <div>
                    <h2 class="section-title mb-1">All Conversations</h2>
                    <p class="section-subtitle mb-0">Keep weaving connections with thoughtful follow-ups</p>
                </div>
                <span class="status-pill">{{ $formatNumber($conversationsTotal) }} total</span>
            </div>

            @if ($messagesCollection->isNotEmpty())
                <div class="row g-4">
                    @foreach ($messagesCollection as $thread)
                        @php
                            $otherUser = data_get($thread, 'otherUser');
                            $participantName = data_get($thread, 'name')
                                ?? data_get($thread, 'title')
                                ?? data_get($otherUser, 'name')
                                ?? data_get($thread, 'subject')
                                ?? 'Conversation';
                            $avatar = data_get($otherUser, 'avatar_url')
                                ?? data_get($otherUser, 'avatar')
                                ?? data_get($otherUser, 'profile_photo_url')
                                ?? $defaultAvatar;
                            $lastMessagePayload = data_get($thread, 'last_message')
                                ?? data_get($thread, 'body')
                                ?? data_get($thread, 'message');
                            $lastExcerpt = $formatMessagePreview(
                                $lastMessagePayload,
                                'Drop a note to keep the glow alive.',
                                110
                            );
                            $unread = (int) data_get($thread, 'unread_count', data_get($thread, 'unreadCount', 0));
                            $timestamp = data_get($thread, 'last_message_at')
                                ?? data_get($thread, 'updated_at')
                                ?? data_get($thread, 'created_at');
                            $timestampLabel = $timestamp instanceof \Carbon\CarbonInterface
                                ? $timestamp->diffForHumans()
                                : (is_string($timestamp) ? \Illuminate\Support\Str::limit($timestamp, 24) : 'Recently');
                            $threadKey = data_get($thread, 'id')
                                ?? data_get($thread, 'conversation_id')
                                ?? data_get($thread, 'thread_id')
                                ?? (string) crc32($participantName . $timestampLabel);
                        @endphp
                        <div class="col-md-6 col-xl-4">
                            <article class="conversation-card" id="thread-card-{{ $threadKey }}">
                                <header class="conversation-card__header">
                                    <div class="conversation-card__avatar">
                                        <img src="{{ $avatar }}" alt="{{ $participantName }}">
                                        @if ($unread > 0)
                                            <span class="conversation-card__badge">{{ $unread }}</span>
                                        @endif
                                    </div>
                                    <div class="conversation-card__meta">
                                        <h3 class="conversation-card__title">{{ $participantName }}</h3>
                                        <p class="conversation-card__timestamp">
                                            <i class="fas fa-clock me-1"></i>{{ $timestampLabel }}
                                        </p>
                                    </div>
                                    <button type="button" class="conversation-card__menu" title="Conversation actions">
                                        <i class="fas fa-ellipsis-v"></i>
                                    </button>
                                </header>
                                <div class="conversation-card__body">
                                    <p class="conversation-card__excerpt">{{ $lastExcerpt }}</p>
                                </div>
                                <footer class="conversation-card__footer">
                                    <button type="button" class="chip-btn">
                                        <i class="fas fa-reply me-2"></i>Reply now
                                    </button>
                                    <button type="button" class="chip-btn chip-btn--ghost">
                                        <i class="fas fa-bookmark me-2"></i>Archive</button>
                                </footer>
                            </article>
                        </div>
                    @endforeach
                </div>

                @if ($messagesSource instanceof \Illuminate\Pagination\AbstractPaginator)
                    <div class="mt-4 d-flex justify-content-center">
                        {{ $messagesSource->withQueryString()->links() }}
                    </div>
                @endif
            @else
                <div class="empty-state">
                    <div class="empty-state__icon">
                        <i class="fas fa-comment-dots"></i>
                    </div>
                    <h3 class="empty-state__title">Ready for heartfelt updates</h3>
                    <p class="empty-state__subtitle">Keep your network warm with a gentle check-in or a note of gratitude today.</p>
                    <a href="{{ route('member.social.connections', ['browse' => 1]) }}" class="chip-btn">
                        <i class="fas fa-hands-helping me-2"></i>Discover someone new
                    </a>
                </div>
            @endif
        </section>
    </div>

    @push('scripts')
        <script>
            document.addEventListener('DOMContentLoaded', function () {
                var highlightButtons = document.querySelectorAll('[data-thread-target]');
                var threadCards = document.querySelectorAll('.conversation-card');

                highlightButtons.forEach(function (button) {
                    button.addEventListener('click', function () {
                        var targetId = button.getAttribute('data-thread-target');
                        var target = targetId ? document.getElementById(targetId) : null;

                        if (!target) {
                            return;
                        }

                        threadCards.forEach(function (card) {
                            card.classList.remove('conversation-card--active');
                        });

                        target.classList.add('conversation-card--active');
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    });
                });
            });
        </script>
    @endpush
</x-app-layout>
