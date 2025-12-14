@extends('frontend.social.layout')

@section('title', $profile->display_name . ' (@' . $profile->username . ')')

@section('social-content')
@php
    $displayName = $profile->display_name ?? $profile->user?->name ?? '@'.$profile->username;
    $tagline = trim((string) data_get($profile->persona_meta, 'tagline'));
    $tagline = $tagline === '' ? __('Women-owned. Business Network powered.') : $tagline;
    $bioCopy = $profile->bio
        ? $profile->bio
        : __('Share what makes your studio unstoppable so the Business Network knows how to champion you.');
    $websiteLabel = $profile->website
        ? (parse_url($profile->website, PHP_URL_HOST) ?? $profile->website)
        : null;
@endphp
<div class="profile-header py-5">
    <div class="container">
        <section
            class="position-relative overflow-hidden rounded-5 border border-light-subtle p-4 p-lg-5 shadow-lg text-white"
            style="background:radial-gradient(circle at 5% 5%,rgba(255,255,255,0.35),transparent 40%),linear-gradient(120deg,#3a1045 0%,#66194f 45%,#a21b57 100%);"
        >
            <div class="position-absolute top-0 start-0 w-100 h-100" aria-hidden="true" style="opacity:0.35;">
                <img
                    src="{{ $profile->cover_url }}"
                    alt="{{ $displayName }} cover image"
                    class="w-100 h-100"
                    style="object-fit:cover;filter:saturate(1.2) brightness(1.05);"
                >
                <div class="position-absolute top-0 start-0 w-100 h-100" style="background:linear-gradient(120deg,rgba(26,0,36,0.85),rgba(42,4,51,0.8));"></div>
            </div>
            <div class="position-relative">
                <div class="row g-5 align-items-center">
                    <div class="col-lg-7">
                        <div class="d-flex flex-column flex-md-row gap-4 align-items-start">
                            <div class="rounded-4 overflow-hidden border border-white" style="border-color:rgba(255,255,255,0.55)!important;width:140px;height:140px;box-shadow:0 25px 40px rgba(0,0,0,0.25);">
                                <img
                                    src="{{ $profile->avatar_url }}"
                                    alt="{{ $displayName }} avatar"
                                    class="w-100 h-100"
                                    style="object-fit:cover;"
                                >
                            </div>
                            <div class="flex-grow-1">
                                <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                                    <span class="badge rounded-pill bg-white text-dark text-uppercase fw-semibold px-3 py-2" style="letter-spacing:0.2em;">{{ __('Women-owned') }}</span>
                                    <span class="badge rounded-pill text-white fw-semibold px-3 py-2" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.35);letter-spacing:0.15em;">{{ __('Business Network powered') }}</span>
                                    @if($profile->profile_type)
                                        <span class="badge rounded-pill text-white fw-semibold px-3 py-2" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.25);">
                                            <i class="fas fa-id-badge me-1"></i>
                                            {{ ucfirst($profile->profile_type) }}
                                        </span>
                                    @endif
                                    @if($profile->is_verified)
                                        <span class="badge rounded-pill bg-white text-dark fw-semibold px-3 py-2">
                                            <i class="fas fa-badge-check me-1"></i>
                                            {{ __('Verified') }}
                                        </span>
                                    @endif
                                    @if($profile->is_private)
                                        <span class="badge rounded-pill text-white fw-semibold px-3 py-2" style="background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.25);">
                                            <i class="fas fa-lock me-1"></i>
                                            {{ __('Private') }}
                                        </span>
                                    @endif
                                </div>
                                <h1 class="display-5 fw-semibold text-white mb-2">{{ $displayName }}</h1>
                                <p class="lead text-white-75 mb-4">{{ $tagline }}</p>
                                <div class="d-flex flex-wrap align-items-center gap-3 text-white-75 small mb-3">
                                    <span class="d-inline-flex align-items-center gap-2">
                                        <i class="fas fa-at"></i>
                                        {{ '@'.$profile->username }}
                                    </span>
                                    @if($profile->location)
                                        <span class="d-inline-flex align-items-center gap-2">
                                            <i class="fas fa-map-marker-alt"></i>
                                            {{ $profile->location }}
                                        </span>
                                    @endif
                                    @if($profile->pronouns)
                                        <span class="text-uppercase fw-semibold">{{ $profile->pronouns }}</span>
                                    @endif
                                </div>
                                <p class="text-white-75 mb-4">{{ $bioCopy }}</p>
                                @if($profile->website || !empty($profile->social_links))
                                    <div class="d-flex flex-wrap gap-2">
                                        @if($profile->website)
                                            <a
                                                href="{{ $profile->website }}"
                                                target="_blank"
                                                rel="noopener"
                                                class="btn btn-light btn-sm rounded-pill px-3 fw-semibold"
                                            >
                                                <i class="fas fa-globe me-2"></i>
                                                {{ $websiteLabel }}
                                            </a>
                                        @endif
                                        @foreach($profile->social_links ?? [] as $link)
                                            <a
                                                href="{{ $link['url'] ?? '#' }}"
                                                target="_blank"
                                                rel="noopener"
                                                class="badge rounded-pill bg-white text-dark border border-light px-3 py-2 d-inline-flex align-items-center gap-2"
                                            >
                                                <i class="fas fa-link"></i>
                                                {{ $link['label'] ?? 'Link' }}
                                            </a>
                                        @endforeach
                                    </div>
                                @endif
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-5">
                        <div class="rounded-4 bg-white text-dark shadow-lg p-4 h-100">
                            <div class="d-flex align-items-center justify-content-between mb-3">
                                <div>
                                    <p class="text-uppercase small text-muted fw-semibold mb-1">{{ __('Network telemetry') }}</p>
                                    <p class="mb-0 text-rose-500 fw-semibold">{{ __('Live signal refresh') }}</p>
                                </div>
                                <span class="badge rounded-pill bg-light text-rose-600">
                                    <i class="fas fa-wave-square me-1"></i>
                                    {{ __('Live') }}
                                </span>
                            </div>
                            <div class="profile-stats mb-4">
                                <div class="stat-item">
                                    <div class="stat-number">{{ number_format($profile->posts_count ?? $posts->total()) }}</div>
                                    <div class="stat-label">{{ __('Posts') }}</div>
                                </div>
                                <div class="stat-item">
                                    <a href="{{ route('social.profiles.followers', $profile->username) }}" class="text-decoration-none text-reset d-block">
                                        <div class="stat-number" id="followers-count">{{ number_format($profile->followers_count ?? $followers->count()) }}</div>
                                        <div class="stat-label">{{ __('Followers') }}</div>
                                    </a>
                                </div>
                                <div class="stat-item">
                                    <a href="{{ route('social.profiles.following', $profile->username) }}" class="text-decoration-none text-reset d-block">
                                        <div class="stat-number">{{ number_format($profile->following_count ?? $following->count()) }}</div>
                                        <div class="stat-label">{{ __('Following') }}</div>
                                    </a>
                                </div>
                            </div>
                            <div class="d-flex flex-wrap gap-3">
                                @if($isOwner)
                                    <a
                                        href="{{ route('social.profiles.edit', $profile->username) }}"
                                        class="btn btn-light rounded-pill px-4 fw-semibold"
                                    >
                                        <i class="fas fa-pen me-2"></i>
                                        {{ __('Edit profile') }}
                                    </a>
                                @else
                                    <button
                                        class="btn {{ $isFollowing ? 'btn-following' : 'btn-follow' }} rounded-pill px-4 fw-semibold d-flex align-items-center justify-content-center gap-2 flex-grow-1"
                                        data-follow-toggle
                                        data-toggle-url="{{ route('social.profiles.follow.toggle', $profile->username) }}"
                                        data-following="{{ $isFollowing ? 'true' : 'false' }}"
                                    >
                                        <i class="fas {{ $isFollowing ? 'fa-user-check' : 'fa-user-plus' }}"></i>
                                        <span class="follow-text">{{ $isFollowing ? __('Following') : __('Follow') }}</span>
                                    </button>
                                    <a
                                        href="{{ route('social.profiles.followers', $profile->username) }}"
                                        class="btn btn-outline-light rounded-pill px-4 fw-semibold"
                                        style="border-color:rgba(255,255,255,0.4);color:#8b1c5a;"
                                    >
                                        <i class="fas fa-people-arrows me-2"></i>
                                        {{ __('View community') }}
                                    </a>
                                @endif
                            </div>
                            <p class="text-muted small mb-0 mt-3">{{ __('Signals update every time you post or welcome new followers.') }}</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        @if(!empty($healthInterestChips))
            @php
                $wellbeingUrl = route('wellbeing.dashboard');
            @endphp
            <div class="mt-4 rounded-4 border border-light-subtle bg-white p-4 shadow-sm">
                <div class="d-flex flex-wrap align-items-center gap-3 mb-2">
                    <p class="text-uppercase text-muted small fw-semibold mb-0 d-flex align-items-center gap-2">
                        <i class="fas fa-heartbeat text-rose-500"></i>
                        <span>{{ __('Wellbeing interests') }}</span>
                    </p>
                    <a href="{{ $wellbeingUrl }}" class="btn btn-sm btn-outline-primary text-nowrap rounded-pill">
                        <i class="fas fa-seedling me-1"></i>
                        {{ __('Open wellbeing dashboard') }}
                    </a>
                </div>
                <div class="d-flex flex-wrap gap-2">
                    @foreach($healthInterestChips as $chip)
                        @php
                            $focusHref = $chip['token']
                                ? $wellbeingUrl.'?focus='.urlencode($chip['token'])
                                : $wellbeingUrl;
                        @endphp
                        <a
                            href="{{ $focusHref }}"
                            class="badge rounded-pill bg-rose-50 text-rose-700 border border-rose-100 px-3 py-2 fw-semibold d-inline-flex align-items-center gap-2 text-decoration-none"
                            title="{{ $chip['hint'] ?? __('View more inside the wellbeing hub') }}"
                        >
                            <i class="fas {{ $chip['icon'] ?? 'fa-star' }}"></i>
                            <span>{{ $chip['label'] }}</span>
                        </a>
                    @endforeach
                </div>
                <p class="text-muted small mt-2 mb-0">{{ __('Linked from the member\'s wellbeing profile so followers can see active focuses.') }}</p>
            </div>
        @endif
    </div>
</div>

<div class="container my-4">
    @if($profile->profile_video_url)
        <section class="rounded-4 border border-light-subtle bg-white p-4 shadow-sm mb-4">
            <div class="row g-4 align-items-center">
                <div class="col-lg-7">
                    <div class="ratio ratio-16x9 rounded-4 overflow-hidden bg-dark position-relative">
                        <video class="w-100 h-100" controls playsinline poster="{{ $profile->profile_video_poster_url ?? $profile->cover_url }}" src="{{ $profile->profile_video_url }}">
                            Your browser does not support the video tag.
                        </video>
                    </div>
                </div>
                <div class="col-lg-5">
                    <p class="text-uppercase text-muted small fw-semibold mb-2">Spotlight reel</p>
                    <h3 class="h5">{{ $profile->display_name ?? '@'.$profile->username }} in motion</h3>
                    <p class="text-muted">A short video intro that recruiters and collaborators can watch before booking time with you.</p>
                    <div class="d-flex flex-wrap gap-2">
                        <a href="{{ $profile->profile_video_url }}" class="btn btn-outline-primary rounded-pill" download>
                            <i class="fas fa-arrow-down me-2"></i>Download clip
                        </a>
                        @if($isOwner)
                            <a href="{{ route('social.profiles.edit', $profile->username) }}#profile-video-card" class="btn btn-light rounded-pill border">
                                <i class="fas fa-edit me-2"></i>Update video
                            </a>
                        @endif
                    </div>
                </div>
            </div>
        </section>
    @endif

    @php
        $snapshot = $profileMetrics['counts'] ?? [];
    @endphp

    @if(!empty($snapshot))
        <section class="mb-5 rounded-4 border border-light-subtle bg-white p-4 shadow-sm">
            <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
                <div>
                    <p class="text-uppercase text-muted small fw-semibold mb-1">Community reach</p>
                    <h3 class="h5 mb-0">Network intelligence for this profile</h3>
                </div>
                <a href="{{ route('member.social.connections') }}" class="btn btn-sm btn-outline-primary">
                    Grow network
                    <i class="fas fa-arrow-up-right ms-2"></i>
                </a>
            </div>
            <div class="row g-3">
                <div class="col-6 col-lg-3">
                    <div class="rounded-4 border bg-light p-3">
                        <p class="text-muted small mb-1">Connections</p>
                        <p class="fs-4 fw-bold text-rose-500 mb-0">{{ number_format($snapshot['connections'] ?? 0) }}</p>
                    </div>
                </div>
                <div class="col-6 col-lg-3">
                    <div class="rounded-4 border bg-light p-3">
                        <p class="text-muted small mb-1">Pending invites</p>
                        <p class="fs-5 fw-semibold text-fuchsia-500 mb-0">{{ number_format($snapshot['pendingInvites'] ?? 0) }}</p>
                    </div>
                </div>
                <div class="col-6 col-lg-3">
                    <div class="rounded-4 border bg-light p-3">
                        <p class="text-muted small mb-1">Groups</p>
                        <p class="fs-5 fw-semibold text-indigo-500 mb-0">{{ number_format($snapshot['groups'] ?? 0) }}</p>
                    </div>
                </div>
                <div class="col-6 col-lg-3">
                    <div class="rounded-4 border bg-light p-3">
                        <p class="text-muted small mb-1">Unread messages</p>
                        <p class="fs-5 fw-semibold text-purple-500 mb-0">{{ number_format($snapshot['unreadMessages'] ?? 0) }}</p>
                    </div>
                </div>
            </div>
        </section>
    @endif

    <div class="row g-4">
        <div class="col-md-6">
            <div class="network-card h-100">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="mb-0">Followers preview</h6>
                    <a href="{{ route('social.profiles.followers', $profile->username) }}" class="text-primary small fw-semibold">View all</a>
                </div>
                @forelse($followers as $follower)
                    <div class="network-item">
                        <img src="{{ $follower->avatar_url }}" alt="{{ $follower->display_name ?? $follower->username }}">
                        <div>
                            <a href="{{ route('social.profiles.show', $follower->username ?? 'me') }}" class="fw-semibold text-dark text-decoration-none">
                                {{ $follower->display_name ?? $follower->user?->name ?? '@'.$follower->username }}
                            </a>
                            <div class="text-muted small">@{{ $follower->username }}</div>
                        </div>
                    </div>
                @empty
                    <p class="text-muted mb-0">No followers yet. Invite collaborators to follow this story.</p>
                @endforelse
            </div>
        </div>
        <div class="col-md-6">
            <div class="network-card h-100">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="mb-0">Following preview</h6>
                    <a href="{{ route('social.profiles.following', $profile->username) }}" class="text-primary small fw-semibold">View all</a>
                </div>
                @forelse($following as $connection)
                    <div class="network-item">
                        <img src="{{ $connection->avatar_url }}" alt="{{ $connection->display_name ?? $connection->username }}">
                        <div>
                            <a href="{{ route('social.profiles.show', $connection->username ?? 'me') }}" class="fw-semibold text-dark text-decoration-none">
                                {{ $connection->display_name ?? $connection->user?->name ?? '@'.$connection->username }}
                            </a>
                            <div class="text-muted small">@{{ $connection->username }}</div>
                        </div>
                    </div>
                @empty
                    <p class="text-muted mb-0">Not following anyone yet. Explore the feed to spark new connections.</p>
                @endforelse
            </div>
        </div>
    </div>

    @if($posts->count())
        <div class="profile-posts-grid">
            @foreach($posts as $post)
                @php
                    $mediaUrl = null;
                    $isVideo = false;

                    if (method_exists($post, 'relationLoaded') && $post->relationLoaded('media') && $post->media->isNotEmpty()) {
                        $firstMedia = $post->media->first();
                        $mediaUrl = $firstMedia->thumbnail_url ?? $firstMedia->url;
                        $isVideo = $firstMedia->is_video ?? false;
                    } elseif (is_array($post->media) && ! empty($post->media)) {
                        $firstMedia = $post->media[0];
                        $mediaUrl = $firstMedia['url'] ?? $firstMedia['path'] ?? null;
                        $isVideo = ($firstMedia['media_type'] ?? $firstMedia['type'] ?? '') === 'video';
                    }
                @endphp
                <div class="post-thumbnail" onclick="window.location.href='{{ route('social.posts.show', $post->id) }}'">
                    @if($mediaUrl)
                        @if($isVideo)
                            <video src="{{ $mediaUrl }}" muted></video>
                        @else
                            <img src="{{ $mediaUrl }}" alt="Post">
                        @endif
                    @else
                        <div style="position:absolute;inset:0;background:var(--gradient);"></div>
                    @endif
                    <div class="post-overlay">
                        <span><i class="fas fa-heart me-1"></i>{{ number_format($post->likes_count ?? $post->reactions_count ?? 0) }}</span>
                        <span><i class="fas fa-comment me-1"></i>{{ number_format($post->comments_count ?? 0) }}</span>
                    </div>
                </div>
            @endforeach
        </div>
    @else
        <div class="text-center py-5">
            <i class="fas fa-image fa-3x text-muted mb-3"></i>
            <p class="text-muted">No posts yet</p>
        </div>
    @endif

    <div class="mt-4">
        {{ $posts->links('pagination::bootstrap-5') }}
    </div>
</div>
@endsection

@push('scripts')
<script>
    (function () {
        const button = document.querySelector('[data-follow-toggle]');
        if (!button) {
            return;
        }

        const token = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

        button.addEventListener('click', () => {
            const url = button.getAttribute('data-toggle-url');
            button.disabled = true;

            fetch(url, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': token,
                    'Accept': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const followText = button.querySelector('.follow-text');
                    const followersCount = document.getElementById('followers-count');

                    if (data.is_following) {
                        button.classList.add('btn-following');
                        button.classList.remove('btn-follow');
                        followText.textContent = 'Following';
                    } else {
                        button.classList.add('btn-follow');
                        button.classList.remove('btn-following');
                        followText.textContent = 'Follow';
                    }

                    if (followersCount && typeof data.followers_count !== 'undefined') {
                        followersCount.textContent = new Intl.NumberFormat().format(data.followers_count);
                    }
                }
            })
            .finally(() => {
                button.disabled = false;
            });
        });
    })();
</script>
@endpush
