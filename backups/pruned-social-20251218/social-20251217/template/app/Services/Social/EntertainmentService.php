<?php

namespace App\Services\Social;

use App\Models\Entertainment\Documentary;
use App\Models\Entertainment\EducationalVideo;
use App\Models\Entertainment\Movie;
use App\Models\Entertainment\ShortVideo;
use App\Models\Entertainment\SuccessStory;
use App\Models\SocialPost;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

final class EntertainmentService
{
    /**
     * Get the "TikTok" style feed of short videos.
     *
     * @param User|null $user
     * @param int $limit
     * @param array $excludeIds IDs of posts to exclude (already seen)
     * @return Collection
     */
    public function getShortVideoFeed(?User $user, int $limit = 20, array $excludeIds = []): Collection
    {
        // 1. Get Followed Content (if user is logged in)
        $followedPosts = collect();
        if ($user && $user->socialProfile) {
            $followingIds = $user->socialProfile->following()->pluck('following_id');

            if ($followingIds->isNotEmpty()) {
                $followedPosts = ShortVideo::query()
                    ->active()
                    ->visible()
                    ->whereIn('social_profile_id', $followingIds)
                    ->whereNotIn('id', $excludeIds)
                    ->latest()
                    ->limit((int) ($limit * 0.5)) // 50% from following
                    ->get();
            }
        }

        // 2. Get Trending Content (High engagement)
        $trendingPosts = ShortVideo::query()
            ->active()
            ->visible()
            ->whereNotIn('id', $excludeIds)
            ->whereNotIn('id', $followedPosts->pluck('id'))
            ->orderByDesc('views_count')
            ->orderByDesc('likes_count')
            ->limit((int) ($limit * 0.3)) // 30% trending
            ->get();

        // 3. Get Discovery Content (Random)
        $currentIds = $followedPosts->pluck('id')
            ->merge($trendingPosts->pluck('id'))
            ->merge($excludeIds);

        $discoveryPosts = ShortVideo::query()
            ->active()
            ->visible()
            ->whereNotIn('id', $currentIds)
            ->inRandomOrder()
            ->limit(max(0, $limit - $followedPosts->count() - $trendingPosts->count()))
            ->get();

        // Merge and Shuffle to create a dynamic feed
        return $followedPosts
            ->merge($trendingPosts)
            ->merge($discoveryPosts)
            ->shuffle();
    }
    /**
     * Get the "Cinema" style feed (Movies, Docs, etc.) for the main entertainment dashboard.
     *
     * @param User|null $user
     * @param int $limit
     * @return Collection
     */
    public function getCinemaFeed(?User $user, int $limit = 10): Collection
    {
        $types = ['movie', 'documentary', 'educational', 'success_story'];

        // 1. Trending (High engagement) - 50%
        $trending = SocialPost::query()
            ->active()
            ->visible()
            ->whereIn('post_type', $types)
            ->orderByDesc('views_count')
            ->limit((int) ($limit * 0.5))
            ->get();

        // 2. Recent (Fresh content) - 30%
        $recent = SocialPost::query()
            ->active()
            ->visible()
            ->whereIn('post_type', $types)
            ->whereNotIn('id', $trending->pluck('id'))
            ->latest('published_at')
            ->limit((int) ($limit * 0.3))
            ->get();

        // 3. Discovery (Random gems) - 20%
        $excludeIds = $trending->pluck('id')->merge($recent->pluck('id'));

        $discovery = SocialPost::query()
            ->active()
            ->visible()
            ->whereIn('post_type', $types)
            ->whereNotIn('id', $excludeIds)
            ->inRandomOrder()
            ->limit($limit - $trending->count() - $recent->count())
            ->get();

        return $trending
            ->merge($recent)
            ->merge($discovery);
    }

    /**
     * Browse entertainment content by category.
     *
     * @param string $category
     * @param int $perPage
     * @return \Illuminate\Contracts\Pagination\LengthAwarePaginator
     */
    public function browse(string $category, int $perPage = 15)
    {
        $query = match ($category) {
            'documentary' => Documentary::query(),
            'movie' => Movie::query(),
            'education' => EducationalVideo::query(),
            'success_story' => SuccessStory::query(),
            default => SocialPost::query()->whereIn('post_type', ['documentary', 'movie', 'educational', 'success_story']),
        };

        return $query
            ->active()
            ->visible()
            ->with(['user', 'profile', 'media'])
            ->orderByDesc('published_at')
            ->paginate($perPage);
    }

    /**
     * Get trending entertainment content.
     */
    public function getTrending(int $limit = 10): Collection
    {
        return SocialPost::query()
            ->active()
            ->visible()
            ->whereIn('post_type', ['documentary', 'movie', 'educational', 'success_story', 'short_video'])
            ->orderByDesc('views_count')
            ->orderByDesc('likes_count')
            ->limit($limit)
            ->get();
    }

    /**
     * Create a new entertainment post.
     *
     * @param User $user
     * @param array $data
     *
     * @return Documentary|EducationalVideo|Movie|ShortVideo|SuccessStory
     */
    public function createEntertainmentPost(User $user, array $data): ShortVideo|Movie|Documentary|EducationalVideo|SuccessStory
    {
        $type = $data['type'] ?? 'short_video';

        $modelClass = match ($type) {
            'movie' => Movie::class,
            'documentary' => Documentary::class,
            'educational' => EducationalVideo::class,
            'success_story' => SuccessStory::class,
            default => ShortVideo::class,
        };

        $post = new $modelClass();
        $post->user_id = $user->id;
        $post->social_profile_id = $user->active_profile_id ?? $user->socialProfile?->id;
        $post->caption = $data['title'] ?? $data['caption'] ?? '';
        $post->content = $data['description'] ?? $data['content'] ?? '';
        $post->visibility = $data['visibility'] ?? 'public';
        $post->published_at = now();

        // Set metadata
        if (isset($data['details']) && is_array($data['details'])) {
            foreach ($data['details'] as $key => $value) {
                $post->setMeta($key, $value);
            }
        }

        $post->save();

        // Attach media if provided
        if (!empty($data['media_ids'])) {
            $post->media()->attach($data['media_ids']);
        }

        return $post;
    }

    /**
     * Update watch progress for a user on a specific post.
     *
     * @param User $user
     * @param int $postId
     * @param int $seconds
     * @param int $totalDuration
     * @param bool $completed
     * @return void
     */
    public function updateProgress(User $user, int $postId, int $seconds, int $totalDuration, bool $completed = false): void
    {
        $user->watchProgress()->updateOrCreate(
            ['social_post_id' => $postId],
            [
                'progress_seconds' => $seconds,
                'total_duration_seconds' => $totalDuration,
                'is_completed' => $completed,
                'last_watched_at' => now(),
            ]
        );
    }

    /**
     * Get "Continue Watching" list for a user.
     *
     * @param User $user
     * @param int $limit
     *
     * @psalm-return \Illuminate\Database\Eloquent\Collection<int, SocialPost>
     */
    public function getContinueWatching(User $user, int $limit = 10): \Illuminate\Database\Eloquent\Collection
    {
        return SocialPost::query()
            ->join('social_post_progress', 'social_posts.id', '=', 'social_post_progress.social_post_id')
            ->where('social_post_progress.user_id', $user->id)
            ->where('social_post_progress.is_completed', false)
            ->where('social_post_progress.progress_seconds', '>', 0)
            ->orderByDesc('social_post_progress.last_watched_at')
            ->select('social_posts.*', 'social_post_progress.progress_seconds', 'social_post_progress.total_duration_seconds')
            ->limit($limit)
            ->get();
    }
}

