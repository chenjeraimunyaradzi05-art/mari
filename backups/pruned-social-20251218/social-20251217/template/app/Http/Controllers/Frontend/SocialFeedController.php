<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Frontend\Social\Concerns\ManagesSocialProfiles;
use App\Models\SocialPost;
use App\Models\SocialProfile;
use App\Models\User;
use App\Services\RealTimeAnalyticsEngine;
use App\Services\Social\EntertainmentService;
use App\Services\Social\FeedGeneratorService;
use App\Services\Social\SocialInsightsService;
use App\Support\FeatureFlag;
use App\Support\SocialPostFormatter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\View\View;


final class SocialFeedController extends Controller
{
    use ManagesSocialProfiles;

    public function __construct(
        private readonly FeedGeneratorService $feedGenerator,
        private readonly SocialInsightsService $socialInsights,
        private readonly RealTimeAnalyticsEngine $analytics
    ) {
    }



    public function __invoke(Request $request): View|JsonResponse
    {
        FeatureFlag::ensure('social.feed.enabled');

        $user = $request->user();
        abort_unless($user, 401);

        $profile = $this->ensureProfile($user);

        $perPage = (int) min(max($request->integer('per_page', 6), 6), 30);
        $page = max(1, (int) $request->integer('page', 1));
        $activeTab = $this->resolveFeedTab($request->string('tab'));

        $posts = $this->feedGenerator
            ->generateFeed($profile, $page, $perPage, $activeTab);
        $cacheMeta = $this->feedGenerator->getLastCacheMeta();
        $editorialPins = $this->feedGenerator->getEditorialPins();
        $trendCounters = $this->feedGenerator->getTrendingTopics();
        $qualityInsights = $this->feedGenerator->calculateQualityBreakdown($posts->items());

        if (method_exists($posts, 'appends')) {
            $posts->appends($request->query());
        }

        $stories = $this->feedGenerator->getStories($profile);
        $suggestions = $this->buildSuggestions($profile, 6);
        $canPost = $this->userCanPost($user);
        $profileAvatar = $user ? SocialPostFormatter::resolveAvatarForUser($user) : asset('images/default-avatar.png');
        $composerLimits = [
            'maxMedia' => (int) config('social.feed.composer.max_media', 5),
            'maxFileSizeMb' => (int) config('social.feed.composer.max_file_size_mb', 12),
            'acceptedTypes' => (array) config('social.feed.composer.accepted_types', ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm']),
        ];

        $this->analytics->record('social.feed.viewed', [
            'source' => 'social_web',
            'properties' => [
                'tab' => $activeTab,
                'page' => $posts->currentPage(),
                'per_page' => $posts->perPage(),
                'posts_returned' => count($posts->items()),
                'cache_hit' => $cacheMeta['hit'] ?? false,
                'cache_ttl' => $cacheMeta['ttl'] ?? 0,
            ],
        ]);

        if ($request->expectsJson() || $request->wantsJson()) {
            $postsHtml = view('social.feed.partials.posts', [
                'posts' => $posts,
            ])->render();

            return response()->json([
                'posts' => $postsHtml,
                'has_more' => $posts->hasMorePages(),
                'next_page' => $posts->hasMorePages() ? $posts->currentPage() + 1 : null,
                'tab' => $activeTab,
                'tabs' => $this->availableTabs(),
                'cache' => $cacheMeta,
                'trend_counters' => $trendCounters,
                'editorial_pins' => $this->formatEditorialPins($editorialPins),
                'feed_quality' => $qualityInsights,
            ]);
        }

        return view('social.feed.index', [
            'posts' => $posts,
            'stories' => $stories,
            'suggestions' => $suggestions,
            'perPage' => $perPage,
            'canPost' => $canPost,
            'profileAvatar' => $profileAvatar,
            'composerLimits' => $composerLimits,
            'createPostRoute' => route('social.posts.store'),
            'feedTabs' => $this->availableTabs(),
            'activeTab' => $activeTab,
            'editorialPins' => $editorialPins,
            'trendCounters' => $trendCounters,
            'feedQuality' => $qualityInsights,
        ]);
    }

    private function resolveFeedTab(?string $raw): string
    {
        $normalized = strtolower((string) $raw);
        return array_key_exists($normalized, $this->availableTabs()) ? $normalized : 'for_you';
    }

    /**
     * @return string[]
     *
     * @psalm-return array{for_you: 'For You', following: 'Following'}
     */
    private function availableTabs(): array
    {
        return [
            'for_you' => 'For You',
            'following' => 'Following',
        ];
    }

    /**
     * @return (float|int|mixed|null|string|string[])[][]
     *
     * @psalm-return array<int, array{id: mixed, post_type: null|string, published_at: string, ai_score: float, likes_count: int, excerpt: string, tags: array<int, string>, profile: array{username: string, display_name: string, avatar_url: string}|null}>
     */
    private function formatEditorialPins(Collection $pins): array
    {
        return $pins
            ->take(6)
            ->map(function (SocialPost $pin) {
                $profile = $pin->profile;

                return [
                    'id' => $pin->getKey(),
                    'post_type' => $pin->post_type,
                    'published_at' => optional($pin->published_at)->toIso8601String(),
                    'ai_score' => $pin->ai_engagement_score,
                    'likes_count' => (int) ($pin->likes_count ?? 0),
                    'excerpt' => Str::limit(strip_tags((string) ($pin->caption ?? $pin->content ?? '')), 200),
                    'tags' => collect($pin->tags ?? [])
                        ->take(3)
                        ->map(fn ($tag) => Str::start($tag, '#'))
                        ->values()
                        ->all(),
                    'profile' => $profile ? [
                        'username' => $profile->username,
                        'display_name' => $profile->display_name,
                        'avatar_url' => $profile->avatar_url,
                    ] : null,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * Build structured suggestion items from the SocialInsights provider.
     *
     * @param SocialProfile $profile
     * @param int $limit
     * @param bool $fallback  Whether to return mock suggestions when no candidate profiles are found.
     */
    private function buildSuggestions(SocialProfile $profile, int $limit = 6, bool $fallback = true): Collection
    {
        $user = $profile->user;

        if (! $user) {
            return collect();
        }

        $followingIds = $profile->following()
            ->pluck('following_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->all();

        $recommendations = $this->socialInsights
            ->suggestedConnections($user, $limit)
            ->take($limit)
            ->values();

        $userIds = $recommendations
            ->pluck('id')
            ->filter()
            ->unique()
            ->all();

        if (empty($userIds)) {
            // If caller does not want fallback suggestions, return empty set
            if (! $fallback) {
                return collect();
            }

            // Fallback to mock suggestions if no real recommendations found and fallback enabled
            return $this->getMockSuggestions($limit);
        }

        $profiles = SocialProfile::query()
            ->whereIn('user_id', $userIds)
            ->with('profileable')
            ->get()
            ->keyBy('user_id');

        return $recommendations
            ->map(function (array $candidate) use ($profiles, $followingIds) {
                $profile = $profiles->get($candidate['id'] ?? null);

                if (! $profile) {
                    return null;
                }

                return [
                    'display_name' => $profile->display_name ?? $profile->username,
                    'username' => $profile->username,
                    'avatar_url' => $profile->avatar_url ?: asset('images/default-avatar.png'),
                    'headline' => $profile->headline ?? $profile->title ?? 'Active Member',
                    'reason' => $candidate['reason'] ?? null,
                    'profile_url' => route('social.profiles.show', $profile->username),
                    'is_following' => in_array((int) $profile->id, $followingIds, true),
                ];
            })
            ->filter()
            ->values();
    }

    /**
     * @psalm-return Collection<int<0, 3>, array{display_name: string, username: string, avatar_url: string, headline: string, reason: string, profile_url: '#', is_following: false}>
     */
    private function getMockSuggestions(int $limit = 3): Collection
    {
        $mocks = [
            [
                'display_name' => 'Sarah Jenkins',
                'username' => 'sarah.j',
                'avatar_url' => 'https://i.pravatar.cc/150?u=sarah',
                'headline' => 'Product Designer at TechFlow',
                'reason' => 'Shared interest in UX Design',
                'profile_url' => '#',
                'is_following' => false,
            ],
            [
                'display_name' => 'Dr. Emily Chen',
                'username' => 'emily.chen',
                'avatar_url' => 'https://i.pravatar.cc/150?u=emily',
                'headline' => 'AI Research Scientist',
                'reason' => 'Alumni of University of Sydney',
                'profile_url' => '#',
                'is_following' => false,
            ],
            [
                'display_name' => 'Jessica Williams',
                'username' => 'jess.w',
                'avatar_url' => 'https://i.pravatar.cc/150?u=jessica',
                'headline' => 'Marketing Director',
                'reason' => 'Mutual connection with Alex',
                'profile_url' => '#',
                'is_following' => false,
            ],
             [
                'display_name' => 'Priya Patel',
                'username' => 'priya.p',
                'avatar_url' => 'https://i.pravatar.cc/150?u=priya',
                'headline' => 'Founder & CEO',
                'reason' => 'Trending in your industry',
                'profile_url' => '#',
                'is_following' => false,
            ],
        ];

        return collect($mocks)->take($limit);
    }

    private function userCanPost(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        if ($user->company) {
            return $user->company->canPublishToSocialFeed();
        }

        return (bool) $user->candidate;
    }

    public function explore(Request $request): View
    {
        FeatureFlag::ensure('social.feed.enabled');

        $user = $request->user();
        abort_unless($user, 401);

        $trendingPosts = $this->feedGenerator->getTrendingPosts(24);
        $trendCounters = $this->feedGenerator->getTrendingTopics();
        $currentProfile = $this->ensureProfile($user);

        $suggestions = $this->socialInsights->suggestedConnections($user, 8)
            ->map(function (array $candidate) use ($user, $currentProfile) {
                $profile = SocialProfile::query()->where('user_id', $candidate['id'] ?? null)->first();

                if (! $profile) {
                    return null;
                }

                return [
                    'display_name' => $profile->display_name ?? $profile->username,
                    'username' => $profile->username,
                    'avatar_url' => $profile->avatar_url ?: asset('images/default-avatar.png'),
                    'headline' => $profile->headline ?? 'Active Member',
                    'reason' => $candidate['reason'] ?? null,
                    'profile_url' => route('social.profiles.show', $profile->username),
                    'is_following' => $currentProfile ? $currentProfile->isFollowing($profile) : false,
                ];
            })
            ->filter()
            ->values();

        return view('social.feed.explore', [
            'trendingPosts' => $trendingPosts,
            'trendCounters' => $trendCounters,
            'suggestions' => $suggestions,
        ]);
    }

    public function recommendations(Request $request): JsonResponse
    {
        FeatureFlag::ensure('social.feed.enabled');

        $user = $request->user();
        abort_unless($user, 401);

        $requested = (int) $request->integer('limit', 6);
        $limit = max(1, min(20, $requested));

        $raw = $this->socialInsights->suggestedConnections($user, $limit);

        // resolve profiles for the returned user ids
        $ids = $raw->pluck('id')->filter()->map(fn ($v) => (int) $v)->unique()->all();
        $profiles = SocialProfile::query()->whereIn('user_id', $ids)->get()->keyBy('user_id');

        $data = $raw->map(function (array $item) use ($profiles) {
            $profile = $profiles->get($item['id'] ?? null);
            if (! $profile) {
                return null;
            }

            return [
                'username' => $profile->username,
                'display_name' => $profile->display_name ?? $profile->username,
                'avatar_url' => $profile->avatar_url ?: asset('images/default-avatar.png'),
                'headline' => $profile->headline ?? 'Active Member',
                'reason' => $item['reason'] ?? null,
                'profile_url' => route('social.profiles.show', $profile->username),
            ];
        })->filter()->values()->take($limit);

        return response()->json([
            'data' => $data->values(),
            'meta' => [
                'count' => $data->count(),
                'limit' => $limit,
            ],
        ]);
    }

    public function search(Request $request): View|RedirectResponse
    {
        FeatureFlag::ensure('social.feed.enabled');

        $user = $request->user();
        if (! $user) {
            return redirect()->route('login');
        }

        $query = trim((string) $request->string('q')->value());

        if ($query === '') {
            return view('social.feed.search', [
                'query' => '',
                'profiles' => collect(),
                'posts' => collect(),
            ]);
        }

        $term = '%'.$query.'%';

        $profiles = SocialProfile::query()
            ->where(function ($q) use ($term) {
                $q->where('username', 'like', $term)
                    ->orWhere('display_name', 'like', $term)
                    ->orWhere('bio', 'like', $term);
            })
            ->get();

        $posts = SocialPost::query()
            ->visible()
            ->where('moderation_status', 'approved')
            ->where(function ($q) use ($term) {
                $q->where('caption', 'like', $term)->orWhere('content', 'like', $term);
            })
            ->get();

        return view('social.feed.search', [
            'query' => $query,
            'profiles' => $profiles,
            'posts' => $posts,
        ]);
    }
}

