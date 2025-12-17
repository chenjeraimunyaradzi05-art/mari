@extends('frontend.layouts.master')

@section('title', 'Social Feed')

@php
    use App\Support\SocialPostFormatter;
    use Illuminate\Support\Str;
@endphp

@section('content')
@php
    $availableTabs = $feedTabs ?? [];
    $heroStats = [
        [
            'label' => 'Stories live',
            'value' => number_format(max(0, $stories->count() ?? 0)),
            'context' => 'Women sharing in real time',
        ],
        [
            'label' => 'Editorial pins',
            'value' => number_format(($editorialPins ?? collect())->count()),
            'context' => 'High-signal drops today',
        ],
        [
            'label' => 'New matches',
            'value' => number_format(count($suggestions ?? [])),
            'context' => 'Circles curated for you',
        ],
    ];
    $trendList = collect($trendCounters ?? []);
    $qualitySegments = collect($feedQuality['segments'] ?? []);
    $aiConfidence = $feedQuality['confidence'] ?? 87;
    $aiNarrative = $feedQuality['narrative'] ?? 'Signal guardians say your mix looks balanced and fast.';

    $hour = now()->hour;
    $greeting = match (true) {
        $hour >= 5 && $hour < 12 => 'Good morning',
        $hour >= 12 && $hour < 17 => 'Good afternoon',
        default => 'Good evening',
    };
    $userName = auth()->user()?->preferred_name ?? Str::before(auth()->user()?->name, ' ') ?? 'Member';
@endphp

<div id="social-feed-root" class="min-h-screen bg-gray-50 pb-12 pt-20" data-feed-wrapper>
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">

            <!-- Main Feed Column -->
            <div class="lg:col-span-8 space-y-6">

                <!-- Welcome Header -->
                <div class="flex items-center gap-4 mb-2 px-2">
                    <a href="{{ route('social.profiles.show', auth()->user()->username ?? 'me') }}" class="relative group">
                        <img src="{{ $profileAvatar ?? asset('images/default-avatar.png') }}" alt="{{ auth()->user()?->name }}" class="w-16 h-16 rounded-full object-cover border-4 border-white shadow-sm group-hover:border-rose-100 transition-colors">
                        <div class="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
                    </a>
                    <div>
                        <h1 class="text-2xl font-bold text-gray-900">{{ $greeting }}, {{ $userName }}!</h1>
                        <p class="text-gray-500 text-sm">Here's what's happening in your network today.</p>
                    </div>
                </div>

                <!-- Hero Section -->
                <section class="bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl shadow-lg p-8 text-gray-900 relative overflow-hidden border border-rose-100">
                    <div class="absolute top-0 right-0 w-64 h-64 bg-white/40 rounded-full blur-3xl -mr-20 -mt-20"></div>
                    <div class="relative z-10">
                        <p class="text-rose-600 text-xs uppercase tracking-widest font-bold mb-2">Athena Feed Preview</p>
                        <h1 class="text-3xl font-bold mb-3 text-rose-950">Women-first energy, signal-rich drops.</h1>
                        <p class="text-rose-900/80 mb-6 max-w-2xl">
                            A feed where economic wins, wellbeing check-ins, and partner intel live together.
                            Athena AI constantly tunes the mix so every scroll fuels decisions, not doom.
                        </p>

                        <div class="flex flex-wrap gap-2 mb-6">
                            <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 border border-rose-200 text-rose-700 text-xs font-medium backdrop-blur-sm">
                                <i class="fas fa-sparkles text-rose-500"></i> Athena calibration v3.6
                            </span>
                            <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 border border-rose-200 text-rose-700 text-xs font-medium backdrop-blur-sm">
                                <i class="fas fa-shield-heart text-rose-500"></i> Trust tier enforced
                            </span>
                        </div>

                        <div class="flex flex-wrap gap-3">
                            @if($canPost)
                                <button type="button" class="px-6 py-2 bg-rose-600 text-white font-bold rounded-xl shadow-sm hover:bg-rose-700 transition-colors" data-open-create-post data-composer-focus="text">
                                    Start a post
                                </button>
                            @endif
                            <a href="{{ route('social.feed.explore') }}" class="px-6 py-2 bg-white text-rose-700 font-bold rounded-xl hover:bg-rose-50 transition-colors border border-rose-200 shadow-sm">
                                Explore trending
                            </a>
                            <a href="{{ route('social.feed.recommendations') }}" class="px-6 py-2 bg-white text-rose-700 font-bold rounded-xl hover:bg-rose-50 transition-colors border border-rose-200 shadow-sm">
                                Signal forecast
                            </a>
                        </div>
                    </div>
                </section>

                <!-- Tabs -->
                @if(!empty($availableTabs))
                    <nav class="bg-gradient-to-br from-fuchsia-50 to-pink-50 rounded-2xl shadow-sm p-6 border border-pink-100" data-feed-tabs data-active-tab="{{ $activeTab }}" role="tablist">
                        <div class="flex justify-between items-start flex-wrap gap-3 mb-4">
                            <div>
                                <p class="text-xs font-bold text-fuchsia-900/60 uppercase tracking-wider mb-1">Feed blend</p>
                                <h4 class="text-lg font-bold text-gray-900">Switch lanes without breaking the feminine shell.</h4>
                            </div>
                            <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-rose-600 text-xs font-bold">
                                <i class="fas fa-wand-magic-sparkles"></i>
                                Adaptive AI on
                            </span>
                        </div>
                        <div class="flex flex-wrap gap-3">
                            @foreach($availableTabs as $tabKey => $tabLabel)
                                @php
                                    $isActive = $activeTab === $tabKey;
                                    $tabUrl = request()->fullUrlWithQuery(['tab' => $tabKey, 'page' => null]);
                                @endphp
                                <a
                                    href="{{ $tabUrl }}"
                                    role="tab"
                                    class="flex-1 min-w-[140px] rounded-xl p-4 border transition-all duration-200 flex flex-col gap-1 {{ $isActive ? 'bg-gradient-to-br from-white to-fuchsia-50 text-fuchsia-900 shadow-md border-fuchsia-100 transform -translate-y-0.5' : 'bg-white/40 text-gray-600 border-transparent hover:bg-white/80 hover:border-pink-100' }}"
                                    data-feed-tab="{{ $tabKey }}"
                                    data-feed-tab-url="{{ $tabUrl }}"
                                    @if($isActive) aria-current="true" aria-selected="true" @else aria-selected="false" @endif
                                >
                                    <span class="font-bold">{{ $tabLabel }}</span>
                                    <small class="{{ $isActive ? 'text-fuchsia-700' : 'text-gray-500' }} text-xs">{{ $tabKey === 'for_you' ? 'Personalized mix' : 'From your circles' }}</small>
                                </a>
                            @endforeach
                        </div>
                    </nav>
                @endif

                <!-- Create Post -->
                @if($canPost)
                    <section class="bg-white rounded-2xl shadow-sm p-6 border border-gray-100" data-create-post-card>
                        <div class="flex flex-wrap gap-3 align-items-center justify-between mb-4">
                            <div>
                                <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Compose</p>
                                <h4 class="text-lg font-bold text-gray-900">What can we celebrate or fix today?</h4>
                            </div>
                            <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-rose-600 text-xs font-bold">
                                <i class="fas fa-magic"></i>
                                Boost engine ready
                            </span>
                        </div>
                        <div class="flex flex-col gap-4">
                            <div class="flex gap-4 items-center">
                                <img src="{{ $profileAvatar ?? asset('images/default-avatar.png') }}" alt="{{ auth()->user()?->name }}" class="w-14 h-14 rounded-full object-cover border-2 border-rose-100">
                                <button type="button" class="flex-1 text-left p-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 text-gray-500 font-medium hover:bg-white hover:border-rose-300 hover:text-rose-600 transition-all" data-open-create-post data-composer-focus="text">
                                    Share a win, question, or opportunity with the network…
                                </button>
                            </div>
                            <div class="flex flex-wrap gap-3">
                                <button type="button" class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 text-gray-700 text-sm font-bold hover:bg-rose-50 hover:text-rose-600 transition-colors" data-open-create-post data-composer-focus="media">
                                    <i class="fas fa-camera"></i>
                                    Photo / Reel
                                </button>
                                <button type="button" class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 text-gray-700 text-sm font-bold hover:bg-rose-50 hover:text-rose-600 transition-colors" data-open-create-post data-composer-post-type="story">
                                    <i class="fas fa-bolt"></i>
                                    24h Story
                                </button>
                                <button type="button" class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 text-gray-700 text-sm font-bold hover:bg-rose-50 hover:text-rose-600 transition-colors" data-open-create-post data-composer-post-type="opportunity">
                                    <i class="fas fa-hand-holding-heart"></i>
                                    Opportunity drop
                                </button>
                            </div>
                        </div>
                    </section>
                @endif

                <!-- Stories Rail -->
                @if($stories->isNotEmpty())
                    <section class="bg-gradient-to-b from-white to-rose-50 rounded-2xl shadow-sm p-6 border border-rose-100" aria-label="Stories from your circles" data-story-rail>
                        <div class="flex flex-wrap gap-3 align-items-center justify-between mb-4">
                            <div>
                                <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Stories</p>
                                <h5 class="text-lg font-bold text-gray-900">Circles lighting up right now</h5>
                            </div>
                            <button type="button" class="text-rose-600 font-bold text-sm hover:text-rose-700 flex items-center gap-2" data-story-refresh>
                                <i class="fas fa-sync"></i> Refresh
                            </button>
                        </div>
                        <div class="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                            @foreach($stories as $profileId => $profileStories)
                                @php
                                    $storyProfile = optional($profileStories->first())->profile;
                                    $latestStory = $profileStories->sortByDesc('published_at')->first();
                                    $latestStoryDate = optional($latestStory)->published_at;
                                    $viewerHasSeenAll = $profileStories->every(fn ($story) => (bool) data_get($story->meta, 'viewer_has_seen', false));
                                    $hasNewStory = ! $viewerHasSeenAll;
                                    $isLiveStory = $latestStoryDate ? $latestStoryDate->greaterThan(now()->subMinutes(30)) : false;
                                    $storyState = $isLiveStory ? 'live' : ($hasNewStory ? 'new' : 'seen');
                                @endphp
                                @if($storyProfile)
                                    @php
                                        $storyLabel = ($hasNewStory ? 'New story from ' : 'Story from ') . ($storyProfile->display_name ?? '@'.$storyProfile->username);
                                        $storyPlaylist = $profileStories->map(function ($story) {
                                            $mediaItems = $story->media->map(function ($media) {
                                                $isModel = $media instanceof \App\Models\SocialMedia;
                                                $isVideo = $isModel
                                                    ? (bool) ($media->is_video ?? false)
                                                    : in_array(($media['type'] ?? $media['media_type'] ?? ''), ['video', 'mp4'], true);
                                                $source = $isModel
                                                    ? ($media->url ?? null)
                                                    : SocialPostFormatter::normalizeMediaPath($media['path'] ?? $media['file_path'] ?? '');
                                                if (! $source) {
                                                    return null;
                                                }

                                                $poster = $isModel
                                                    ? ($media->thumbnail_url ?? null)
                                                    : ($media['meta']['thumbnail'] ?? null);

                                                return [
                                                    'url' => $source,
                                                    'type' => $isVideo ? 'video' : 'image',
                                                    'poster' => $poster,
                                                ];
                                            })->filter()->values();

                                            $captionSource = $story->caption ?: $story->content;

                                            return [
                                                'id' => $story->id,
                                                'caption' => Str::limit(strip_tags((string) $captionSource), 220),
                                                'published_at' => optional($story->published_at)->toIso8601String(),
                                                'media' => $mediaItems,
                                            ];
                                        })->values();
                                    @endphp
                                    <button
                                        type="button"
                                        class="flex flex-col items-center gap-2 min-w-[90px] group transition-transform active:scale-95"
                                        data-story-state="{{ $storyState }}"
                                        data-story-playlist='@json($storyPlaylist)'
                                        data-story-display-name="{{ $storyProfile->display_name ?? '' }}"
                                        data-story-username="{{ $storyProfile->username }}"
                                        data-story-avatar="{{ $storyProfile->avatar_url }}"
                                        aria-label="{{ $storyLabel }}"
                                    >
                                        <div class="w-20 h-20 rounded-full p-[3px] {{ $storyState === 'live' || $storyState === 'new' ? 'bg-gradient-to-tr from-rose-400 via-pink-500 to-purple-500' : 'bg-gray-200' }}">
                                            <img src="{{ $storyProfile->avatar_url }}" alt="{{ $storyProfile->display_name ?? $storyProfile->username }}" class="w-full h-full rounded-full object-cover border-2 border-white">
                                        </div>
                                        <div class="text-xs font-bold text-gray-700 truncate w-full text-center">@{{ $storyProfile->username }}</div>
                                        @if($storyState === 'live')
                                            <span class="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold tracking-wider">LIVE</span>
                                        @elseif($storyState === 'new')
                                            <span class="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold tracking-wider">NEW</span>
                                        @endif
                                    </button>
                                @endif
                            @endforeach
                        </div>
                    </section>
                @endif

                <!-- Editorial Pins -->
                @if(($editorialPins ?? collect())->isNotEmpty())
                    <section class="bg-white rounded-2xl shadow-sm p-6 border border-gray-100" data-editorial-pins>
                        <div class="flex flex-wrap gap-3 align-items-center justify-between mb-6">
                            <div>
                                <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Editorial pins</p>
                                <h5 class="text-lg font-bold text-gray-900">Signal guardians picked these for you</h5>
                            </div>
                            <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-rose-600 text-xs font-bold">
                                <i class="fas fa-crown"></i>
                                Human + AI review
                            </span>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            @foreach($editorialPins as $pin)
                                @php
                                    $pinPayload = SocialPostFormatter::make($pin, auth()->user(), true);
                                    $pinTags = collect($pinPayload['tags'] ?? $pin->tags ?? [])->take(3);
                                @endphp
                                <article class="bg-white rounded-xl border border-rose-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                                    <div class="flex items-center gap-3 mb-3">
                                        <img src="{{ $pin->profile?->avatar_url ?? asset('images/default-avatar.png') }}" alt="{{ $pin->profile?->display_name ?? $pin->profile?->username }} avatar" class="w-10 h-10 rounded-full object-cover">
                                        <div>
                                            <p class="text-sm font-bold text-gray-900">{{ $pin->profile?->display_name ?? '@'.$pin->profile?->username }}</p>
                                            <small class="text-xs text-gray-500">{{ ucfirst($pin->post_type ?? 'story') }} · {{ optional($pin->published_at)->diffForHumans() }}</small>
                                        </div>
                                    </div>
                                    <p class="text-gray-600 text-sm mb-3 line-clamp-3">
                                        {{ Str::limit(strip_tags((string) ($pinPayload['content'] ?? $pin->caption ?? '')), 220) }}
                                    </p>
                                    @if($pinTags->isNotEmpty())
                                        <div class="flex flex-wrap gap-2 mb-3">
                                            @foreach($pinTags as $tag)
                                                <span class="px-2 py-1 rounded-full bg-rose-50 text-rose-600 text-xs font-bold">{{ Str::start($tag, '#') }}</span>
                                            @endforeach
                                        </div>
                                    @endif
                                    <div class="flex gap-4 text-xs text-gray-500 font-medium">
                                        <span><i class="fas fa-star text-amber-400 mr-1"></i>{{ number_format((float) ($pin->ai_engagement_score ?? 0), 1) }} quality</span>
                                        <span><i class="fas fa-heart text-rose-500 mr-1"></i>{{ number_format((int) ($pin->likes_count ?? 0)) }} loves</span>
                                    </div>
                                </article>
                            @endforeach
                        </div>
                    </section>
                @endif

                <!-- Offline Banner -->
                <div class="bg-rose-50 border border-rose-100 rounded-xl p-4 flex items-center justify-between gap-3" data-offline-banner hidden>
                    <div class="flex items-center gap-3">
                        <i class="fas fa-signal-slash text-rose-600"></i>
                        <div>
                            <p class="font-bold text-rose-900 text-sm">You're offline</p>
                            <small class="text-rose-700">We'll sync likes, saves, and comments when you're back online.</small>
                        </div>
                    </div>
                    <button type="button" class="text-rose-400 hover:text-rose-600" data-offline-dismiss aria-label="Dismiss offline banner">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Posts Container -->
                <div id="posts-container" class="space-y-6" data-feed-items data-next-url="{{ $posts->nextPageUrl() }}">
                    @include('social.feed.partials.posts', ['posts' => $posts])
                </div>

                <!-- Error State -->
                <div class="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center justify-between gap-3 text-red-700" data-feed-error hidden>
                    <div>
                        <strong>We couldn't refresh your feed.</strong>
                        <p class="text-sm">Check your connection or try again shortly.</p>
                    </div>
                    <button type="button" class="px-4 py-1 bg-red-100 hover:bg-red-200 rounded-full text-sm font-bold transition-colors" data-feed-retry>Retry</button>
                </div>

                <!-- Loading State -->
                <div id="feed-loading" class="text-center py-8 text-rose-600 font-medium" hidden>
                    <i class="fas fa-spinner fa-spin mr-2" aria-hidden="true"></i>
                    <span>Loading more stories…</span>
                </div>

                <div data-feed-anchor class="h-1"></div>
            </div>

            <!-- Right Sidebar -->
            <aside class="lg:col-span-4 space-y-6">

                <!-- Connections -->
                <div class="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl shadow-sm p-6 border border-indigo-100">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <small class="text-xs font-bold text-indigo-400 uppercase tracking-wider">Connections</small>
                            <h6 class="text-lg font-bold text-indigo-950">Matches tuned by Networking AI</h6>
                        </div>
                        <i class="fas fa-user-plus text-indigo-500"></i>
                    </div>
                    <div class="space-y-4">
                        @forelse($suggestions as $suggestion)
                            <div class="flex items-center justify-between gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                                <div class="flex items-center gap-3">
                                    <img src="{{ $suggestion['avatar_url'] }}" alt="{{ $suggestion['display_name'] }}" class="w-10 h-10 rounded-full object-cover">
                                    <div>
                                        <a href="{{ $suggestion['profile_url'] }}" class="font-bold text-gray-900 hover:text-rose-600 text-sm block transition-colors">
                                            {{ $suggestion['display_name'] }}
                                        </a>
                                        @if(!empty($suggestion['reason']))
                                            <div class="text-xs text-gray-400 mt-0.5">{{ $suggestion['reason'] }}</div>
                                        @endif
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    class="px-3 py-1 rounded-full text-xs font-bold transition-colors {{ $suggestion['is_following'] ? 'border border-gray-200 text-gray-500 hover:bg-gray-50' : 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm' }}"
                                    data-follow-button
                                    data-username="{{ $suggestion['username'] }}"
                                    data-following="{{ $suggestion['is_following'] ? 'true' : 'false' }}"
                                >
                                    {{ $suggestion['is_following'] ? 'Following' : 'Follow' }}
                                </button>
                            </div>
                        @empty
                            <div class="mb-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
                                <div class="flex justify-between items-start mb-2">
                                    <div>
                                        <p class="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-0.5">Brand Partnership</p>
                                        <h5 class="font-bold text-gray-900 text-sm">Advertising & Promotions</h5>
                                    </div>
                                    <span class="bg-white/60 px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-600 border border-amber-100">Ad</span>
                                </div>
                                <p class="text-xs text-gray-600 mb-3">Explore exclusive opportunities from our trusted partners.</p>
                                <button type="button" class="w-full py-1.5 bg-white text-amber-700 text-xs font-bold rounded-lg border border-amber-200 hover:bg-amber-50 transition-colors shadow-sm">
                                    View Opportunities
                                </button>
                            </div>

                            <div class="text-center py-8 px-4">
                                <div class="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <i class="fas fa-user-friends text-gray-400 text-xl"></i>
                                </div>
                                <p class="text-gray-900 font-bold text-sm mb-1">No connections yet</p>
                                <p class="text-gray-500 text-xs mb-3">We'll find more matches as you engage.</p>
                                <a href="{{ route('social.feed.explore') }}" class="text-rose-600 font-bold text-xs hover:text-rose-700">
                                    Explore network
                                </a>
                            </div>
                        @endforelse
                    </div>
                </div>

                <!-- Sidebar Ad -->
                <div class="bg-white rounded-2xl shadow-sm p-6 border border-rose-100 relative overflow-hidden">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full blur-2xl -mr-10 -mt-10"></div>
                    <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Sponsored</p>
                    <h3 class="text-lg font-bold mb-2 text-rose-900">Unlock Premium Analytics</h3>
                    <p class="text-gray-600 text-sm mb-4">Get deeper insights into your social reach and network growth.</p>
                    <button class="w-full py-2 bg-rose-900 text-white font-bold rounded-xl hover:bg-rose-800 transition-colors text-sm">
                        Start Free Trial
                    </button>
                </div>

                <!-- Trending -->
                @if($trendList->isNotEmpty())
                    <div class="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <small class="text-xs font-bold text-gray-400 uppercase tracking-wider">Trending tags</small>
                                <h6 class="text-lg font-bold text-gray-900">Conversations gaining momentum</h6>
                            </div>
                            <i class="fas fa-hashtag text-rose-500"></i>
                        </div>
                        <div class="space-y-3">
                            @foreach($trendList as $topic)
                                <div class="flex items-center justify-between pb-2 border-b border-gray-50 last:border-0 last:pb-0">
                                    <div>
                                        <p class="font-bold text-gray-700 text-sm">#{{ $topic['tag'] }}</p>
                                        <small class="text-xs text-gray-400">{{ $topic['count'] }} mentions · {{ $topic['direction'] === 'up' ? 'Rising' : ($topic['direction'] === 'down' ? 'Cooling' : 'Holding') }}</small>
                                    </div>
                                    <span class="px-2 py-1 rounded-lg text-xs font-bold {{ $topic['direction'] === 'down' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600' }}">
                                        {{ $topic['change'] > 0 ? '+' : '' }}{{ $topic['change'] ?? 0 }}
                                    </span>
                                </div>
                            @endforeach
                        </div>
                    </div>
                @endif

                <!-- Quality Mix -->
                @if($qualitySegments->isNotEmpty())
                    <div class="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl shadow-lg p-6 border border-emerald-100">
                        <div class="flex items-center justify-between mb-6">
                            <div>
                                <small class="text-xs font-bold text-emerald-600 uppercase tracking-wider">Feed mix</small>
                                <h6 class="text-lg font-bold text-emerald-900">Quality controls</h6>
                            </div>
                            <div class="h-8 w-8 rounded-full bg-white flex items-center justify-center border border-emerald-200">
                                <i class="fas fa-balance-scale text-emerald-600"></i>
                            </div>
                        </div>
                        <div class="space-y-5">
                            @foreach($qualitySegments as $key => $segment)
                                @php
                                    $barWidth = min(100, max(0, $segment['ratio'] ?? 0));
                                @endphp
                                <div>
                                    <div class="flex justify-between items-center mb-2">
                                        <span class="text-sm font-bold text-emerald-900">{{ Str::headline($key) }}</span>
                                        <div class="flex items-center gap-2">
                                            <span class="text-xs font-bold {{ !empty($segment['is_below_goal']) ? 'text-amber-600' : 'text-emerald-700' }}">
                                                {{ number_format($segment['ratio'] ?? 0, 1) }}%
                                            </span>
                                            <span class="text-xs text-emerald-600/70">/ {{ $segment['goal'] ?? '—' }}%</span>
                                        </div>
                                    </div>
                                    <div class="h-2 bg-emerald-100 rounded-full overflow-hidden border border-emerald-200">
                                        <div class="h-full rounded-full transition-all duration-500 {{ !empty($segment['is_below_goal']) ? 'bg-amber-400' : 'bg-emerald-500' }}" style="width: {{ $barWidth }}%;"></div>
                                    </div>
                                </div>
                            @endforeach
                        </div>
                        @if(!empty($feedQuality['alerts']))
                            <div class="mt-4 bg-white/60 border border-emerald-200 rounded-xl p-4 relative overflow-hidden shadow-sm">
                                <div class="flex items-center gap-2 mb-3">
                                    <span class="relative flex h-2 w-2">
                                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                      <span class="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                    </span>
                                    <p class="text-xs font-bold text-rose-600 uppercase tracking-wider">Tuning Required</p>
                                </div>
                                <ul class="space-y-2">
                                    @foreach($feedQuality['alerts'] as $alert)
                                        <li class="flex items-start gap-2 text-xs text-emerald-800">
                                            <i class="fas fa-bolt text-rose-500 mt-0.5"></i>
                                            <span class="font-medium">{{ $alert }}</span>
                                        </li>
                                    @endforeach
                                </ul>
                            </div>
                        @endif
                    </div>
                @endif

                <!-- AI Panel -->
                <div class="bg-gradient-to-br from-slate-50 via-indigo-50 to-slate-50 rounded-2xl shadow-lg p-6 text-gray-900 border border-indigo-100">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <small class="text-xs font-bold text-indigo-600 uppercase tracking-wider">Synced AI</small>
                            <h6 class="text-lg font-bold text-indigo-950">Pulse from Athena</h6>
                        </div>
                        <span class="px-2 py-1 rounded-lg bg-white text-xs font-bold border border-indigo-200 text-indigo-700 shadow-sm">
                            <i class="fas fa-bolt text-amber-400 mr-1"></i> Live
                        </span>
                    </div>
                    <p class="text-slate-700 text-sm mb-5 leading-relaxed font-medium">{{ $aiNarrative }}</p>
                    <ul class="space-y-3 mb-5">
                        <li class="flex justify-between text-sm text-slate-600">
                            <span>Confidence score</span>
                            <strong class="text-indigo-900">{{ number_format($aiConfidence, 0) }}%</strong>
                        </li>
                        <li class="flex justify-between text-sm text-slate-600">
                            <span>Focus mix</span>
                            <strong class="text-indigo-900">{{ $feedQuality['focus_mix'] ?? 'Wellbeing + Ops' }}</strong>
                        </li>
                        <li class="flex justify-between text-sm text-slate-600">
                            <span>Next refresh</span>
                            <strong class="text-indigo-900">{{ $feedQuality['next_refresh'] ?? '7m' }}</strong>
                        </li>
                    </ul>
                    <button type="button" class="w-full py-2.5 bg-white text-indigo-700 font-bold rounded-xl hover:bg-indigo-50 transition-colors text-sm shadow-sm border border-indigo-200" data-open-analytics>
                        Open full insight
                    </button>
                </div>

                <!-- Notifications -->
                <div class="bg-gradient-to-br from-slate-50 via-gray-50 to-slate-50 rounded-2xl shadow-lg p-6 border border-slate-200 text-gray-900" data-notification-panel>
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Notifications</p>
                            <h6 class="text-lg font-bold text-slate-900" id="notification-panel-title">Stay in control</h6>
                        </div>
                        <button type="button" class="text-slate-600 text-xs font-bold hover:text-slate-800 bg-white px-3 py-1 rounded-full transition-colors border border-slate-200 shadow-sm" data-notification-refresh>
                            <i class="fas fa-sync mr-1"></i>Refresh
                        </button>
                    </div>
                    <p class="text-slate-500 text-xs mb-5">Choose which alerts arrive in the app or via email.</p>

                    <div class="text-center py-8 text-slate-400" data-notification-loading>
                        <i class="fas fa-spinner fa-spin mr-2" aria-hidden="true"></i>
                        <span class="text-sm font-medium">Loading your preferences…</span>
                    </div>

                    <div class="space-y-2" data-notification-body></div>

                    <div class="text-center py-8 text-slate-400 text-sm" data-notification-empty hidden>
                        No notification categories are available right now.
                    </div>

                    <div class="flex justify-between items-center mt-6 pt-4 border-t border-slate-200">
                        <button type="button" class="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors" data-notification-reset hidden>
                            Reset to defaults
                        </button>
                        <button type="button" class="w-full sm:w-auto px-6 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md ml-auto" data-notification-save disabled>
                            <span data-notification-save-label>Save preferences</span>
                            <span class="ml-2" data-notification-save-spinner hidden>
                                <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                            </span>
                        </button>
                    </div>
                    <p class="text-emerald-600 text-xs font-bold mt-3 text-center min-h-[1.5em]" data-notification-status aria-live="polite"></p>
                    <div class="text-rose-600 text-xs font-bold mt-2 text-center" data-notification-error hidden role="alert"></div>
                </div>
            </aside>
        </div>
    </div>
</div>

<div class="fixed top-20 right-4 z-50 flex flex-col gap-3 pointer-events-none" data-toast-stack aria-live="polite" aria-atomic="true"></div>
@endsection

@if($canPost)
    @include('social.posts.create-modal', [
        'createPostRoute' => $createPostRoute,
        'profileAvatar' => $profileAvatar,
        'composerLimits' => $composerLimits,
    ])
@endif

@push('scripts')
@php
    $reactionPalette = config('social.reactions.palette');
    $shareChannels = config('social.shares.channels');
@endphp
<script>
    window.socialReactionPalette = @json($reactionPalette);
    window.socialShareChannels = @json($shareChannels);
</script>
<script>
(function () {
    'use strict';

    // --- 1. Comment Thread Controller ---
    class CommentThreadController {
        constructor(interactions) {
            this.interactions = interactions;
            this.loadingStates = new WeakMap();
        }

        async toggleComments(postCard) {
            const commentsSection = postCard.querySelector('[data-comment-thread]');
            if (!commentsSection) return;

            if (!commentsSection.hidden) {
                commentsSection.hidden = true;
                return;
            }

            commentsSection.hidden = false;
            const list = commentsSection.querySelector('[data-comment-thread-body]');

            // If empty (or just has the empty message), load comments
            const hasComments = list && list.children.length > 0 && !list.querySelector('[data-comment-thread-empty]');

            if (!hasComments) {
                await this.loadComments(postCard);
            }

            // Focus input
            const input = commentsSection.querySelector('textarea, input');
            if (input) setTimeout(() => input.focus(), 100);
        }

        async loadComments(postCard) {
            const postId = postCard.dataset.postId;
            const list = postCard.querySelector('[data-comment-thread-body]');
            const loader = postCard.querySelector('[data-comment-loading]');

            if (!list || !loader) return;

            loader.hidden = false;

            try {
                const response = await fetch(`/social/posts/${postId}/comments`, {
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });

                if (!response.ok) throw new Error('Failed to load comments');

                const html = await response.text();
                if (!html.trim()) {
                    list.innerHTML = '<p class="text-center text-gray-400 text-sm py-4" data-comment-thread-empty>Be the first to share some encouragement.</p>';
                } else {
                    list.innerHTML = html;
                }
            } catch (error) {
                console.error('Comment load error:', error);
                this.interactions.showToast({ message: 'Could not load comments', type: 'error' });
            } finally {
                loader.hidden = true;
            }
        }

        async submitComment(form) {
            const postCard = form.closest('[data-post-card]');
            const input = form.querySelector('textarea[name="content"]');
            const submitBtn = form.querySelector('button[type="submit"]');
            const postId = postCard.dataset.postId;
            const body = input.value.trim();

            if (!body) return;

            input.disabled = true;
            submitBtn.disabled = true;
            const originalLabel = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            try {
                const response = await fetch(`/social/posts/${postId}/comments`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': this.interactions.csrfToken,
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify({ content: body })
                });

                if (!response.ok) throw new Error('Failed to post comment');

                const data = await response.json();

                const list = postCard.querySelector('[data-comment-thread-body]');
                if (list) {
                    const emptyState = list.querySelector('[data-comment-thread-empty]');
                    if (emptyState) emptyState.remove();

                    const temp = document.createElement('div');
                    temp.innerHTML = data.html || this.generateCommentHtml(data.comment || { body: body }, data.user || { name: 'You', avatar_url: '{{ auth()->user()?->avatar_url ?? asset("images/default-avatar.png") }}' });
                    list.insertBefore(temp.firstElementChild, list.firstChild);
                }

                const countBadge = postCard.querySelector('[data-comment-count]');
                if (countBadge) {
                    const current = parseInt(countBadge.textContent.replace(/\D/g, '') || '0');
                    countBadge.textContent = (current + 1).toLocaleString();
                }

                input.value = '';
                this.interactions.showToast({ message: 'Comment posted', type: 'success' });

            } catch (error) {
                console.error('Comment submit error:', error);
                this.interactions.showToast({ message: 'Failed to post comment', type: 'error' });
            } finally {
                input.disabled = false;
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalLabel;
                input.focus();
            }
        }

        generateCommentHtml(comment, user) {
            return `
                <div class="flex gap-3 mb-4 animate-fade-in-up">
                    <img src="${user.avatar_url}" class="w-8 h-8 rounded-full object-cover border border-gray-100">
                    <div class="flex-1 bg-gray-50 rounded-xl p-3">
                        <div class="flex justify-between items-baseline mb-1">
                            <span class="text-sm font-bold text-gray-900">${user.name}</span>
                            <span class="text-xs text-gray-400">Just now</span>
                        </div>
                        <p class="text-sm text-gray-700">${comment.body || comment.content}</p>
                    </div>
                </div>
            `;
        }
    }

    // --- 2. Social Interactions Manager ---
    class SocialInteractions {
        constructor() {
            this.csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
            this.commentController = new CommentThreadController(this);
            this.init();
        }

        init() {
            this.bindEvents();
        }

        bindEvents() {
            document.addEventListener('click', (e) => {
                const target = e.target;

                // Like Button
                const likeBtn = target.closest('[data-like-button]');
                if (likeBtn) {
                    e.preventDefault();
                    this.handleLike(likeBtn);
                    return;
                }

                // Comment Toggle
                const commentBtn = target.closest('[data-comment-trigger]');
                if (commentBtn) {
                    e.preventDefault();
                    const postCard = commentBtn.closest('[data-post-card]');
                    if (postCard) this.commentController.toggleComments(postCard);
                    return;
                }

                // Close Comment Thread
                const closeCommentBtn = target.closest('[data-close-comment-thread]');
                if (closeCommentBtn) {
                    e.preventDefault();
                    const thread = closeCommentBtn.closest('[data-comment-thread]');
                    if (thread) thread.hidden = true;
                    return;
                }

                // Share Button
                const shareBtn = target.closest('[data-share-card]');
                if (shareBtn) {
                    e.preventDefault();
                    const postCard = shareBtn.closest('[data-post-card]');
                    if (postCard) this.createShareSheet(postCard);
                    return;
                }
            });

            // Comment Form Submit
            document.addEventListener('submit', (e) => {
                if (e.target.matches('[data-comment-form]')) {
                    e.preventDefault();
                    this.commentController.submitComment(e.target);
                }
            });
        }

        async handleLike(button) {
            if (button.disabled) return;

            const postCard = button.closest('[data-post-card]');
            const postId = postCard.dataset.postId;
            const isLiked = button.getAttribute('aria-pressed') === 'true';
            const icon = button.querySelector('i');
            const countSpan = button.querySelector('[data-like-count]');

            // Optimistic UI update
            button.disabled = true;
            button.setAttribute('aria-pressed', isLiked ? 'false' : 'true');

            if (isLiked) {
                button.classList.remove('text-rose-600', 'bg-rose-50');
                button.classList.add('text-gray-500', 'hover:bg-gray-50');
                icon.classList.replace('fas', 'far');
                if (countSpan) countSpan.textContent = Math.max(0, parseInt(countSpan.textContent.replace(/,/g, '') || 0) - 1).toLocaleString();
            } else {
                button.classList.remove('text-gray-500', 'hover:bg-gray-50');
                button.classList.add('text-rose-600', 'bg-rose-50');
                icon.classList.replace('far', 'fas');
                icon.classList.add('scale-125');
                setTimeout(() => icon.classList.remove('scale-125'), 200);
                if (countSpan) countSpan.textContent = (parseInt(countSpan.textContent.replace(/,/g, '') || 0) + 1).toLocaleString();
            }

            try {
                const response = await fetch(`/social/posts/${postId}/like`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': this.csrfToken,
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                if (!response.ok) throw new Error('Network error');

            } catch (error) {
                console.error('Like error:', error);
                button.setAttribute('aria-pressed', isLiked ? 'true' : 'false');
                this.showToast({ message: 'Action failed', type: 'error' });
            } finally {
                button.disabled = false;
            }
        }

        createShareSheet(postCard) {
            const existing = document.querySelector('[data-share-sheet]');
            if (existing) existing.remove();

            const postId = postCard.dataset.postId;
            const author = postCard.dataset.authorName || 'Athena Member';
            const url = window.location.origin + '/social/posts/' + postId;

            const sheet = document.createElement('div');
            sheet.setAttribute('data-share-sheet', '');
            sheet.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 opacity-0 pointer-events-none transition-opacity duration-300';

            const channels = window.socialShareChannels || {
                copy: { label: 'Copy Link', icon: 'fas fa-link', color: '#6b7280' },
                twitter: { label: 'Twitter', icon: 'fab fa-twitter', color: '#1da1f2' },
                facebook: { label: 'Facebook', icon: 'fab fa-facebook', color: '#1877f2' },
                linkedin: { label: 'LinkedIn', icon: 'fab fa-linkedin', color: '#0a66c2' },
                email: { label: 'Email', icon: 'fas fa-envelope', color: '#ea4335' }
            };

            let gridHtml = '';
            for (const [key, config] of Object.entries(channels)) {
                gridHtml += `
                    <button type="button"
                        class="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-50 transition-colors group w-full"
                        data-share-action="${key}"
                        data-share-url="${url}"
                    >
                        <div class="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl shadow-sm group-hover:scale-110 transition-transform" style="background-color: ${config.color}">
                            <i class="${config.icon}"></i>
                        </div>
                        <span class="text-xs font-medium text-gray-600 group-hover:text-gray-900">${config.label}</span>
                    </button>
                `;
            }

            sheet.innerHTML = `
                <div class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" data-share-close></div>
                <div class="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl transform scale-95 transition-transform duration-300 overflow-hidden">
                    <div class="p-5 border-b border-gray-100 flex justify-between items-center">
                        <h3 class="font-bold text-gray-900">Share this post</h3>
                        <button type="button" class="text-gray-400 hover:text-gray-600 transition-colors" data-share-close>
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="p-6 grid grid-cols-3 gap-4">
                        ${gridHtml}
                    </div>
                    <div class="p-4 bg-gray-50 border-t border-gray-100 text-center">
                        <p class="text-xs text-gray-500">Sharing supports ${author}'s visibility.</p>
                    </div>
                </div>
            `;

            document.body.appendChild(sheet);

            // Bind events
            sheet.querySelectorAll('[data-share-close]').forEach(el => {
                el.addEventListener('click', () => this.closeShareSheet(sheet));
            });

            sheet.querySelectorAll('[data-share-action]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const action = e.currentTarget.dataset.shareAction;
                    const shareUrl = e.currentTarget.dataset.shareUrl;
                    this.handleShareAction(action, shareUrl);
                    this.closeShareSheet(sheet);
                });
            });

            // Animate in
            requestAnimationFrame(() => {
                sheet.classList.remove('opacity-0', 'pointer-events-none');
                const dialog = sheet.querySelector('.relative');
                if (dialog) {
                    dialog.classList.remove('scale-95');
                    dialog.classList.add('scale-100');
                }
            });
        }

        closeShareSheet(sheet) {
            sheet.classList.add('opacity-0', 'pointer-events-none');
            const dialog = sheet.querySelector('.relative');
            if (dialog) {
                dialog.classList.remove('scale-100');
                dialog.classList.add('scale-95');
            }
            setTimeout(() => sheet.remove(), 300);
        }

        handleShareAction(action, url) {
            if (action === 'copy') {
                navigator.clipboard.writeText(url).then(() => {
                    this.showToast({ message: 'Link copied to clipboard', type: 'success' });
                });
                return;
            }

            let shareUrl = '';
            switch (action) {
                case 'twitter': shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`; break;
                case 'facebook': shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`; break;
                case 'linkedin': shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`; break;
                case 'email': shareUrl = `mailto:?body=${encodeURIComponent(url)}`; break;
            }

            if (shareUrl) {
                window.open(shareUrl, '_blank', 'width=600,height=400');
            }
        }

        showToast({ message, type = 'info', duration = 3200 }) {
            const toastStack = document.querySelector('[data-toast-stack]');
            if (!toastStack) return;

            const toast = document.createElement('div');
            let bgClass = 'bg-gray-800';
            if (type === 'success') bgClass = 'bg-emerald-600';
            if (type === 'error') bgClass = 'bg-rose-600';
            if (type === 'warning') bgClass = 'bg-amber-500';

            toast.className = `pointer-events-auto min-w-[240px] rounded-xl p-4 text-white shadow-lg transform transition-all duration-300 translate-y-2 opacity-0 ${bgClass} flex items-center gap-3`;

            let icon = '';
            if (type === 'success') icon = '<i class="fas fa-check-circle"></i>';
            else if (type === 'error') icon = '<i class="fas fa-exclamation-circle"></i>';
            else if (type === 'warning') icon = '<i class="fas fa-exclamation-triangle"></i>';
            else icon = '<i class="fas fa-info-circle"></i>';

            toast.innerHTML = `
                <span class="text-lg">${icon}</span>
                <span class="font-medium text-sm">${message}</span>
            `;

            toastStack.appendChild(toast);

            requestAnimationFrame(() => {
                toast.classList.remove('translate-y-2', 'opacity-0');
            });

            setTimeout(() => {
                toast.classList.add('translate-y-2', 'opacity-0');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }
    }

    // Initialize Social Interactions
    window.socialInteractions = new SocialInteractions();

    // --- 3. Feed Logic (Infinite Scroll, etc.) ---
    const postsContainer = document.querySelector('[data-feed-items]');
    const feedAnchor = document.querySelector('[data-feed-anchor]');
    const loadingIndicator = document.getElementById('feed-loading');
    const errorState = document.querySelector('[data-feed-error]');
    const offlineBanner = document.querySelector('[data-offline-banner]');
    let nextUrl = postsContainer ? postsContainer.dataset.nextUrl || null : null;
    let isFetching = false;
    let observer;

    const toggleLoading = (state) => {
        if (!loadingIndicator) return;
        loadingIndicator.hidden = !state;
    };

    const toggleError = (state) => {
        if (!errorState) return;
        errorState.hidden = !state;
    };

    const toggleOffline = (state) => {
        if (!offlineBanner) return;
        offlineBanner.hidden = !state;
    };

    window.addEventListener('offline', () => toggleOffline(true));
    window.addEventListener('online', () => toggleOffline(false));
    document.querySelector('[data-offline-dismiss]')?.addEventListener('click', () => toggleOffline(false));

    const fetchNextPage = async () => {
        if (!postsContainer || !nextUrl || isFetching) return;
        isFetching = true;
        toggleLoading(true);
        toggleError(false);
        try {
            const response = await fetch(nextUrl, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin',
            });
            if (!response.ok) throw new Error('bad-response');
            const html = await response.text();
            const temp = document.createElement('div');
            temp.innerHTML = html;
            const nextItems = temp.querySelector('[data-feed-items]');
            if (nextItems) {
                postsContainer.insertAdjacentHTML('beforeend', nextItems.innerHTML);
                nextUrl = nextItems.dataset.nextUrl || null;
                postsContainer.dataset.nextUrl = nextUrl || '';
            } else {
                nextUrl = null;
            }
            if (!nextUrl && feedAnchor && observer) observer.unobserve(feedAnchor);
        } catch (error) {
            toggleError(true);
        } finally {
            toggleLoading(false);
            isFetching = false;
        }
    };

    if (feedAnchor && postsContainer) {
        observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) fetchNextPage();
            });
        }, { rootMargin: '0px 0px 400px 0px' });
        if (nextUrl) observer.observe(feedAnchor);
    }

    document.querySelector('[data-feed-retry]')?.addEventListener('click', fetchNextPage);

    // --- 4. Composer Modal Logic ---
    const openComposer = () => {
        const composerModal = document.querySelector('[data-create-post-modal]');
        if (composerModal) {
            composerModal.classList.remove('opacity-0', 'pointer-events-none');
            composerModal.classList.add('opacity-100', 'pointer-events-auto');
            const panel = composerModal.querySelector('.relative');
            if (panel) {
                panel.classList.remove('scale-95');
                panel.classList.add('scale-100');
            }
        } else {
            window.dispatchEvent(new CustomEvent('athena:open-composer'));
        }
    };

    const closeComposer = () => {
        const composerModal = document.querySelector('[data-create-post-modal]');
        if (composerModal) {
            composerModal.classList.remove('opacity-100', 'pointer-events-auto');
            composerModal.classList.add('opacity-0', 'pointer-events-none');
            const panel = composerModal.querySelector('.relative');
            if (panel) {
                panel.classList.remove('scale-100');
                panel.classList.add('scale-95');
            }
        }
    };

    document.querySelectorAll('[data-open-create-post]').forEach(btn => btn.addEventListener('click', openComposer));
    document.querySelectorAll('[data-close-create-post]').forEach(btn => btn.addEventListener('click', closeComposer));

    // --- 5. Story Viewer Logic ---
    const storyButtons = document.querySelectorAll('[data-story-playlist]');
    storyButtons.forEach((button) => {
        button.addEventListener('click', () => {
            let playlist = [];
            try {
                playlist = JSON.parse(button.dataset.storyPlaylist || '[]');
            } catch (error) {
                playlist = [];
            }
            if (window.AthenaStoryViewer && typeof window.AthenaStoryViewer.open === 'function') {
                window.AthenaStoryViewer.open({
                    playlist,
                    profile: {
                        displayName: button.dataset.storyDisplayName || '',
                        username: button.dataset.storyUsername || '',
                        avatar: button.dataset.storyAvatar || '',
                    },
                });
            } else {
                window.socialInteractions.showToast({ message: 'Story viewer not available yet.', type: 'warning' });
            }
        });
    });

    document.querySelector('[data-story-refresh]')?.addEventListener('click', () => {
        storyButtons.forEach((button) => {
            button.classList.add('scale-105');
            setTimeout(() => button.classList.remove('scale-105'), 600);
        });
        window.socialInteractions.showToast({ message: 'Stories refreshed', type: 'success' });
    });

    // --- 6. Follow Button Logic ---
    document.querySelectorAll('[data-follow-button]').forEach((button) => {
        button.addEventListener('click', () => {
            const following = button.dataset.following === 'true';
            button.dataset.following = following ? 'false' : 'true';

            if (following) {
                button.classList.remove('border', 'border-gray-200', 'text-gray-500', 'hover:bg-gray-50');
                button.classList.add('bg-rose-600', 'text-white', 'hover:bg-rose-700', 'shadow-sm');
                button.textContent = 'Follow';
            } else {
                button.classList.remove('bg-rose-600', 'text-white', 'hover:bg-rose-700', 'shadow-sm');
                button.classList.add('border', 'border-gray-200', 'text-gray-500', 'hover:bg-gray-50');
                button.textContent = 'Following';
            }

            window.socialInteractions.showToast({
                message: following ? 'Connection removed' : 'Following added',
                type: following ? 'warning' : 'success'
            });
        });
    });

    // --- 7. Notification Panel Logic ---
    const notificationPanel = document.querySelector('[data-notification-panel]');
    if (notificationPanel) {
        const body = notificationPanel.querySelector('[data-notification-body]');
        const loadingState = notificationPanel.querySelector('[data-notification-loading]');
        const emptyState = notificationPanel.querySelector('[data-notification-empty]');
        const refreshBtn = notificationPanel.querySelector('[data-notification-refresh]');
        const resetBtn = notificationPanel.querySelector('[data-notification-reset]');
        const saveBtn = notificationPanel.querySelector('[data-notification-save]');
        const saveLabel = notificationPanel.querySelector('[data-notification-save-label]');
        const saveSpinner = notificationPanel.querySelector('[data-notification-save-spinner]');
        const statusArea = notificationPanel.querySelector('[data-notification-status]');
        const errorArea = notificationPanel.querySelector('[data-notification-error]');
        const STORAGE_KEY = 'athena_notification_prefs_v1';

        const template = [
            { key: 'signals', label: 'Signal summaries', description: 'Weekly pulse of partnerships and wellbeing trends.', enabled: true },
            { key: 'alerts', label: 'Critical alerts', description: 'Instant compliance or trust tier changes.', enabled: true },
            { key: 'invites', label: 'Circle invites', description: 'Requests to join curated squads.', enabled: false },
        ];

        const loadPrefs = () => {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                return saved ? JSON.parse(saved) : null;
            } catch (e) { return null; }
        };

        const savePrefs = (newPrefs) => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs));
        };

        const renderRows = (items) => {
            body.innerHTML = '';
            items.forEach((item) => {
                const row = document.createElement('label');
                row.className = 'flex items-center justify-between py-3 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors';
                row.innerHTML = `
                    <div class="flex-1">
                        <p class="mb-0 font-bold text-sm text-slate-900">${item.label}</p>
                        <small class="text-slate-500 text-xs">${item.description}</small>
                    </div>
                    <input type="checkbox" class="w-5 h-5 text-indigo-600 rounded border-slate-300 bg-white focus:ring-indigo-500 focus:ring-offset-white" data-notification-toggle="${item.key}" ${item.enabled ? 'checked' : ''}>
                `;
                body.appendChild(row);
            });
        };

        const setLoading = (state) => {
            if (loadingState) loadingState.hidden = !state;
        };

        const simulateLoad = () => {
            setLoading(true);
            emptyState.hidden = true;
            errorArea.hidden = true;
            body.innerHTML = '';
            saveBtn.disabled = true;
            resetBtn.hidden = true;
            statusArea.textContent = '';

            setTimeout(() => {
                setLoading(false);
                const saved = loadPrefs();
                let itemsToRender = template;

                if (saved) {
                    itemsToRender = template.map(t => ({
                        ...t,
                        enabled: saved[t.key] !== undefined ? saved[t.key] : t.enabled
                    }));
                }
                renderRows(itemsToRender);
            }, 600);
        };

        // Event Delegation for Checkbox Changes
        notificationPanel.addEventListener('change', (e) => {
            if (e.target.matches('[data-notification-toggle]')) {
                saveBtn.disabled = false;
                resetBtn.hidden = false;
                statusArea.textContent = 'Unsaved changes...';
                statusArea.className = 'text-amber-600 text-xs font-bold mt-2 text-center';
            }
        });

        resetBtn.addEventListener('click', () => {
            renderRows(template);
            saveBtn.disabled = false;
            resetBtn.hidden = true;
            statusArea.textContent = 'Defaults restored (unsaved).';
            statusArea.className = 'text-amber-600 text-xs font-bold mt-2 text-center';
        });

        saveBtn.addEventListener('click', () => {
            saveBtn.disabled = true;
            saveLabel.hidden = true;
            saveSpinner.hidden = false;
            statusArea.textContent = '';
            errorArea.hidden = true;

            // Read current state directly from DOM
            const currentPrefs = {};
            body.querySelectorAll('[data-notification-toggle]').forEach(input => {
                currentPrefs[input.dataset.notificationToggle] = input.checked;
            });

            setTimeout(() => {
                saveSpinner.hidden = true;
                saveLabel.hidden = false;
                savePrefs(currentPrefs);
                statusArea.textContent = 'Preferences saved.';
                statusArea.className = 'text-emerald-600 text-xs font-bold mt-2 text-center';

                setTimeout(() => {
                    if (statusArea.textContent === 'Preferences saved.') {
                        statusArea.textContent = '';
                    }
                }, 3000);
            }, 800);
        });

        refreshBtn.addEventListener('click', simulateLoad);

        // Initial Load
        simulateLoad();
    }

    // --- 8. Composer Controller ---
    class ComposerController {
        constructor() {
            this.form = document.querySelector('[data-create-post-form]');
            if (!this.form) return;

            this.input = this.form.querySelector('[data-media-input]');
            this.previewContainer = this.form.querySelector('[data-media-preview]');
            this.dropzone = this.form.querySelector('[data-media-dropzone]');
            this.submitBtn = this.form.querySelector('[data-submit-post]');

            this.init();
        }

        init() {
            if (this.input) {
                this.input.addEventListener('change', () => this.handleFileSelect());
            }

            if (this.form) {
                this.form.addEventListener('submit', () => {
                    if (this.submitBtn) {
                        this.submitBtn.disabled = true;
                        this.submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Posting...';
                    }
                });
            }
        }

        handleFileSelect() {
            const files = Array.from(this.input.files);
            if (!files.length) {
                this.previewContainer.hidden = true;
                this.previewContainer.innerHTML = '';
                return;
            }

            this.previewContainer.hidden = false;
            this.previewContainer.innerHTML = '';

            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const isVideo = file.type.startsWith('video/');
                    const div = document.createElement('div');
                    div.className = 'relative aspect-square rounded-xl overflow-hidden border border-gray-100 bg-gray-50';

                    if (isVideo) {
                        div.innerHTML = `
                            <video src="${e.target.result}" class="w-full h-full object-cover"></video>
                            <div class="absolute inset-0 flex items-center justify-center bg-black/20">
                                <i class="fas fa-video text-white text-2xl drop-shadow-md"></i>
                            </div>
                        `;
                    } else {
                        div.innerHTML = `<img src="${e.target.result}" class="w-full h-full object-cover">`;
                    }

                    this.previewContainer.appendChild(div);
                };
                reader.readAsDataURL(file);
            });
        }
    }

    new ComposerController();

})();
</script>
@endpush
