@php
    use App\Support\SocialPostFormatter;
    use Illuminate\Support\Str;
    use Illuminate\Support\Collection;
@endphp

@forelse($posts as $post)
    @php
        $profile = $post->profile;
        $displayName = $profile?->display_name ?? $profile?->username ?? $post->user?->name ?? 'Community Member';
        $username = $profile?->username ?? $post->user?->username ?? 'member';
        $avatar = $profile?->avatar_url ?? $post->user?->avatar_url ?? asset('images/default-avatar.png');
        $mediaItems = $post->media instanceof Collection
            ? $post->media
            : collect(is_array($post->media) ? $post->media : []);
        $primaryMedia = $mediaItems->first();
        $caption = $post->caption ?: $post->content;
        $publishedAt = optional($post->published_at)->diffForHumans() ?? 'Moments ago';
        $aiTags = $post->ai_tags;

        if (is_string($aiTags) && $aiTags !== '') {
            $aiTags = array_map('trim', explode(',', $aiTags));
        }

        if (! is_array($aiTags)) {
            $aiTags = [];
        }

        $aiTags = array_values(array_filter(array_map(function ($tag) {
            $normalized = Str::of((string) $tag)->trim()->ltrim('#')->toString();

            return $normalized === '' ? null : $normalized;
        }, $aiTags)));

        $aiScore = $post->ai_engagement_score !== null
            ? round((float) $post->ai_engagement_score)
            : null;

        static $viewerProfileId = null;
        static $viewerProfileResolved = false;
        if (! $viewerProfileResolved) {
            $viewerProfileId = optional(optional(auth()->user())->socialProfile)->id;
            $viewerProfileResolved = true;
        }

        static $viewerSavedPostIds = null;
        if ($viewerSavedPostIds === null) {
            $viewerProfile = optional(auth()->user())->socialProfile;
            $viewerSavedPostIds = $viewerProfile
                ? $viewerProfile->savedPosts()->pluck('social_post_id')->all()
                : [];
        }

        $isLiked = false;
        $activeReaction = null;
        if ($viewerProfileId) {
            if ($post->relationLoaded('likes')) {
                $likeRecord = $post->likes->first(fn ($like) => (int) $like->social_profile_id === (int) $viewerProfileId);
                if ($likeRecord) {
                    $isLiked = true;
                    $activeReaction = $likeRecord->reaction;
                }
            } elseif (isset($post->liked)) {
                $isLiked = (bool) $post->liked;
                if ($isLiked && isset($post->liked_reaction)) {
                    $activeReaction = $post->liked_reaction;
                }
            } else {
                $likeSnapshot = $post->likes()->where('social_profile_id', $viewerProfileId)->select('reaction')->first();
                if ($likeSnapshot) {
                    $isLiked = true;
                    $activeReaction = $likeSnapshot->reaction;
                }
            }
        }

        $isSaved = in_array($post->id, $viewerSavedPostIds ?? [], true);
        $reactionPalette = config('social.reactions.palette', []);
        $reactionCounts = is_array($post->reaction_breakdown) ? $post->reaction_breakdown : [];

        $moderationStatus = $post->moderation_status ?? 'approved';
        $requiresModerationOverlay = $moderationStatus && $moderationStatus !== 'approved';
        $moderationCopy = [
            'pending' => 'This story is waiting for review before it appears to everyone.',
            'flagged' => 'Safety systems flagged this story. You can still open it if you trust the author.',
            'rejected' => 'Moderators removed this story from public view.',
        ];
        $moderationMessage = $moderationCopy[$moderationStatus] ?? 'This story is currently hidden while moderators take a closer look.';
        $postSummary = Str::limit(strip_tags((string) $caption), 180);
    @endphp

    @php
        $postRouteKey = $post?->getRouteKey() ?? $post?->id;
    @endphp

    @continue(empty($postRouteKey))

    <article
        class="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 transition-shadow hover:shadow-md"
        data-post-card
        data-post-id="{{ $post->id }}"
        data-like-endpoint="{{ route('social.posts.like', ['post' => $postRouteKey]) }}"
        data-save-endpoint="{{ route('social.posts.save', ['post' => $postRouteKey]) }}"
        data-share-endpoint="{{ route('social.posts.share', ['post' => $postRouteKey]) }}"
        data-repost-endpoint="{{ route('social.posts.repost', ['post' => $postRouteKey]) }}"
        data-comment-endpoint="{{ route('social.posts.comment', ['post' => $postRouteKey]) }}"
        data-comments-endpoint="{{ route('social.posts.comments.index', ['post' => $postRouteKey]) }}"
        data-replies-endpoint-template="{{ route('social.posts.comments.replies', ['post' => $postRouteKey, 'comment' => 'COMMENT_ID']) }}"
        data-liked="{{ $isLiked ? 'true' : 'false' }}"
        data-saved="{{ $isSaved ? 'true' : 'false' }}"
        data-reaction-active="{{ $activeReaction ?? '' }}"
        data-reaction-palette='@json($reactionPalette)'
        data-reaction-counts='@json($reactionCounts)'
        data-comment-count="{{ (int) ($post->comments_count ?? 0) }}"
        data-moderation-status="{{ $moderationStatus }}"
        data-author-name="{{ $displayName }}"
        data-post-summary="{{ $postSummary }}"
        data-share-count="{{ (int) ($post->shares_count ?? 0) }}"
    >
        @if($requiresModerationOverlay)
            <div class="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-4 flex items-start gap-3" data-moderation-overlay role="status" aria-live="polite">
                <div class="text-amber-500 mt-0.5" aria-hidden="true">
                    <i class="fas fa-shield-alt"></i>
                </div>
                <div class="flex-1">
                    <p class="font-bold text-amber-800 mb-1">Moderation in progress</p>
                    <p class="text-sm text-amber-700 mb-2" data-moderation-message>{{ $moderationMessage }}</p>
                    <div>
                        <button type="button" class="px-3 py-1 bg-white border border-amber-200 rounded-lg text-xs font-bold text-amber-700 hover:bg-amber-50" data-moderation-dismiss aria-expanded="false">
                            Review post anyway
                        </button>
                    </div>
                </div>
            </div>
        @endif

        <div class="flex items-center justify-between mb-4">
            <div class="flex align-items-center gap-3">
                <img src="{{ $avatar }}" alt="{{ $displayName }}" class="w-12 h-12 rounded-full object-cover border border-gray-100">
                <div class="flex flex-col">
                    @if($profile)
                        <a href="{{ route('social.profiles.show', $profile->username) }}" class="font-bold text-gray-900 hover:text-rose-600 transition-colors">{{ $displayName }}</a>
                    @else
                        <span class="font-bold text-gray-900">{{ $displayName }}</span>
                    @endif
                    <span class="text-xs text-gray-500">@{{ $username }} • {{ $publishedAt }}</span>
                </div>
            </div>
            @if($post->is_pinned)
                <span class="px-2 py-1 rounded bg-rose-50 text-rose-600 text-xs font-bold">Pinned</span>
            @elseif($post->is_sponsored)
                <span class="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-bold">Sponsored</span>
            @endif
        </div>

        @if($caption)
            <div class="text-gray-700 mb-4 leading-relaxed whitespace-pre-wrap">
                {{ Str::limit(strip_tags($caption), 320) }}
            </div>
        @endif

        @if($mediaItems->isNotEmpty())
            <div class="rounded-xl overflow-hidden mb-4 border border-gray-100 relative group" data-media-carousel data-like-hotspot>
                <div class="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide" data-carousel-track>
                    @foreach($mediaItems as $index => $media)
                        @php
                            $isModel = $media instanceof \App\Models\SocialMedia;
                            $isVideo = $isModel ? ($media->is_video ?? false) : in_array(($media['type'] ?? $media['media_type'] ?? ''), ['video', 'mp4'], true);
                            $source = $isModel
                                ? $media->url
                                : SocialPostFormatter::normalizeMediaPath($media['path'] ?? $media['file_path'] ?? '');
                            $poster = $isModel ? ($media->thumbnail_url ?? null) : ($media['meta']['thumbnail'] ?? null);
                        @endphp
                        <div class="min-w-full snap-center" data-carousel-slide>
                            @if($isVideo)
                                <video src="{{ $source }}" @if($poster) poster="{{ $poster }}" @endif controls playsinline preload="metadata" class="w-full max-h-[500px] object-cover"></video>
                            @else
                                <img src="{{ $source }}" alt="{{ $displayName }} media {{ $loop->iteration }}" loading="lazy" class="w-full max-h-[500px] object-cover">
                            @endif
                        </div>
                    @endforeach
                </div>
                @if($mediaItems->count() > 1)
                    <button type="button" class="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" data-carousel-prev data-carousel-nav aria-label="Show previous media">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" data-carousel-next data-carousel-nav aria-label="Show next media">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                    <div class="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                        @foreach($mediaItems as $index => $media)
                            <button type="button" class="w-2 h-2 rounded-full {{ $index === 0 ? 'bg-white' : 'bg-white/50' }}" data-carousel-dot="{{ $index }}" aria-label="Jump to media {{ $index + 1 }}"></button>
                        @endforeach
                    </div>
                @endif
            </div>
        @endif

        @if(!empty($aiTags) || $aiScore !== null)
            <div class="flex flex-wrap gap-2 mb-4" aria-label="AI insights for this post">
                @if(!empty($aiTags))
                    @foreach($aiTags as $tag)
                        <span class="px-2 py-1 bg-gray-50 text-gray-500 rounded-lg text-xs font-medium">#{{ $tag }}</span>
                    @endforeach
                @endif
                @if($aiScore !== null)
                    <div class="px-2 py-1 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold flex items-center gap-1">
                        <i class="fas fa-signal"></i>
                        {{ $aiScore }}/100 vibe score
                    </div>
                @endif
            </div>
        @endif

        <span class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-6xl opacity-0 pointer-events-none transition-all duration-300 transform scale-50" data-tap-heart aria-hidden="true">
            <i class="fas fa-heart drop-shadow-lg"></i>
        </span>

        <div class="flex items-center justify-between pt-4 border-t border-gray-50">
            <button
                type="button"
                class="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors {{ $isLiked ? 'text-rose-600 bg-rose-50' : 'text-gray-500 hover:bg-gray-50 hover:text-rose-600' }}"
                data-like-button
                data-action-ripple
                aria-pressed="{{ $isLiked ? 'true' : 'false' }}"
            >
                <i class="{{ $isLiked ? 'fas' : 'far' }} fa-heart"></i>
                <span class="font-bold text-sm" data-like-count>{{ number_format($post->likes_count ?? 0) }}</span>
            </button>

            <button
                type="button"
                class="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-amber-500 transition-colors"
                data-reaction-trigger
                data-action-ripple
                aria-haspopup="true"
                aria-expanded="false"
                aria-controls="reaction-picker-{{ $post->id }}"
                aria-label="Open reactions for this story"
            >
                <i class="far fa-face-smile" aria-hidden="true"></i>
            </button>

            <button
                type="button"
                class="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-blue-600 transition-colors"
                data-comment-trigger
                data-action-ripple
                aria-controls="comment-thread-{{ $post->id }}"
                aria-expanded="false"
                aria-label="Open comments"
            >
                <i class="far fa-comment"></i>
                <span class="font-bold text-sm" data-comment-count>{{ number_format($post->comments_count ?? 0) }}</span>
            </button>

            <button
                type="button"
                class="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors {{ $isSaved ? 'text-rose-600 bg-rose-50' : 'text-gray-500 hover:bg-gray-50 hover:text-rose-600' }}"
                data-save-button
                data-action-ripple
                aria-pressed="{{ $isSaved ? 'true' : 'false' }}"
            >
                <i class="{{ $isSaved ? 'fas' : 'far' }} fa-bookmark"></i>
            </button>

            <button
                type="button"
                class="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-indigo-600 transition-colors"
                data-share-card
                data-action-ripple
                aria-haspopup="dialog"
                aria-controls="share-sheet-dialog"
                aria-expanded="false"
            >
                <i class="fas fa-share" aria-hidden="true"></i>
                <span
                    class="font-bold text-sm"
                    data-share-count
                    data-share-count-value="{{ $post->shares_count ?? 0 }}"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {{ number_format($post->shares_count ?? 0) }}
                </span>
            </button>
        </div>

        <div class="mt-3 text-sm text-gray-600" data-reaction-summary hidden aria-live="polite"></div>

        <div
            class="absolute bottom-16 left-4 bg-white rounded-full shadow-lg border border-gray-100 p-2 flex gap-2 z-10"
            id="reaction-picker-{{ $post->id }}"
            role="menu"
            aria-label="Select a reaction"
            data-reaction-picker
            hidden
        >
            <div class="flex gap-1">
                @foreach($reactionPalette as $reactionKey => $meta)
                    <button
                        type="button"
                        class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-lg transition-transform hover:scale-110"
                        data-reaction-option="{{ $reactionKey }}"
                        role="menuitemradio"
                        aria-checked="false"
                        title="{{ $meta['label'] ?? ucfirst($reactionKey) }}"
                    >
                        <i class="{{ $meta['icon'] ?? 'fas fa-heart' }}" aria-hidden="true" style="color: {{ $meta['color'] ?? 'inherit' }}"></i>
                    </button>
                @endforeach
            </div>
        </div>

        <section
            class="mt-4 pt-4 border-t border-gray-50"
            id="comment-thread-{{ $post->id }}"
            data-comment-thread
            hidden
        >
            <header class="flex justify-between items-center mb-4">
                <div>
                    <p class="font-bold text-gray-900 text-sm">Conversation</p>
                    <span class="text-xs text-gray-500" data-comment-thread-hint>Reply kindly & stay constructive.</span>
                </div>
                <button type="button" class="text-gray-400 hover:text-gray-600" data-close-comment-thread aria-label="Close comments">
                    <i class="fas fa-times"></i>
                </button>
            </header>

            <div class="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-3" data-comment-error hidden role="alert"></div>

            <div class="text-center py-4 text-rose-600" data-comment-loading hidden>
                <i class="fas fa-spinner fa-spin mr-2"></i>Loading conversation…
            </div>

            <div class="space-y-4 max-h-[400px] overflow-y-auto pr-2 mb-4 custom-scrollbar" data-comment-thread-body>
                <p class="text-center text-gray-400 text-sm py-4" data-comment-thread-empty>
                    Be the first to share some encouragement.
                </p>
            </div>

            <form class="flex flex-col gap-2" data-comment-form action="{{ route('social.posts.comment', $post) }}" method="post">
                @csrf
                <input type="hidden" name="parent_id" value="">
                <label class="visually-hidden" for="comment-input-{{ $post->id }}">Add a comment</label>
                <div class="relative">
                    <textarea
                        id="comment-input-{{ $post->id }}"
                        name="content"
                        class="w-full rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:border-rose-300 focus:ring focus:ring-rose-200 focus:ring-opacity-50 resize-none py-3 px-4 text-sm"
                        rows="2"
                        maxlength="1000"
                        placeholder="Add a thoughtful reply..."
                        required
                    ></textarea>
                </div>
                <div class="flex justify-between items-center">
                    <button type="button" class="text-xs text-gray-500 hover:text-rose-600" data-reset-reply hidden>
                        Replying to <span class="font-bold" data-replying-to></span> · Cancel
                    </button>
                    <button type="submit" class="px-4 py-2 bg-rose-600 text-white text-sm font-bold rounded-lg hover:bg-rose-700 transition-colors ml-auto">
                        <span data-comment-submit-label>Post</span>
                    </button>
                </div>
            </form>
        </section>
    </article>

    @if($loop->iteration === 3 || $loop->iteration === 8)
        @include('social.feed.partials.ad-unit')
    @endif

@empty
    <div class="mb-16 bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-12 border border-amber-100 shadow-sm min-h-[800px] flex flex-col justify-center relative overflow-hidden">
        <div class="absolute top-0 right-0 w-96 h-96 bg-orange-100 rounded-full blur-3xl -mr-20 -mt-20 opacity-60"></div>
        <div class="relative z-10">
            <div class="flex justify-between items-start mb-10">
                <div>
                    <p class="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">Brand Partnership</p>
                    <h5 class="font-bold text-gray-900 text-lg">Advertising & Promotions</h5>
                </div>
                <span class="bg-white/90 px-3 py-1 rounded-xl text-xs font-bold text-amber-600 border border-amber-100 shadow-sm">Ad</span>
            </div>
            <p class="text-gray-600 text-sm mb-12 max-w-2xl leading-relaxed">Explore exclusive opportunities from our trusted partners. Connect with brands that align with your values and growth.</p>
            <button type="button" class="w-full sm:w-auto px-8 py-3 bg-white text-amber-800 text-sm font-bold rounded-xl border border-amber-200 hover:bg-amber-50 transition-all shadow-sm hover:shadow-md">
                View Opportunities
            </button>
        </div>
    </div>

    <div class="text-center py-12 bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl border border-rose-100 shadow-sm">
        <div class="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-rose-400 shadow-sm">
            <i class="fas fa-bouquet fa-2x"></i>
        </div>
        <p class="text-rose-900 font-bold text-lg mb-2">No stories yet.</p>
        <p class="text-rose-700 text-sm">Follow more connections or spark the conversation with your first post.</p>
    </div>

    <div class="mt-6 text-center py-12 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 shadow-sm">
        <div class="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-400 shadow-sm">
            <i class="fas fa-bouquet fa-2x"></i>
        </div>
        <p class="text-emerald-900 font-bold text-lg mb-2">No stories yet.</p>
        <p class="text-emerald-700 text-sm">Follow more connections or spark the conversation with your first post.</p>
    </div>
@endforelse

@if($posts instanceof \Illuminate\Contracts\Pagination\Paginator)
    <div class="visually-hidden" data-feed-pagination
        data-current-page="{{ $posts->currentPage() }}"
        data-has-more="{{ $posts->hasMorePages() ? 'true' : 'false' }}">
        @if (method_exists($posts, 'links'))
            {{ $posts->links() }}
        @endif
    </div>
@endif
