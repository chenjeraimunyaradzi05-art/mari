<?php

namespace App\Services\Business;

use App\Models\SocialPost;
use App\Models\SocialProfile;
use Illuminate\Support\Collection;

final class BusinessFeedService
{
    /**
     * Collect a blended feed for the Business dashboard.
     */
    public function posts(?SocialProfile $profile, int $limit = 6): Collection
    {
        $followingIds = $profile
            ? $profile->following()->pluck('following_id')->push($profile->getKey())
            : collect();

        $query = SocialPost::with(['profile'])
            ->public()
            ->active()
            ->whereHas('profile', function ($query) use ($followingIds) {
                $query->whereIn('profile_type', ['business', 'company'])
                    ->when($followingIds->isNotEmpty(), function ($subQuery) use ($followingIds) {
                        $subQuery->orWhereIn('id', $followingIds);
                    });
            })
            ->orderByDesc('ai_engagement_score')
            ->orderByDesc('published_at');

        $posts = $query->limit($limit)->get();

        if ($posts->count() >= $limit || $followingIds->isEmpty()) {
            return $posts;
        }

        $fallback = SocialPost::with(['profile'])
            ->public()
            ->active()
            ->whereHas('profile', function ($query) {
                $query->whereIn('profile_type', ['business', 'company']);
            })
            ->whereNotIn('id', $posts->pluck('id'))
            ->latest('published_at')
            ->limit($limit - $posts->count())
            ->get();

        return $posts->concat($fallback);
    }

    /**
     * @psalm-return \Illuminate\Database\Eloquent\Collection<int, SocialProfile>
     */
    public function recommendedProfiles(?SocialProfile $profile, int $limit = 5): \Illuminate\Database\Eloquent\Collection
    {
        $query = SocialProfile::query()
            ->whereIn('profile_type', ['business', 'company'])
            ->orderByDesc('followers_count');

        if ($profile) {
            $query->where('id', '!=', $profile->getKey())
                ->whereNotIn('id', $profile->following()->pluck('following_id'));
        }

        return $query->limit($limit)->get();
    }

    public function trendingTags(int $limit = 6): array
    {
        $posts = SocialPost::query()
            ->public()
            ->active()
            ->whereHas('profile', fn ($query) => $query->whereIn('profile_type', ['business', 'company']))
            ->orderByDesc('published_at')
            ->limit(40)
            ->get(['tags', 'ai_tags']);

        $tags = $posts->flatMap(function (SocialPost $post) {
            $raw = collect($post->ai_tags ?? [])
                ->merge($post->tags ?? [])
                ->map(function ($tag) {
                    $clean = ltrim((string) $tag, '#');

                    return $clean === '' ? null : '#'.$clean;
                })
                ->filter();

            return $raw;
        })->map(fn ($tag) => strtolower($tag));

        return $tags
            ->countBy()
            ->sortDesc()
            ->take($limit)
            ->keys()
            ->values()
            ->all();
    }
}

