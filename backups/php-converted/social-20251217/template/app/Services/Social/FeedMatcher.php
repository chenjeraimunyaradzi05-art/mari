<?php

namespace App\Services\Social;

use App\Models\Candidate;
use App\Models\Company;
use App\Models\JobCategory;
use App\Models\SocialPost;
use App\Models\User;
use Illuminate\Contracts\Cache\Repository as CacheRepository;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

final class FeedMatcher
{
    protected array $defaultWeights = [
        'recency_base' => 80.0,
        'recency_half_life' => 12.0,
        'minimum_floor' => 5.0,
        'sector_match' => 40.0,
        'skill_match' => 12.0,
        'skill_max' => 60.0,
        'tag_match' => 6.0,
        'tag_max' => 30.0,
        'cross_role_bonus' => 12.0,
        'engagement_like' => 2.0,
        'engagement_comment' => 4.0,
        'engagement_cap' => 40.0,
    ];

    protected array $lastWeights = [];

    protected array $lastProfile = [];

    protected bool $lastCallUsedCache = false;

    /**
     * Build a personalized feed for the given user.
     */
    public function forUser(User $user, int $limit = 25, array $options = []): Collection
    {
        $limit = max(1, min(100, $limit));

        $weights = $this->resolveWeights($options['weights'] ?? []);
        $profile = $this->buildFingerprint($user, $options['focus'] ?? []);

        $this->lastWeights = $weights;
        $this->lastProfile = [
            'type' => $profile['type'],
            'sectors' => $profile['sectors']->values()->all(),
            'skills' => $profile['skills']->values()->all(),
            'keywords' => $profile['keywords']->values()->all(),
        ];

        $includeSelf = array_key_exists('include_self', $options) ? (bool) $options['include_self'] : true;
        $fetchLimit = min(500, max($limit * 4, 80));

        return $this->rememberFeed($user, $limit, $options, $weights, $profile, $includeSelf, $fetchLimit);
    }

    public function lastCallUsedCache(): bool
    {
        return $this->lastCallUsedCache;
    }

    protected function rememberFeed(
        User $user,
        int $limit,
        array $options,
        array $weights,
        array $profile,
        bool $includeSelf,
        int $fetchLimit
    ): Collection {
        $cacheKey = $this->cacheKey($user, $limit, $options, $profile);
        $cached = $this->cache->get($cacheKey);

        if ($cached instanceof Collection) {
            $this->lastCallUsedCache = true;
            return $cached;
        }

        $this->lastCallUsedCache = false;
        $feed = $this->buildFeed($user, $limit, $weights, $profile, $includeSelf, $fetchLimit);

        $this->cache->put($cacheKey, $feed, $this->cacheTtl());

        return $feed;
    }

    protected function buildFeed(
        User $user,
        int $limit,
        array $weights,
        array $profile,
        bool $includeSelf,
        int $fetchLimit
    ): Collection {
        $posts = SocialPost::with(['user.candidate', 'user.company', 'profile.profileable'])
            ->withCount(['likes', 'comments'])
            ->visible()
            ->where('visibility', 'public')
            ->when(! $includeSelf, fn ($query) => $query->where('user_id', '!=', $user->id))
            ->whereHas('user')
            ->latest('published_at')
            ->limit($fetchLimit)
            ->get()
            ->filter(fn (SocialPost $post) => $post->user !== null);

        $now = now();

        return $posts->map(function (SocialPost $post) use ($profile, $weights, $now) {
            $score = 0.0;
            $reasons = [];

            $hours = max(0, ($post->published_at ?? $post->created_at)?->diffInHours($now) ?? 0);
            $recencyScore = $this->scoreRecency($hours, $weights);
            if ($recencyScore > 0) {
                $score += $recencyScore;
                $reasons[] = 'Fresh story';
            }

            $meta = $post->meta ?? [];
            $sector = Str::lower((string) Arr::get($meta, 'audience.sector'));
            if ($sector !== '') {
                if ($profile['sectors']->contains($sector)) {
                    $score += $weights['sector_match'];
                    $reasons[] = 'Matched your focus area';
                }
            }

            $postSkills = collect(Arr::get($meta, 'audience.skills', []))
                ->map(fn ($skill) => Str::lower((string) $skill))
                ->filter();
            $skillOverlap = $postSkills->intersect($profile['skills']);

            if ($skillOverlap->isNotEmpty()) {
                $skillScore = min($weights['skill_max'], $skillOverlap->count() * $weights['skill_match']);
                $score += $skillScore;
                $reasons[] = 'Skill match: '.implode(', ', $skillOverlap->take(3)->map(fn ($s) => Str::title($s))->all());
            }

            $tagsSource = is_array($post->tags) ? $post->tags : explode(',', (string) $post->tags);
            $tags = collect($tagsSource)
                ->map(fn ($tag) => Str::of($tag)->trim()->lower()->ltrim('#')->value())
                ->filter();
            $tagOverlap = $tags->intersect($profile['keywords']);
            if ($tagOverlap->isNotEmpty()) {
                $tagScore = min($weights['tag_max'], $tagOverlap->count() * $weights['tag_match']);
                $score += $tagScore;
                $reasons[] = 'Shared interests: '.implode(', ', $tagOverlap->take(3)->map(fn ($t) => '#'.$t)->all());
            }

            $engagementScore = $this->scoreEngagement($post, $weights);
            if ($engagementScore > 0) {
                $score += $engagementScore;
                $reasons[] = 'Community engagement';
            }

            $authorType = $post->profile?->profile_type ?? ($post->user?->company ? 'company' : 'candidate');
            if ($authorType === 'company' && $profile['type'] === 'candidate') {
                $score += $weights['cross_role_bonus'];
                $reasons[] = 'Employer perspective';
            } elseif ($authorType === 'candidate' && $profile['type'] === 'company') {
                $score += $weights['cross_role_bonus'];
                $reasons[] = 'Candidate spotlight';
            }

            $score = max($weights['minimum_floor'], $score);

            $post->setAttribute('match_score', round($score, 2));
            $post->setAttribute('match_reasons', array_values(array_unique($reasons)));

            return $post;
        })->sortByDesc(fn (SocialPost $post) => $post->getAttribute('match_score'))->take($limit)->values();
    }

    protected function cacheKey(User $user, int $limit, array $options, array $profile): string
    {
        $hashPayload = [
            'limit' => $limit,
            'profile' => [
                'type' => $profile['type'],
                'sectors' => $profile['sectors']->values()->all(),
                'skills' => $profile['skills']->values()->all(),
                'keywords' => $profile['keywords']->values()->all(),
            ],
            'options' => [
                'focus' => $options['focus'] ?? [],
                'weights' => $options['weights'] ?? [],
                'include_self' => array_key_exists('include_self', $options) ? (bool) $options['include_self'] : true,
            ],
        ];

        return sprintf('social:feed:%d:%s', $user->id, md5(json_encode($hashPayload)));
    }

    /**
     * @psalm-return int<5, max>
     */
    protected function cacheTtl(): int
    {
        return max(5, (int) config('social.feed.personalized_cache_ttl', 60));
    }

    public function getLastWeights(): array
    {
        return $this->lastWeights;
    }

    public function getLastProfile(): array
    {
        return $this->lastProfile;
    }

    protected function resolveWeights(array $overrides): array
    {
        $weights = $this->defaultWeights;

        foreach ($overrides as $key => $value) {
            if (array_key_exists($key, $weights) && is_numeric($value)) {
                $weights[$key] = (float) $value;
            }
        }

        return $weights;
    }

    /**
     * @return (Collection|string)[]
     *
     * @psalm-return array{type: 'candidate'|'company', sectors: Collection<int, never>, skills: Collection<int, never>, keywords: Collection<int, never>}
     */
    private function buildFingerprint(User $user, array $overrides = []): array
    {
        $candidate = $user->relationLoaded('candidate')
            ? $user->candidate
            : $user->candidate()->with(['skills', 'profession'])->first();

        $company = $user->relationLoaded('company')
            ? $user->company
            : $user->company()->with('industryType')->first();

        $sectors = collect();
        $skills = collect();
        $keywords = collect();

        if ($candidate instanceof Candidate) {
            if ($candidate->profession) {
                $sectors->push(Str::lower($candidate->profession->name));
            }

            if ($candidate->job_category_id) {
                $category = JobCategory::find($candidate->job_category_id);
                if ($category) {
                    $sectors->push(Str::lower($category->name));
                }
            }

            foreach ($candidate->skills as $skill) {
                $normalized = Str::lower($skill->name);
                $skills->push($normalized);
            }

            $keywords = $keywords->merge($skills);
        }

        if ($company instanceof Company) {
            if ($company->industryType) {
                $sectors->push(Str::lower($company->industryType->name));
            }

            $keywords->push(Str::lower($company->name));
        }

        if (! empty($overrides['sectors']) && is_array($overrides['sectors'])) {
            $sectors = $sectors->merge($this->normalizeValues($overrides['sectors']));
        }

        if (! empty($overrides['skills']) && is_array($overrides['skills'])) {
            $skillOverrides = $this->normalizeValues($overrides['skills']);
            $skills = $skills->merge($skillOverrides);
            $keywords = $keywords->merge($skillOverrides);
        }

        if (! empty($overrides['keywords']) && is_array($overrides['keywords'])) {
            $keywords = $keywords->merge($this->normalizeValues($overrides['keywords']));
        }

        $sectors = $sectors->filter()->unique()->values();
        $skills = $skills->filter()->unique()->values();
        $keywords = $keywords->filter()->unique()->values();

        $type = $company ? 'company' : 'candidate';

        return [
            'type' => $type,
            'sectors' => $sectors,
            'skills' => $skills,
            'keywords' => $keywords,
        ];
    }

    /**
     * @psalm-return Collection<array-key, string>
     */
    private function normalizeValues(array $values): Collection
    {
        return collect($values)
            ->map(fn ($value) => Str::of($value)->trim()->lower()->value())
            ->filter();
    }

    private function scoreRecency(int $hours, array $weights): float
    {
        $base = $weights['recency_base'];
        $halfLife = max(1.0, (float) $weights['recency_half_life']);

        $decay = pow(0.5, $hours / $halfLife);
        $score = $base * $decay;

        return max($weights['minimum_floor'], $score);
    }

    private function scoreEngagement(SocialPost $post, array $weights): float
    {
    $likes = $post->likes_count ?? $post->likes()->count();
    $comments = $post->comments_count ?? $post->comments()->count();

        $score = ($likes * $weights['engagement_like']) + ($comments * $weights['engagement_comment']);

        if (isset($weights['engagement_cap'])) {
            $score = min($weights['engagement_cap'], $score);
        }

        return max(0.0, $score);
    }
}

