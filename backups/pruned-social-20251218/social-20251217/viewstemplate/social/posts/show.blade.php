@extends('frontend.social.layout')

@php
    $profile = $post->profile;
    $displayName = $profile?->display_name ?? $profile?->username ?? $post->user?->name ?? 'Community Member';
    $username = $profile?->username ?? $post->user?->username ?? 'member';
    $avatar = $profile?->avatar_url ?? $post->user?->avatar_url ?? asset('images/default-avatar.png');
    $mediaItems = $post->media instanceof \Illuminate\Support\Collection
        ? $post->media
        : collect(is_array($post->media) ? $post->media : []);
    $content = $post->caption ?: $post->content;
    $publishedAt = optional($post->published_at)->format('M j, Y • g:i A') ?? 'Moments ago';
    $tags = collect(is_array($post->tags) ? $post->tags : explode(',', (string) $post->tags))
        ->map(fn ($tag) => \Illuminate\Support\Str::of($tag)->trim()->ltrim('#')->toString())
        ->filter()
        ->unique()
        ->values();
    $location = \Illuminate\Support\Str::of($post->location)->trim()->toString();
    $matchReasons = collect(is_array($post->match_reasons) ? $post->match_reasons : []);
    $viewerProfileId = optional(optional(auth()->user())->socialProfile)->id;
    $postIsLiked = false;
    if ($viewerProfileId) {
        if ($post->relationLoaded('likes')) {
            $postIsLiked = $post->likes->contains(fn ($like) => (int) $like->social_profile_id === (int) $viewerProfileId);
        } else {
            $postIsLiked = $post->likes()->where('social_profile_id', $viewerProfileId)->exists();
        }
    }
@endphp

@section('title', $displayName . ' • Post')

@section('social-content')
<div class="post-show-shell">
    <a href="{{ route('social.feed.preview') }}" class="post-show__back">
        <i class="fas fa-chevron-left"></i>
        Back to feed
    </a>

    <article
        class="post-show-card"
        data-post-card
        data-post-id="{{ $post->id }}"
        data-like-endpoint="{{ route('social.posts.like', $post) }}"
        data-liked="{{ $postIsLiked ? 'true' : 'false' }}"
    >
        <header class="post-show__header">
            <div class="post-show__author">
                <img src="{{ $avatar }}" alt="{{ $displayName }}" class="post-show__avatar">
                <div class="post-show__identity">
                    <h1 class="post-show__name">{{ $displayName }}</h1>
                    <span class="post-show__meta">@{{ $username }} • {{ $publishedAt }}</span>
                    @if($location)
                        <span class="post-show__meta"><i class="fas fa-map-marker-alt me-1"></i>{{ $location }}</span>
                    @endif
                </div>
            </div>
            @if($post->is_pinned || $post->is_sponsored)
                <span class="post-show__badge">{{ $post->is_pinned ? 'Pinned' : 'Sponsored' }}</span>
            @endif
        </header>

        @if($matchReasons->isNotEmpty())
            <div class="post-show__tags" style="margin-top: 0.75rem;">
                @foreach($matchReasons as $reason)
                    <span class="tag-chip">{{ $reason }}</span>
                @endforeach
            </div>
        @endif

        @if($mediaItems->isNotEmpty())
            <div class="post-show__media" data-media-carousel data-like-hotspot>
                <div class="media-carousel__track" data-carousel-track>
                    @foreach($mediaItems as $media)
                        @php
                            $isModel = $media instanceof \App\Models\SocialMedia;
                            $isVideo = $isModel
                                ? ($media->is_video ?? false)
                                : in_array(($media['type'] ?? $media['media_type'] ?? ''), ['video', 'mp4'], true);
                            $source = $isModel
                                ? $media->url
                                : \App\Support\SocialPostFormatter::normalizeMediaPath($media['path'] ?? $media['file_path'] ?? '');
                            $poster = $isModel ? ($media->thumbnail_url ?? null) : ($media['meta']['thumbnail'] ?? null);
                        @endphp
                        <div class="media-carousel__slide" data-carousel-slide>
                            @if($isVideo)
                                <video src="{{ $source }}" @if($poster) poster="{{ $poster }}" @endif controls playsinline preload="metadata"></video>
                            @else
                                <img src="{{ $source }}" alt="{{ $displayName }} media item">
                            @endif
                        </div>
                    @endforeach
                </div>
                @if($mediaItems->count() > 1)
                    <button type="button" class="media-carousel__nav media-carousel__nav--prev" data-carousel-prev data-carousel-nav aria-label="Previous media">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <button type="button" class="media-carousel__nav media-carousel__nav--next" data-carousel-next data-carousel-nav aria-label="Next media">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                    <div class="media-carousel__dots">
                        @foreach($mediaItems as $index => $media)
                            <button type="button" class="media-carousel__dot {{ $loop->first ? 'is-active' : '' }}" data-carousel-dot="{{ $index }}" aria-label="Go to media {{ $loop->iteration }}"></button>
                        @endforeach
                    </div>
                @endif
            </div>
        @endif

        <span class="tap-heart" data-tap-heart aria-hidden="true"></span>

        @if($content)
            <div class="post-show__body">
                {!! nl2br(e($content)) !!}
            </div>
        @endif

        @if($tags->isNotEmpty())
            <div class="post-show__tags">
                @foreach($tags as $tag)
                    <span class="tag-chip">#{{ $tag }}</span>
                @endforeach
            </div>
        @endif

        <div class="post-show__stats">
            <span class="stat-pill"><i class="fas fa-heart text-rose-500"></i><span data-like-count>{{ number_format($post->likes_count ?? 0) }}</span> likes</span>
            <span class="stat-pill"><i class="fas fa-comment text-sky-500"></i>{{ number_format($post->comments_count ?? 0) }} comments</span>
            <span class="stat-pill"><i class="fas fa-eye text-indigo-500"></i>{{ number_format($post->views_count ?? 0) }} views</span>
        </div>
    </article>

    <section class="post-show-comments">
        <h3>Conversation</h3>
        @forelse($comments as $comment)
            @php
                $commentProfile = $comment->profile;
                $commentAvatar = $commentProfile?->avatar_url ?? asset('images/default-avatar.png');
                $commentName = $commentProfile?->display_name ?? $commentProfile?->username ?? 'Community Member';
                $commentUsername = $commentProfile?->username ?? 'member';
            @endphp
            <article class="comment-card">
                <div class="comment-card__head">
                    <img src="{{ $commentAvatar }}" alt="{{ $commentName }}" class="comment-card__avatar">
                    <div>
                        <p class="comment-card__name">{{ $commentName }}</p>
                        <span class="comment-card__meta">@{{ $commentUsername }} • {{ optional($comment->created_at)->diffForHumans() }}</span>
                    </div>
                </div>
                <p class="comment-card__body">{{ $comment->comment }}</p>
                @if($comment->replies->isNotEmpty())
                    <div class="comment-replies">
                        @foreach($comment->replies as $reply)
                            @php
                                $replyProfile = $reply->profile;
                                $replyName = $replyProfile?->display_name ?? $replyProfile?->username ?? 'Community Member';
                                $replyUsername = $replyProfile?->username ?? 'member';
                            @endphp
                            <div class="comment-reply">
                                <p class="comment-card__name mb-0">{{ $replyName }}</p>
                                <p class="comment-reply__meta mb-1">@{{ $replyUsername }} • {{ optional($reply->created_at)->diffForHumans() }}</p>
                                <p class="mb-0">{{ $reply->comment }}</p>
                            </div>
                        @endforeach
                    </div>
                @endif
            </article>
        @empty
            <p class="post-show__empty">No comments yet. Be the first to share some encouragement.</p>
        @endforelse
    </section>
</div>
@endsection

@push('scripts')
<script>
(function () {
    const initialized = new WeakSet();

    document.querySelectorAll('[data-media-carousel]').forEach((carousel) => {
        if (initialized.has(carousel)) {
            return;
        }

        const track = carousel.querySelector('[data-carousel-track]');
        const slides = carousel.querySelectorAll('[data-carousel-slide]');

        if (!track || slides.length <= 1) {
            initialized.add(carousel);
            return;
        }

        const dots = carousel.querySelectorAll('[data-carousel-dot]');
        const prev = carousel.querySelector('[data-carousel-prev]');
        const next = carousel.querySelector('[data-carousel-next]');
        let index = 0;

        const update = () => {
            track.style.transform = `translateX(-${index * 100}%)`;
            dots.forEach((dot, dotIndex) => dot.classList.toggle('is-active', dotIndex === index));
        };

        prev?.addEventListener('click', () => {
            index = (index - 1 + slides.length) % slides.length;
            update();
        });

        next?.addEventListener('click', () => {
            index = (index + 1) % slides.length;
            update();
        });

        dots.forEach((dot) => {
            dot.addEventListener('click', () => {
                const target = Number(dot.dataset.carouselDot ?? 0);
                if (!Number.isNaN(target)) {
                    index = target;
                    update();
                }
            });
        });

        update();
        initialized.add(carousel);
    });
})();
</script>
@endpush



