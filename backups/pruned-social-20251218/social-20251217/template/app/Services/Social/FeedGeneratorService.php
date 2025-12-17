<?php

namespace App\Services\Social;

use App\Models\SocialPost;
use App\Models\SocialProfile;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class FeedGeneratorService
{
    /**
     * Capture cache metadata for analytics hooks.
     */
    private array $lastCacheMeta = [
        'hit' => false,
        'key' => null,
        'ttl' => 0,
        'scope' => 'for_you',
    ];

    public function generateFeed(
        SocialProfile $profile,
        int $page = 1,
        int $perPage = 20,
        string $scope = 'for_you',
        array $options = []
    ): LengthAwarePaginator {
        $scope = $this->normalizeScope($scope);
        $page = max(1, $page);
        $perPage = max(6, min(50, $perPage));
        $cacheTtl = max(0, (int) config('social.feed.personalized_cache_ttl', 60));
        $cacheKey = $this->buildCacheKey($profile, $scope, $page, $perPage, $options);
        $shouldCache = $cacheTtl > 0 && $scope === 'for_you';

        if ($shouldCache) {
            $cached = Cache::get($cacheKey);
            if ($cached instanceof LengthAwarePaginator) {
                $this->lastCacheMeta = [
                    'hit' => true,
                    'key' => $cacheKey,
                    'ttl' => $cacheTtl,
                    'scope' => $scope,
                ];

                return $cached;
            }
        }

        $query = $scope === 'following'
            ? $this->buildFollowingFeedQuery($profile)
            : $this->buildForYouFeedQuery($profile, $options);

        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        if ($shouldCache) {
            Cache::put($cacheKey, $paginator, $cacheTtl);
        }

        $this->lastCacheMeta = [
            'hit' => false,
            'key' => $cacheKey,
            'ttl' => $cacheTtl,
            'scope' => $scope,
        ];

        return $paginator;
    }

    /**
     * Return grouped story posts keyed by social_profile_id. Tests often mock this
     * and return a Support collection, so we accept Illuminate\Support\Collection
     * here to avoid type mismatches with mocks.
     *
     * @psalm-return \Illuminate\Support\Collection<array-key, \Illuminate\Support\Collection<int, SocialPost>>
     */
    public function getStories(SocialProfile $profile): Collection
    {
        $followingIds = $this->resolveFollowingIds($profile);

        return SocialPost::query()
            ->whereIn('social_profile_id', $followingIds)
            ->where('post_type', 'story')
            ->where('expires_at', '>', now())
            ->with(['profile', 'media'])
            ->orderByDesc('published_at')
            ->get()
            ->groupBy('social_profile_id');
    }

    public function getTrendingPosts(int $limit = 30): Collection
    {
        $resolvedLimit = $limit > 0
            ? $limit
            : (int) config('social.feed.trending_limit', 30);
        $ttl = (int) config('social.feed.trending_cache_ttl', 3600);
        $cacheKey = sprintf('social_trending_posts_%s_%d', now()->format('YmdH'), $resolvedLimit);

        return Cache::remember($cacheKey, $ttl, function () use ($resolvedLimit) {
            return SocialPost::query()
                ->visible()
                ->where('visibility', 'public')
                ->where('created_at', '>', now()->subDays(7))
                ->with($this->defaultRelations())
                ->orderByDesc('ai_engagement_score')
                ->orderByDesc('likes_count')
                ->limit($resolvedLimit)
                ->get();
        });
    }

    public function getEditorialPins(?int $limit = null): Collection
    {
        $limit = $limit ?? (int) config('social.feed.for_you.pinned_limit', 3);
        $limit = max(1, min(10, $limit));
        $ttl = (int) config('social.feed.for_you.pinned_cache_ttl', 300);
        $cacheKey = sprintf('social_feed_editorial_pins_%d', $limit);

        return Cache::remember($cacheKey, $ttl, function () use ($limit) {
            return SocialPost::query()
                ->visible()
                ->where('is_pinned', true)
                ->where('post_type', '!=', 'story')
                ->with($this->defaultRelations())
                ->latest('published_at')
                ->limit($limit)
                ->get();
        });
    }

    public function getTrendingTopics(int $limit = 6): array
    {
        $limit = max(3, min(12, $limit));
        $ttl = (int) config('social.feed.trending_topics.cache_ttl', 300);
        $windowHours = (int) config('social.feed.trending_topics.window_hours', 24);
        $cacheKey = sprintf('social_feed_trending_topics_%d', $limit);

        return Cache::remember($cacheKey, $ttl, function () use ($limit, $windowHours) {
            $now = Carbon::now();
            $recentStart = $now->copy()->subHours($windowHours);
            $previousStart = $now->copy()->subHours($windowHours * 2);

            $recentPosts = $this->fetchPostsForWindow($recentStart, null);
            $previousPosts = $this->fetchPostsForWindow($previousStart, $recentStart);

            $recentCounts = $this->aggregateTagCounts($recentPosts);
            $previousCounts = $this->aggregateTagCounts($previousPosts);

            return collect($recentCounts)
                ->map(function (int $count, string $tag) use ($previousCounts) {
                    $previous = $previousCounts[$tag] ?? 0;
                    $change = $count - $previous;
                    $direction = 'stable';
                    if ($change > 0) {
                        $direction = 'up';
                    } elseif ($change < 0) {
                        $direction = 'down';
                    }
                    $changePercent = $previous > 0
                        ? round(($change / max(1, $previous)) * 100, 1)
                        : null;

                    return [
                        'tag' => $tag,
                        'count' => $count,
                        'previous' => $previous,
                        'change' => $change,
                        'direction' => $direction,
                        'change_percent' => $changePercent,
                    ];
                })
                ->sortByDesc(fn ($item) => [$item['direction'] === 'up' ? 1 : 0, $item['count']])
                ->take($limit)
                ->values()
                ->all();
        });
    }

    /**
     * @return (((bool|float|int|mixed|null)[]|string)[]|int)[]
     *
     * @psalm-return array{total: int<0, max>, segments: array<array{count: int, ratio: float, goal: mixed|null, is_below_goal: bool}>, alerts: list<string>}
     */
    public function calculateQualityBreakdown(iterable $posts): array
    {
        $categories = $this->resolveQualityCategories();
        $goals = config('social.feed.quality_goals', $this->defaultQualityGoals());

        $counts = array_fill_keys(array_keys($categories), 0);
        $total = 0;

        foreach ($posts as $post) {
            if (! $post instanceof SocialPost) {
                continue;
            }

            $total++;
            $signals = $this->collectContentSignals($post);

            foreach ($categories as $key => $category) {
                if ($this->postMatchesCategory($signals, $category)) {
                    $counts[$key]++;
                }
            }
        }

        $segments = [];
        $alerts = [];

        foreach ($counts as $key => $count) {
            $ratio = $total > 0 ? round(($count / $total) * 100, 1) : 0.0;
            $goal = $goals[$key] ?? null;
            $isBelow = $goal !== null && $ratio < $goal;

            $segments[$key] = [
                'count' => $count,
                'ratio' => $ratio,
                'goal' => $goal,
                'is_below_goal' => $isBelow,
            ];

            if ($isBelow && $goal !== null) {
                $gap = $goal - $ratio;
                $alerts[] = $this->generateActionableAlert($key, $gap);
            }
        }

        return [
            'total' => $total,
            'segments' => $segments,
            'alerts' => array_slice($alerts, 0, 3),
        ];
    }

    private function generateActionableAlert(string $category, float $gap): string
    {
        return match ($category) {
            'candidates' => sprintf('Candidate signals are faint (%.1f%% gap). Amplify a member\'s story.', $gap),
            'employers' => sprintf('Opportunity flow needs a boost (%.1f%% gap). Drop a priority role.', $gap),
            'education' => sprintf('Growth signals are low (%.1f%% gap). Share a power-skill tip.', $gap),
            'mentorship' => sprintf('Guidance is scarce (%.1f%% gap). Offer a mentorship moment.', $gap),
            'news' => sprintf('Market intel is lagging (%.1f%% gap). Share a strategic update.', $gap),
            'success' => sprintf('Celebration energy is low (%.1f%% gap). Spotlight a win.', $gap),
            default => sprintf('Boost %s energy (%.1f%% gap) to rebalance the mix.', Str::headline($category), $gap),
        };
    }

    public function getLastCacheMeta(): array
    {
        return $this->lastCacheMeta;
    }

    private function buildForYouFeedQuery(SocialProfile $profile, array $options = []): Builder
    {
        $followingIds = $this->resolveFollowingIds($profile);
        $minScore = (float) config('social.feed.for_you.min_ai_score', 0.35);
        $editorialWindowHours = (int) config('social.feed.for_you.editorial_boost_hours', 72);

        return SocialPost::query()
            ->visible()
            ->where('post_type', '!=', 'story')
            ->where(function (Builder $builder) use ($followingIds, $minScore, $editorialWindowHours) {
                if (! empty($followingIds)) {
                    $builder->whereIn('social_profile_id', $followingIds);
                }

                $builder->orWhere(function (Builder $public) use ($minScore, $editorialWindowHours) {
                    $public->where('visibility', 'public')
                        ->where(function (Builder $quality) use ($minScore, $editorialWindowHours) {
                            $quality
                                ->where('ai_engagement_score', '>=', $minScore)
                                ->orWhere('is_pinned', true)
                                ->orWhere(function (Builder $sponsored) use ($editorialWindowHours) {
                                    $sponsored
                                        ->where('is_sponsored', true)
                                        ->where('published_at', '>=', now()->subHours($editorialWindowHours));
                                });
                        });
                });
            })
            ->with($this->defaultRelations())
            ->orderByDesc('is_pinned')
            ->when(! empty($followingIds), function (Builder $builder) use ($followingIds) {
                $idList = implode(',', array_map('intval', $followingIds));
                $builder->selectRaw("CASE WHEN social_profile_id IN ({$idList}) THEN 1 ELSE 0 END as follow_rank");
                $builder->orderByDesc('follow_rank');
            })
            ->orderByDesc('ai_engagement_score')
            ->orderByDesc('likes_count')
            ->orderByDesc('published_at');
    }

    private function buildFollowingFeedQuery(SocialProfile $profile): Builder
    {
        $followingIds = $this->resolveFollowingIds($profile);

        return SocialPost::query()
            ->whereIn('social_profile_id', $followingIds)
            ->where('post_type', '!=', 'story')
            ->visible()
            ->with($this->defaultRelations())
            ->orderByDesc('published_at');
    }

    /**
     * @return string[]
     *
     * @psalm-return list{'media', 'user', 'profile'}
     */
    private function defaultRelations(): array
    {
        return ['media', 'user', 'profile'];
    }

    private function fetchPostsForWindow(Carbon $start, ?Carbon $end = null, int $limit = 400): Collection
    {
        $limit = max(50, min(600, $limit));

        $query = SocialPost::query()
            ->visible()
            ->where('post_type', '!=', 'story')
            ->where('published_at', '>=', $start);

        if ($end) {
            $query->where('published_at', '<', $end);
        }

        return $query
            ->select(['id', 'tags', 'ai_tags', 'meta'])
            ->latest('published_at')
            ->limit($limit)
            ->get();
    }

    /**
     * @return int[]
     *
     * @psalm-return array<int>
     */
    private function aggregateTagCounts(Collection $posts): array
    {
        $counts = [];

        foreach ($posts as $post) {
            if (! $post instanceof SocialPost) {
                continue;
            }

            foreach ($this->extractTagsFromPost($post) as $tag) {
                $counts[$tag] = ($counts[$tag] ?? 0) + 1;
            }
        }

        arsort($counts);

        return $counts;
    }

    /**
     * @return (null|string)[]
     *
     * @psalm-return array<int, null|string>
     */
    private function extractTagsFromPost(SocialPost $post): array
    {
        $topics = data_get($post->meta, 'topics', []);
        $topics = is_array($topics) ? $topics : [];

        return collect([
            $post->tags,
            $post->ai_tags,
            $topics,
        ])
            ->flatten()
            ->map(fn ($tag) => $this->normalizeTag($tag))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    private function normalizeTag(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $normalized = Str::of($value)->lower()->trim();

        if ($normalized->isEmpty()) {
            return null;
        }

        $tag = (string) $normalized;

        return Str::startsWith($tag, '#') ? $tag : '#'.$tag;
    }

    /**
     * @return ((mixed|string)[]|string)[]
     *
     * @psalm-return array{caption: string, tags: array, topics: array<int, string>}
     */
    private function collectContentSignals(SocialPost $post): array
    {
        $caption = Str::of((string) ($post->caption ?? $post->content ?? ''))->lower()->value();
        $topics = data_get($post->meta, 'topics', []);
        $topics = is_array($topics) ? $topics : [];

        return [
            'caption' => $caption,
            'tags' => $this->extractTagsFromPost($post),
            'topics' => collect($topics)
                ->map(fn ($topic) => Str::of((string) $topic)->lower()->value())
                ->filter()
                ->values()
                ->all(),
        ];
    }

    private function postMatchesCategory(array $signals, array $category): bool
    {
        $keywords = $category['keywords'] ?? [];
        $tags = $category['tags'] ?? [];
        $topics = $category['topics'] ?? [];

        foreach ($tags as $tag) {
            $needle = '#'.ltrim(Str::lower($tag), '#');
            if (in_array($needle, $signals['tags'], true)) {
                return true;
            }
        }

        foreach ($topics as $topic) {
            $topicNeedle = Str::lower($topic);
            if ($topicNeedle !== '' && in_array($topicNeedle, $signals['topics'], true)) {
                return true;
            }
        }

        foreach ($keywords as $keyword) {
            $keyword = Str::lower($keyword);
            if ($keyword === '') {
                continue;
            }

            if (Str::contains($signals['caption'], $keyword)) {
                return true;
            }

            foreach ($signals['topics'] as $topic) {
                if (Str::contains($topic, $keyword)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * @return int[]
     *
     * @psalm-return array<int, int>
     */
    private function resolveFollowingIds(SocialProfile $profile): array
    {
        return $profile->following()
            ->pluck('following_id')
            ->push($profile->id)
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
    }

    private function resolveQualityCategories(): array
    {
        $categories = config('social.feed.quality_categories');

        if (! is_array($categories) || empty($categories)) {
            return $this->defaultQualityCategories();
        }

        return $categories;
    }

    /**
     * @return string[][][]
     *
     * @psalm-return array{candidates: array{keywords: list{'candidate', 'women', 'return', 'career change', 'student', 'apprentice'}, tags: list{'womenintech', 'womeninfinance', 'careerchange', 'returntowork'}, topics: list{'candidates', 'career_returners'}}, employers: array{keywords: list{'hire', 'role', 'opportunity', 'opening', 'employer', 'recruiting'}, tags: list{'jobs', 'hiring', 'opportunities'}, topics: list{'employers', 'hiring'}}, education: array{keywords: list{'course', 'learning', 'bootcamp', 'certified', 'study', 'tafe', 'rto', 'apprenticeship'}, tags: list{'learning', 'education', 'apprenticeships'}, topics: list{'education', 'apprenticeships'}}, mentorship: array{keywords: list{'mentor', 'mentorship', 'advice', 'coaching'}, tags: list{'mentorship', 'mentors'}, topics: list{'mentorship'}}, news: array{keywords: list{'report', 'trend', 'market', 'insight', 'policy'}, tags: list{'news', 'insights'}, topics: list{'policy', 'market_trends'}}, success: array{keywords: list{'promotion', 'raise', 'salary', 'celebrate', 'milestone'}, tags: list{'success', 'celebrate', 'wins'}, topics: list{'success_stories'}}}
     */
    private function defaultQualityCategories(): array
    {
        return [
            'candidates' => [
                'keywords' => ['candidate', 'women', 'return', 'career change', 'student', 'apprentice'],
                'tags' => ['womenintech', 'womeninfinance', 'careerchange', 'returntowork'],
                'topics' => ['candidates', 'career_returners'],
            ],
            'employers' => [
                'keywords' => ['hire', 'role', 'opportunity', 'opening', 'employer', 'recruiting'],
                'tags' => ['jobs', 'hiring', 'opportunities'],
                'topics' => ['employers', 'hiring'],
            ],
            'education' => [
                'keywords' => ['course', 'learning', 'bootcamp', 'certified', 'study', 'tafe', 'rto', 'apprenticeship'],
                'tags' => ['learning', 'education', 'apprenticeships'],
                'topics' => ['education', 'apprenticeships'],
            ],
            'mentorship' => [
                'keywords' => ['mentor', 'mentorship', 'advice', 'coaching'],
                'tags' => ['mentorship', 'mentors'],
                'topics' => ['mentorship'],
            ],
            'news' => [
                'keywords' => ['report', 'trend', 'market', 'insight', 'policy'],
                'tags' => ['news', 'insights'],
                'topics' => ['policy', 'market_trends'],
            ],
            'success' => [
                'keywords' => ['promotion', 'raise', 'salary', 'celebrate', 'milestone'],
                'tags' => ['success', 'celebrate', 'wins'],
                'topics' => ['success_stories'],
            ],
        ];
    }

    /**
     * @return int[]
     *
     * @psalm-return array{candidates: 20, employers: 25, success: 15, education: 20, mentorship: 10, news: 10}
     */
    private function defaultQualityGoals(): array
    {
        return [
            'candidates' => 20,
            'employers' => 25,
            'success' => 15,
            'education' => 20,
            'mentorship' => 10,
            'news' => 10,
        ];
    }

    private function buildCacheKey(
        SocialProfile $profile,
        string $scope,
        int $page,
        int $perPage,
        array $options = []
    ): string {
        $filters = array_filter(
            $options,
            fn ($value) => ! is_null($value) && $value !== ''
        );

        return sprintf(
            'social:feed:%d:%s:%s',
            $profile->getKey(),
            $scope,
            sha1(json_encode([
                'page' => $page,
                'per_page' => $perPage,
                'filters' => $filters,
            ]))
        );
    }

    private function normalizeScope(string $scope): string
    {
        return in_array($scope, ['for_you', 'following'], true) ? $scope : 'for_you';
    }
}

