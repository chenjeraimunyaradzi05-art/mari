<x-app-layout>
    @php
        $postsSource = $posts ?? $userPosts ?? $articles ?? null;

        if ($postsSource instanceof \Illuminate\Pagination\AbstractPaginator) {
            $postsCollection = $postsSource->getCollection();
        } elseif ($postsSource instanceof \Illuminate\Support\Collection) {
            $postsCollection = $postsSource;
        } elseif (is_array($postsSource)) {
            $postsCollection = collect($postsSource);
        } else {
            $postsCollection = collect();
        }

        $postsCollection = $postsCollection->filter();
        $publishedCollection = $postsCollection->filter(function ($post) {
            $status = strtolower((string) data_get($post, 'status', 'published'));
            return in_array($status, ['published', 'live', 'scheduled', 'draft'], true) ? $status !== 'draft' : true;
        });

        $postsTotal = $postsCount ?? $postsCollection->count();
        $publishedTotal = $publishedCollection->count();
        $averageReach = $averageReach ?? $postsCollection->average(function ($post) {
            $reach = data_get($post, 'reach')
                ?? data_get($post, 'views')
                ?? data_get($post, 'impressions');

            return is_numeric($reach) ? (int) $reach : null;
        });

        $recentPost = $postsCollection->sortByDesc(function ($post) {
            $timestamp = data_get($post, 'published_at')
                ?? data_get($post, 'updated_at')
                ?? data_get($post, 'created_at');

            if ($timestamp instanceof \Carbon\CarbonInterface) {
                return $timestamp->valueOf();
            }

            return $timestamp ? strtotime((string) $timestamp) : 0;
        })->first();

        $lastPublishedAt = $lastPublishedAt
            ?? data_get($recentPost, 'published_at')
            ?? data_get($recentPost, 'updated_at')
            ?? data_get($recentPost, 'created_at');
        $lastPublishedHuman = $lastPublishedAt instanceof \Carbon\CarbonInterface
            ? $lastPublishedAt->diffForHumans(null, true)
            : (is_string($lastPublishedAt) ? \Illuminate\Support\Str::limit($lastPublishedAt, 16) : null);

        $featuredPosts = $postsCollection->sortByDesc(function ($post) {
            $engagement = (int) data_get($post, 'engagement_score', 0)
                + (int) data_get($post, 'likes', 0)
                + (int) data_get($post, 'comments', 0);

            $timestamp = data_get($post, 'published_at')
                ?? data_get($post, 'updated_at')
                ?? data_get($post, 'created_at');

            if ($timestamp instanceof \Carbon\CarbonInterface) {
                $timestamp = $timestamp->valueOf();
            } elseif (is_string($timestamp)) {
                $timestamp = strtotime($timestamp) ?: 0;
            } else {
                $timestamp = 0;
            }

            return $engagement + $timestamp;
        })->take(6);

        $formatNumber = function ($value) {
            return $value === null ? '—' : number_format((int) $value);
        };

        $hasPostCreateRoute = \Illuminate\Support\Facades\Route::has('member.social.posts.create');
        $hasPostIndexRoute = \Illuminate\Support\Facades\Route::has('member.social.posts');
        $hasPostShowRoute = \Illuminate\Support\Facades\Route::has('member.social.posts.show');
        $hasPostEditRoute = \Illuminate\Support\Facades\Route::has('member.social.posts.edit');

        $createPostUrl = $hasPostCreateRoute ? route('member.social.posts.create') : null;
        $draftsUrl = $hasPostIndexRoute ? route('member.social.posts', ['drafts' => 1]) : null;
    @endphp

    <div class="posts-dashboard container py-5 py-md-6">
        <section class="posts-hero rounded-4 overflow-hidden">
            <div class="posts-hero__background"></div>
            <div class="posts-hero__container">
                <div class="posts-hero__content">
                    <span class="posts-hero__eyebrow">Storytelling</span>
                    <h1 class="posts-hero__title">Share the chapters that keep your career shimmering</h1>
                    <p class="posts-hero__subtitle">Document your wins, reflections, and rallying cries so your community can celebrate every milestone alongside you.</p>
                    <div class="posts-hero__cta">
                        <a href="{{ $createPostUrl ?? '#' }}" class="posts-hero__primary" @unless ($createPostUrl) aria-disabled="true" @endunless>
                            <i class="fas fa-pen-fancy me-2"></i>Compose a post
                        </a>
                        <a href="{{ $draftsUrl ?? '#' }}" class="posts-hero__secondary" @unless ($draftsUrl) aria-disabled="true" @endunless>
                            <i class="fas fa-feather me-2"></i>Open drafts
                        </a>
                    </div>
                </div>
                <div class="posts-hero__metrics">
                    <div class="hero-stat hero-stat--rose">
                        <span class="hero-stat__icon"><i class="fas fa-book-open"></i></span>
                        <div>
                            <p class="hero-stat__label">Published stories</p>
                            <p class="hero-stat__value">{{ $formatNumber($publishedTotal) }}</p>
                            <p class="hero-stat__hint">Out of {{ $formatNumber($postsTotal) }} created</p>
                        </div>
                    </div>
                    <div class="hero-stat hero-stat--lilac">
                        <span class="hero-stat__icon"><i class="fas fa-stopwatch"></i></span>
                        <div>
                            <p class="hero-stat__label">Last published</p>
                            <p class="hero-stat__value">{{ $lastPublishedHuman ?? '—' }}</p>
                            <p class="hero-stat__hint">Freshest reflection</p>
                        </div>
                    </div>
                    <div class="hero-stat hero-stat--sunrise">
                        <span class="hero-stat__icon"><i class="fas fa-chart-line"></i></span>
                        <div>
                            <p class="hero-stat__label">Avg. reach</p>
                            <p class="hero-stat__value">{{ $formatNumber($averageReach) }}</p>
                            <p class="hero-stat__hint">Impressions per share</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section class="posts-highlight mt-5">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-3">
                <div>
                    <h2 class="section-title mb-1">Spotlight entries</h2>
                    <p class="section-subtitle mb-0">Jump into the posts sparking the biggest glow</p>
                </div>
                <span class="status-pill">Curated highlights</span>
            </div>

            <div class="posts-highlight-strip">
                @forelse ($featuredPosts as $post)
                    @php
                        $postTitle = data_get($post, 'title')
                            ?? data_get($post, 'name')
                            ?? data_get($post, 'headline')
                            ?? 'Untitled story';
                        $postHero = data_get($post, 'cover_image')
                            ?? data_get($post, 'featured_image')
                            ?? data_get($post, 'image');
                        $postKey = data_get($post, 'id')
                            ?? data_get($post, 'post_id')
                            ?? (string) crc32($postTitle);
                    @endphp
                    <button type="button" class="posts-highlight-card" data-post-target="post-card-{{ $postKey }}">
                        <span class="posts-highlight-card__preview">
                            @if ($postHero)
                                <img src="{{ $postHero }}" alt="{{ $postTitle }}">
                            @else
                                <i class="fas fa-pen-nib"></i>
                            @endif
                        </span>
                        <span class="posts-highlight-card__label">{{ \Illuminate\Support\Str::limit($postTitle, 22) }}</span>
                    </button>
                @empty
                    <div class="posts-highlight-card posts-highlight-card--empty">
                        <span class="posts-highlight-card__preview"><i class="fas fa-pen-fancy"></i></span>
                        <span class="posts-highlight-card__label">Publish your first note</span>
                    </div>
                @endforelse
            </div>
        </section>

        <section class="posts-grid mt-5">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
                <div>
                    <h2 class="section-title mb-1">All posts</h2>
                    <p class="section-subtitle mb-0">Keep the rhythm going with fresh reflections and updates</p>
                </div>
                <span class="status-pill">{{ $formatNumber($postsTotal) }} total</span>
            </div>

            @if ($postsCollection->isNotEmpty())
                <div class="row g-4">
                    @foreach ($postsCollection as $post)
                        @php
                            $postTitle = data_get($post, 'title')
                                ?? data_get($post, 'name')
                                ?? data_get($post, 'headline')
                                ?? 'Untitled story';
                            $postSummary = data_get($post, 'summary')
                                ?? data_get($post, 'excerpt')
                                ?? data_get($post, 'body');
                            $postSummaryTrimmed = $postSummary
                                ? \Illuminate\Support\Str::limit(strip_tags((string) $postSummary), 140)
                                : 'No description yet—share what this update means to you.';
                            $statusRaw = (string) data_get($post, 'status', 'Published');
                            $statusLabel = ucfirst(str_replace('_', ' ', $statusRaw));
                            $timestamp = data_get($post, 'published_at')
                                ?? data_get($post, 'updated_at')
                                ?? data_get($post, 'created_at');
                            $timestampLabel = $timestamp instanceof \Carbon\CarbonInterface
                                ? $timestamp->diffForHumans()
                                : (is_string($timestamp) ? \Illuminate\Support\Str::limit($timestamp, 24) : 'Recently');
                            $likes = data_get($post, 'likes', data_get($post, 'reactions.likes'));
                            $comments = data_get($post, 'comments', data_get($post, 'comments_count'));
                            $shares = data_get($post, 'shares', data_get($post, 'share_count'));
                            $readTime = data_get($post, 'read_time')
                                ?? data_get($post, 'reading_time')
                                ?? (is_string($postSummary) ? max(1, round(str_word_count(strip_tags($postSummary)) / 200)) . ' min read' : null);
                            $postImage = data_get($post, 'cover_image')
                                ?? data_get($post, 'featured_image')
                                ?? data_get($post, 'image');
                            $postKey = data_get($post, 'id')
                                ?? data_get($post, 'post_id')
                                ?? (string) crc32($postTitle . $timestampLabel);
                            $postUrl = data_get($post, 'url');
                            if (! $postUrl && $hasPostShowRoute && data_get($post, 'slug')) {
                                $postUrl = route('member.social.posts.show', data_get($post, 'slug'));
                            }
                            $postId = data_get($post, 'id') ?? data_get($post, 'post_id');
                        @endphp
                        <div class="col-md-6 col-xl-4">
                            <article class="post-card" id="post-card-{{ $postKey }}">
                                @if ($postImage)
                                    <div class="post-card__image">
                                        <img src="{{ $postImage }}" alt="{{ $postTitle }}">
                                    </div>
                                @endif
                                <header class="post-card__header">
                                    <span class="post-card__status">{{ $statusLabel }}</span>
                                    <h3 class="post-card__title">{{ $postTitle }}</h3>
                                    <p class="post-card__timestamp">
                                        <i class="fas fa-clock me-1"></i>{{ $timestampLabel }}
                                    </p>
                                </header>
                                <div class="post-card__body">
                                    <p class="post-card__excerpt">{{ $postSummaryTrimmed }}</p>
                                    <div class="post-card__meta">
                                        @if ($readTime)
                                            <span class="chip"><i class="fas fa-book-reader me-1"></i>{{ $readTime }}</span>
                                        @endif
                                        <span class="chip"><i class="fas fa-heart me-1"></i>{{ $formatNumber($likes ?? 0) }}</span>
                                        <span class="chip"><i class="fas fa-comments me-1"></i>{{ $formatNumber($comments ?? 0) }}</span>
                                        <span class="chip"><i class="fas fa-share me-1"></i>{{ $formatNumber($shares ?? 0) }}</span>
                                    </div>
                                </div>
                                <footer class="post-card__footer">
                                    @if ($postUrl)
                                        <a href="{{ $postUrl }}" class="chip-btn">
                                            <i class="fas fa-eye me-2"></i>View post
                                        </a>
                                    @endif
                                    @if ($postId && $hasPostEditRoute)
                                        <a href="{{ route('member.social.posts.edit', $postId) }}" class="chip-btn chip-btn--ghost">
                                            <i class="fas fa-edit me-2"></i>Edit
                                        </a>
                                    @endif
                                    <button type="button" class="chip-btn chip-btn--danger">
                                        <i class="fas fa-trash-alt me-2"></i>Manage
                                    </button>
                                </footer>
                            </article>
                        </div>
                    @endforeach
                </div>

                @if ($postsSource instanceof \Illuminate\Pagination\AbstractPaginator)
                    <div class="mt-4 d-flex justify-content-center">
                        {{ $postsSource->withQueryString()->links() }}
                    </div>
                @endif
            @else
                <div class="empty-state">
                    <div class="empty-state__icon">
                        <i class="fas fa-lightbulb"></i>
                    </div>
                    <h3 class="empty-state__title">Your stories go here</h3>
                    <p class="empty-state__subtitle">Share a proud moment, a lesson learned, or a bold vision to start magnetising new opportunities.</p>
                    <a href="{{ route('member.social.posts.create') }}" class="chip-btn">
                        <i class="fas fa-pen me-2"></i>Draft your first post
                    </a>
                </div>
            @endif
        </section>
    </div>

    @push('scripts')
        <script>
            document.addEventListener('DOMContentLoaded', function () {
                var highlightButtons = document.querySelectorAll('[data-post-target]');
                if (!highlightButtons.length) {
                    return;
                }

                highlightButtons.forEach(function (button) {
                    button.addEventListener('click', function () {
                        var targetId = button.getAttribute('data-post-target');
                        var target = targetId ? document.getElementById(targetId) : null;

                        if (!target) {
                            return;
                        }

                        target.classList.remove('post-card--pulse');
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        window.setTimeout(function () {
                            target.classList.add('post-card--pulse');
                        }, 120);
                        window.setTimeout(function () {
                            target.classList.remove('post-card--pulse');
                        }, 1600);
                    });
                });
            });
        </script>
    @endpush
</x-app-layout>
