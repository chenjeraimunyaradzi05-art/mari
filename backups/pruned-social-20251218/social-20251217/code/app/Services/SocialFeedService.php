<?php

namespace App\Services;

use App\Contracts\Social\FeedRanker;
use App\Models\SocialFollow;
use App\Models\SocialPost;
use App\Models\SocialPostImpression;
use App\Models\SocialProfile;
use App\Models\User;
use App\Services\Social\SocialPrivacyService;
use App\Support\FeatureFlag;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class SocialFeedService
{
    private FeedRanker $feedRanker;

    private SocialPrivacyService $privacy;

    public function __construct(?FeedRanker $feedRanker = null, ?SocialPrivacyService $privacy = null)
    {
        $this->feedRanker = $feedRanker ?? app(FeedRanker::class);
        $this->privacy = $privacy ?? app(SocialPrivacyService::class);
    }


    public function generateFeed(User $user, array $options = []): Collection
    {
        $page = (int) ($options['page'] ?? 1);
        $perPage = (int) ($options['per_page'] ?? 20);
        $perPage = max(1, min(50, $perPage));
        $rawFilter = $options['filter'] ?? 'all';
        $filter = $rawFilter === 'latest' ? 'all' : $rawFilter;

        if (in_array($rawFilter, ['public', 'private', 'media'], true)) {
            return $this->generateSpecializedFeed($user, $rawFilter, $page, $perPage, $options);
        }

        $followProfileIds = $this->getFollowedProfileIds($user);
        $followUserIds = $this->getUserIdsForProfiles($followProfileIds);

        $followingPosts = collect();
        $discoveryPosts = collect();
        $trendingPosts = collect();
        $sponsoredPosts = collect();

        if ($this->shouldIncludeBucket($filter, 'following')) {
            $followingPosts = $this->queryFollowingPosts($followProfileIds, $followUserIds, $options);
        }

        if ($this->shouldIncludeBucket($filter, 'discovery')) {
            $discoveryPosts = $this->queryDiscoveryPosts($user, $followProfileIds, $followUserIds, $options, $followingPosts->pluck('id'));
        }

        if ($this->shouldIncludeBucket($filter, 'trending')) {
            $trendingPosts = $this->queryTrendingPosts(
                $user,
                $followProfileIds,
                $followUserIds,
                $options,
                $followingPosts->pluck('id')->merge($discoveryPosts->pluck('id'))
            );
        }

        if ($this->shouldIncludeBucket($filter, 'sponsored')) {
            $exclude = $followingPosts->pluck('id')
                ->merge($discoveryPosts->pluck('id'))
                ->merge($trendingPosts->pluck('id'));

            $sponsoredPosts = $this->querySponsoredPosts($user, $exclude, $options);
        }

        $buckets = collect([
            'following' => $this->restrictByPrivacy($user, $followingPosts),
            'discovery' => $this->restrictByPrivacy($user, $discoveryPosts),
            'trending' => $this->restrictByPrivacy($user, $trendingPosts),
            'sponsored' => $this->restrictByPrivacy($user, $sponsoredPosts),
        ])->filter(fn (Collection $collection) => $collection->isNotEmpty());

        if ($buckets->isEmpty()) {
            return collect();
        }

        $candidates = $this->prepareCandidates($buckets);
        if ($candidates->isEmpty()) {
            return collect();
        }

    $ranked = $this->feedRanker->rank($user, $candidates, ['limit' => 120]);

        return $ranked->forPage($page, $perPage)->values();
    }

    public function recordImpression(SocialPost $post, ?User $user = null, string $source = 'feed', array $meta = []): SocialPostImpression
    {
        return SocialPostImpression::create([
            'social_post_id' => $post->id,
            'user_id' => $user?->id,
            'source' => $source,
            'meta' => $meta,
            'viewed_at' => Carbon::now(),
        ]);
    }

    protected function getFollowedProfileIds(User $user): array
    {
        $profileId = $user->socialProfile?->id;

        if (! $profileId) {
            return [];
        }

        return SocialFollow::query()
            ->where('follower_id', $profileId)
            ->pluck('following_id')
            ->all();
    }

    /**
     * @return (int|null)[]
     *
     * @psalm-return array<int, int|null>
     */
    protected function getUserIdsForProfiles(array $profileIds): array
    {
        if (empty($profileIds)) {
            return [];
        }

        return SocialProfile::query()
            ->whereIn('id', $profileIds)
            ->get()
            ->map(fn (SocialProfile $profile) => $profile->resolveOwnerUser()?->id)
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @psalm-return Collection<int, mixed>|Collection<never, never>
     */
    protected function generateSpecializedFeed(User $user, string $filter, int $page, int $perPage, array $options = []): Collection
    {
        $followProfileIds = $this->getFollowedProfileIds($user);
        $followUserIds = $this->getUserIdsForProfiles($followProfileIds);

        $posts = match ($filter) {
            'public' => $this->restrictByPrivacy($user, $this->queryPublicPosts($options)),
            'private' => $this->restrictByPrivacy($user, $this->queryPrivatePosts($user, $followProfileIds, $followUserIds, $options)),
            'media' => $this->restrictByPrivacy($user, $this->queryMediaPosts($user, $followProfileIds, $followUserIds, $options)),
            default => collect(),
        };

        if ($posts->isEmpty()) {
            return collect();
        }

    $buckets = collect([$filter => $posts]);
    $candidates = $this->prepareCandidates($buckets);
        if ($candidates->isEmpty()) {
            return collect();
        }

        $ranked = $this->feedRanker->rank($user, $candidates, ['limit' => 120]);

        return $ranked->forPage($page, $perPage)->values();
    }

    protected function queryPublicPosts(array $options = []): Collection
    {
        $query = SocialPost::query()
            ->visible()
            ->public()
            ->with(['media', 'user', 'profile'])
            ->withCount(['reactions', 'comments', 'impressions'])
            ->latest('published_at');

        if (! empty($options['type'])) {
            $query->where('type', $options['type']);
        }

        return $query->limit(120)->get();
    }

    protected function queryPrivatePosts(User $user, array $followProfileIds, array $followUserIds, array $options = []): Collection
    {
        $profileScopes = array_filter(array_merge([$user->socialProfile?->id], $followProfileIds));
        $userScopes = array_filter(array_merge([$user->id], $followUserIds));

        $query = SocialPost::query()
            ->visible()
            ->whereIn('visibility', ['private', 'connections'])
            ->with(['media', 'user', 'profile'])
            ->withCount(['reactions', 'comments', 'impressions'])
            ->latest('published_at');

        if (! empty($profileScopes) || ! empty($userScopes)) {
            $query->where(function ($builder) use ($profileScopes, $userScopes) {
                $applied = false;

                if (! empty($profileScopes)) {
                    $builder->whereIn('social_profile_id', $profileScopes);
                    $applied = true;
                }

                if (! empty($userScopes)) {
                    $method = $applied ? 'orWhereIn' : 'whereIn';
                    $builder->{$method}('user_id', $userScopes);
                }
            });
        } else {
            $query->where('user_id', $user->id);
        }

        if (! empty($options['type'])) {
            $query->where('type', $options['type']);
        }

        return $query->limit(120)->get();
    }

    /**
     * @psalm-return Collection<int, mixed>
     */
    protected function queryMediaPosts(User $user, array $followProfileIds, array $followUserIds, array $options = []): Collection
    {
        $public = $this->queryPublicPosts($options);
        $restricted = $this->queryPrivatePosts($user, $followProfileIds, $followUserIds, $options);

        return $public
            ->merge($restricted)
            ->filter(fn (SocialPost $post) => $this->postHasMedia($post))
            ->unique('id')
            ->sortByDesc(function (SocialPost $post) {
                return $post->published_at ?? $post->created_at ?? Carbon::now();
            })
            ->values()
            ->take(120);
    }

    protected function postHasMedia(SocialPost $post): bool
    {
        if ($post->relationLoaded('media') && $post->media->isNotEmpty()) {
            return true;
        }

        $mediaAttribute = $post->getAttribute('media');

        if (is_array($mediaAttribute) && ! empty($mediaAttribute)) {
            return true;
        }

        if (is_string($mediaAttribute) && trim($mediaAttribute, "[] \t\n\r\0\x0B") !== '') {
            return true;
        }

        return $post->relationLoaded('media') ? $post->media->isNotEmpty() : $post->media()->exists();
    }

    protected function queryFollowingPosts(array $followProfileIds, array $followUserIds, array $options = []): Collection
    {
        if (empty($followProfileIds) && empty($followUserIds)) {
            return collect();
        }

        $query = SocialPost::query()
            ->visible()
            ->public()
            ->where(function ($builder) use ($followProfileIds, $followUserIds) {
                if (! empty($followProfileIds)) {
                    $builder->whereIn('social_profile_id', $followProfileIds);

                    if (! empty($followUserIds)) {
                        $builder->orWhereIn('user_id', $followUserIds);
                    }

                    return;
                }

                if (! empty($followUserIds)) {
                    $builder->whereIn('user_id', $followUserIds);
                }
            })
            ->with(['media', 'user', 'profile'])
            ->withCount(['reactions', 'comments', 'impressions'])
            ->latest('published_at');

        if (! empty($options['type'])) {
            $query->where('type', $options['type']);
        }

        return $query->limit(80)->get();
    }

    protected function queryDiscoveryPosts(User $user, array $followProfileIds, array $followUserIds, array $options = [], Collection $excludeIds = null): Collection
    {
        if (! FeatureFlag::enabled('social.feed.discovery')) {
            return collect();
        }

        $exclude = $excludeIds?->all() ?? [];
        $profileExclusions = array_filter(array_merge($followProfileIds, [$user->socialProfile?->id]));
        $userExclusions = array_unique(array_filter(array_merge($followUserIds, [$user->id])));

        $query = SocialPost::query()
            ->visible()
            ->public()
            ->when(! empty($profileExclusions), fn ($builder) => $builder->whereNotIn('social_profile_id', $profileExclusions))
            ->when(! empty($userExclusions), fn ($builder) => $builder->whereNotIn('user_id', $userExclusions))
            ->whereNotIn('id', $exclude)
            ->with(['media', 'user', 'profile'])
            ->withCount(['reactions', 'comments', 'impressions'])
            ->orderByDesc('reactions_count')
            ->orderByDesc('comments_count')
            ->orderByDesc('published_at');

        if (! empty($options['type'])) {
            $query->where('type', $options['type']);
        }

        return $query->limit(60)->get();
    }

    protected function queryTrendingPosts(User $user, array $followProfileIds, array $followUserIds, array $options = [], Collection $excludeIds = null): Collection
    {
        if (! FeatureFlag::enabled('social.feed.trending')) {
            return collect();
        }

        $exclude = $excludeIds?->all() ?? [];
        $profileExclusions = array_filter(array_merge($followProfileIds, [$user->socialProfile?->id]));
        $userExclusions = array_unique(array_filter(array_merge($followUserIds, [$user->id])));

        $query = SocialPost::query()
            ->visible()
            ->public()
            ->when(! empty($profileExclusions), fn ($builder) => $builder->whereNotIn('social_profile_id', $profileExclusions))
            ->when(! empty($userExclusions), fn ($builder) => $builder->whereNotIn('user_id', $userExclusions))
            ->whereNotIn('id', $exclude)
            ->with(['media', 'user', 'profile'])
            ->withCount(['reactions', 'comments', 'impressions'])
            ->orderByDesc(DB::raw('(COALESCE(reactions_count,0) * 4) + (COALESCE(comments_count,0) * 6) + (COALESCE(impressions_count,0) * 0.5)'))
            ->latest('published_at');

        if (! empty($options['type'])) {
            $query->where('type', $options['type']);
        }

        return $query->limit(40)->get();
    }

    protected function querySponsoredPosts(User $user, Collection $excludeIds, array $options = []): Collection
    {
        if (! FeatureFlag::enabled('social.feed.sponsored')) {
            return collect();
        }

        $query = SocialPost::query()
            ->visible()
            ->public()
            ->where('is_sponsored', true)
            ->whereNotIn('id', $excludeIds)
            ->with(['media', 'user', 'profile'])
            ->withCount(['reactions', 'comments', 'impressions'])
            ->latest('published_at');

        if (! empty($options['type'])) {
            $query->where('type', $options['type']);
        }

        return $query->limit(10)->get();
    }

    /**
     * @psalm-return Collection<int, array{post: SocialPost, source: string}>
     */
    protected function prepareCandidates(Collection $buckets): Collection
    {
        return $buckets->flatMap(function (Collection $posts, string $bucket) {
            return $posts->map(fn (SocialPost $post) => [
                'post' => $post,
                'source' => $bucket,
            ]);
        })->values();
    }

    protected function shouldIncludeBucket(string $filter, string $bucket): bool
    {
        $flagMap = [
            'following' => 'social.feed.following',
            'discovery' => 'social.feed.discovery',
            'trending' => 'social.feed.trending',
            'sponsored' => 'social.feed.sponsored',
        ];

        if (isset($flagMap[$bucket]) && ! FeatureFlag::enabled($flagMap[$bucket])) {
            return false;
        }

        if ($filter === 'all') {
            return true;
        }

        return $filter === $bucket;
    }

    protected function restrictByPrivacy(User $user, Collection $posts): Collection
    {
        return $this->privacy->filterVisiblePosts($posts, $user);
    }
}

