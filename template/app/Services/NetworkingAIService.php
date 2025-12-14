<?php

namespace App\Services;

use App\Models\User;
use App\Models\Connection;
use App\Models\Post;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Message;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class NetworkingAIService
{
    protected AICacheService $cacheService;
    protected AIErrorHandler $errorHandler;

    public function __construct(?AICacheService $cacheService = null, ?AIErrorHandler $errorHandler = null)
    {
        $this->cacheService = $cacheService ?? app(AICacheService::class);
        $this->errorHandler = $errorHandler ?? app(AIErrorHandler::class);
    }

    /**
     * Get AI-powered connection recommendations for a user
     */
    public function getConnectionRecommendations(User $user, int $limit = 10): array
    {
        try {
            $cacheKey = "networking_recommendations_{$user->id}";

            return Cache::remember($cacheKey, now()->addHours(24), function () use ($user, $limit) {
                $candidate = $user->candidate;
                if (!$candidate) {
                    return [];
                }

                $existingConnections = Connection::where('user_id', $user->id)
                    ->orWhere('connected_user_id', $user->id)
                    ->pluck('user_id', 'connected_user_id')
                    ->flatten()
                    ->unique()
                    ->filter(fn($id) => $id != $user->id)
                    ->toArray();

                // Get candidates with similar skills, profession, and interests
                // Support both the legacy 'candidate' role and the canonical 'member' role
                $recommendations = User::whereIn('role', ['candidate', 'member'])
                    ->where('id', '!=', $user->id)
                    ->whereNotIn('id', $existingConnections)
                    ->with('candidate')
                    ->limit($limit * 3)
                    ->get()
                    ->map(function ($potentialConnection) use ($candidate) {
                        $score = $this->calculateConnectionScore($candidate, $potentialConnection->candidate);
                        return [
                            'user' => $potentialConnection,
                            'score' => $score,
                            'reason' => $this->getConnectionReason($candidate, $potentialConnection->candidate),
                        ];
                    })
                    ->sortByDesc('score')
                    ->take($limit)
                    ->values()
                    ->toArray();

                return $recommendations;
            });
        } catch (\Exception $e) {
            $this->errorHandler->handle($e, 'networking_recommendations');
            return [];
        }
    }

    /**
     * Calculate compatibility score between two candidates
     *
     * @psalm-return int<min, 100>
     */
    protected function calculateConnectionScore(\App\Models\Candidate $candidate1, $candidate2): int
    {
        $score = 0;

        // Profession match (30 points)
        if ($candidate1?->profession_id && $candidate2?->profession_id &&
            $candidate1->profession_id == $candidate2->profession_id) {
            $score += 30;
        }

        // Experience level match (20 points)
        if ($candidate1?->experience_id && $candidate2?->experience_id &&
            $candidate1->experience_id == $candidate2->experience_id) {
            $score += 20;
        }

        // Location proximity (15 points)
        if ($candidate1?->city && $candidate2?->city && $candidate1->city == $candidate2->city) {
            $score += 15;
        }

        // Industry diversity bonus (10 points)
        if ($candidate1?->profession_id != $candidate2?->profession_id) {
            $score += 10; // Bonus for diverse connections
        }

        // Mutual connections (25 points per mutual)
        $mutuals = $this->getMultualConnections($candidate1->user_id, $candidate2->user_id);
        $score += min($mutuals->count() * 25, 50);

        return min($score, 100); // Cap at 100
    }

    /**
     * Get mutual connections between two users
     */
    protected function getMultualConnections(int $userId1, $userId2): Collection
    {
        $user1Connections = Connection::where('user_id', $userId1)
            ->orWhere('connected_user_id', $userId1)
            ->pluck('connected_user_id', 'user_id')
            ->flatten()
            ->filter(fn($id) => $id != $userId1);

        return $user1Connections->filter(function ($connectedId) use ($userId2) {
            return Connection::where(function ($q) use ($userId2, $connectedId) {
                $q->where('user_id', $userId2)->where('connected_user_id', $connectedId);
            })->orWhere(function ($q) use ($userId2, $connectedId) {
                $q->where('user_id', $connectedId)->where('connected_user_id', $userId2);
            })->exists();
        });
    }

    /**
     * Get reason why two users should connect
     */
    protected function getConnectionReason(\App\Models\Candidate $candidate1, $candidate2): string
    {
        $reasons = [];

        if ($candidate1?->profession_id && $candidate2?->profession_id &&
            $candidate1->profession_id == $candidate2->profession_id) {
            $reasons[] = "Same profession interest";
        }

        if ($candidate1?->city && $candidate2?->city && $candidate1->city == $candidate2->city) {
            $reasons[] = "Located in the same area";
        }

        $mutuals = $this->getMultualConnections($candidate1->user_id, $candidate2->user_id)->count();
        if ($mutuals > 0) {
            $reasons[] = "$mutuals mutual connection" . ($mutuals > 1 ? 's' : '');
        }

        return implode(" • ", $reasons) ?: "Great networking opportunity";
    }

    /**
     * Analyze sentiment of content
     *
     * @return (float|int|string)[]
     *
     * @psalm-return array{sentiment: 'negative'|'neutral'|'positive', score: 0|1|float}
     */
    protected function analyzeSentiment(string $content): array
    {
        $sentiment = 'neutral';
        $score = 0.5;

        $positive = ['great', 'awesome', 'excellent', 'amazing', 'love', 'perfect', 'fantastic', 'wonderful', 'outstanding'];
        $negative = ['bad', 'hate', 'terrible', 'awful', 'poor', 'disappointing', 'frustrating', 'horrible'];

        $lowerContent = strtolower($content);

        $positiveCount = count(array_filter($positive, fn($word) => str_contains($lowerContent, $word)));
        $negativeCount = count(array_filter($negative, fn($word) => str_contains($lowerContent, $word)));

        if ($positiveCount > $negativeCount) {
            $sentiment = 'positive';
            $score = 0.5 + (($positiveCount - $negativeCount) / 10);
        } elseif ($negativeCount > $positiveCount) {
            $sentiment = 'negative';
            $score = 0.5 - (($negativeCount - $positiveCount) / 10);
        }

        return [
            'sentiment' => $sentiment,
            'score' => min(max($score, 0), 1),
        ];
    }

    /**
     * Calculate engagement score for a post
     *
     * @return float|int
     *
     * @psalm-return 1|10|float
     */
    protected function calculateEngagementScore(Post $post): int|float
    {
        $likes = $post->likes_count ?? 0;
        $comments = $post->comments_count ?? 0;
        $shares = $post->shares_count ?? 0;

        $score = ($likes * 1) + ($comments * 3) + ($shares * 5);
        $engagement = min(round(($score / 100) * 10), 10); // Score out of 10

        return max($engagement, 1);
    }

    /**
     * Estimate audience reach for a post
     *
     * @return float|int
     *
     * @psalm-return 0|float
     */
    protected function estimateAudienceReach(Post $post): int|float
    {
        $user = $post->user;
        $connections = Connection::where('user_id', $user->id)
            ->orWhere('connected_user_id', $user->id)
            ->count();

        // Base reach is connections + their connections (simplified)
        $baseReach = $connections * 1.5;
        $visibility = $post->is_public ? 2 : 1;

        return max(round($baseReach * $visibility), 0);
    }

    /**
     * Get recommendations for improving post performance
     *
     * @return string[]
     *
     * @psalm-return list{0?: string, 1?: 'Add images or videos to boost engagement by up to 80%'|'Share at a better time or improve your content'|'Write a longer, more detailed post for better engagement', 2?: 'Add images or videos to boost engagement by up to 80%'|'Share at a better time or improve your content', 3?: 'Add images or videos to boost engagement by up to 80%'}
     */
    protected function getPostRecommendations(Post $post): array
    {
        $recommendations = [];

        // Check if post has hashtags
        if (!str_contains($post->content, '#')) {
            $recommendations[] = "Add relevant hashtags to increase discoverability";
        }

        // Check post length
        if (strlen($post->content) < 50) {
            $recommendations[] = "Write a longer, more detailed post for better engagement";
        }

        // Check engagement score
        if ($this->calculateEngagementScore($post) < 3) {
            $recommendations[] = "Share at a better time or improve your content";
        }

        // Media recommendations
        if (empty($post->media)) {
            $recommendations[] = "Add images or videos to boost engagement by up to 80%";
        }

        return $recommendations;
    }

    /**
     * Get optimal time to post based on user's network activity
     */
    protected function getOptimalPostingTime(int $userId): array
    {
        try {
            $cacheKey = "optimal_posting_time_{$userId}";

            return Cache::remember($cacheKey, now()->addDays(1), function () use ($userId) {
                // Analyze when user's connections are most active
                $connectionActivity = Post::whereHas('user', function ($q) use ($userId) {
                    $q->whereIn('id', function ($subQ) use ($userId) {
                        Connection::where('user_id', $userId)
                            ->orWhere('connected_user_id', $userId)
                            ->select('connected_user_id', 'user_id');
                    });
                })
                    ->select(Post::raw('HOUR(created_at) as hour'), Post::raw('count(*) as count'))
                    ->groupBy('hour')
                    ->orderByDesc('count')
                    ->limit(3)
                    ->get();

                if ($connectionActivity->isEmpty()) {
                    return [
                        'best_hour' => 9,
                        'best_day' => 'Tuesday',
                        'recommendation' => 'Tuesday 9:00 AM - Time when most professionals are active',
                    ];
                }

                $hours = $connectionActivity->pluck('hour')->toArray();
                $bestHour = $hours[0] ?? 9;

                return [
                    'best_hour' => $bestHour,
                    'best_day' => 'Tuesday',
                    'recommendation' => 'Tuesday ' . sprintf("%02d", $bestHour) . ':00 AM - Optimal engagement window',
                ];
            });
        } catch (\Exception $e) {
            $this->errorHandler->handle($e, 'optimal_posting_time');
            return [
                'best_hour' => 9,
                'best_day' => 'Tuesday',
                'recommendation' => 'Tuesday 9:00 AM (default)',
            ];
        }
    }
}

