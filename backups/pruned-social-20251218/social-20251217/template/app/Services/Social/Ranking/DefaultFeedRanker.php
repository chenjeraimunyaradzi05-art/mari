<?php

namespace App\Services\Social\Ranking;

use App\Contracts\Social\FeedRanker;
use App\Models\SocialPost;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;

final class DefaultFeedRanker implements FeedRanker
{
    #[\Override]
    public function rank(User $user, Collection $candidates, array $options = []): Collection
    {
        $limit = (int) ($options['limit'] ?? 120);
        $scored = $this->scoreCandidates($user, $candidates);

        return $this->diversify($scored, $limit);
    }

    /**
     * @psalm-return Collection<int, Collection<string, 'discovery'|'following'|SocialPost|float|list{0?: string, 1?: string, 2?: 'From network'|'Own content'|'Sponsored placement', 3?: 'From network'|'Own content', 4?: 'Own content'}|mixed>>
     */
    private function scoreCandidates(User $user, Collection $candidates): Collection
    {
        $now = Carbon::now();

        return $candidates
            ->map(fn ($candidate) => $this->normaliseCandidate($candidate))
            ->filter(fn (?array $candidate) => $candidate !== null)
            ->map(function (array $candidate) use ($user, $now) {
                /** @var SocialPost $post */
                $post = $candidate['post'];
                $source = $candidate['source'] ?? 'following';

                $score = 40.0;
                $reasons = [];

                $reactions = $post->reactions_count ?? 0;
                $comments = $post->comments_count ?? 0;
                $impressions = $post->impressions_count ?? 0;

                $engagementScore = ($reactions * 3) + ($comments * 5) + min(10, $impressions * 0.2);
                if ($engagementScore > 0) {
                    $score += min(35, $engagementScore);
                    $reasons[] = 'High engagement';
                }

                $freshnessHours = $post->published_at ? $post->published_at->diffInHours($now) : null;
                if ($freshnessHours !== null) {
                    $freshnessBoost = max(0, 24 - $freshnessHours);
                    $score += $freshnessBoost;
                    $reasons[] = 'Recent activity';
                }

                if ($source === 'sponsored') {
                    $score += 12;
                    $reasons[] = 'Sponsored placement';
                }

                if ($source === 'following') {
                    $score += 8;
                    $reasons[] = 'From network';
                }

                if ($source === 'discovery' && empty($reasons)) {
                    $reasons[] = 'Discovery suggestion';
                }

                $userProfileId = $user->socialProfile?->id;
                if ($userProfileId && $post->social_profile_id === $userProfileId) {
                    $score -= 10;
                    $reasons[] = 'Own content';
                } elseif (isset($user->id) && $post->user_id === $user->id) {
                    $score -= 10;
                    $reasons[] = 'Own content';
                }

                return collect([
                    'post' => $post,
                    'score' => round(max(0, $score), 2),
                    'source' => $source,
                    'reasons' => $reasons,
                ]);
            })
            ->sortByDesc('score')
            ->values();
    }

    /**
     * @psalm-return Collection<int, never>
     */
    private function diversify(Collection $items, int $limit): Collection
    {
        $selected = collect();
        $authorCounts = [];
        $sourceCounts = [];

        foreach ($items as $item) {
            /** @var SocialPost $post */
            $post = $item->get('post');
            $authorId = $post->social_profile_id ?? $post->user_id;
            $source = $item->get('source', 'following');

            if (($authorCounts[$authorId] ?? 0) >= 3) {
                continue;
            }

            if ($source === 'sponsored' && ($sourceCounts['sponsored'] ?? 0) >= 2) {
                continue;
            }

            $selected->push($item);
            $authorCounts[$authorId] = ($authorCounts[$authorId] ?? 0) + 1;
            $sourceCounts[$source] = ($sourceCounts[$source] ?? 0) + 1;

            if ($selected->count() >= $limit) {
                break;
            }
        }

        return $selected->values();
    }

    /**
     * @return (SocialPost|string)[]|null
     *
     * @psalm-return array{post: SocialPost, source: string}|null
     */
    private function normaliseCandidate(mixed $candidate): array|null
    {
        if ($candidate instanceof Collection) {
            $candidate = $candidate->toArray();
        }

        if ($candidate instanceof SocialPost) {
            return ['post' => $candidate, 'source' => 'following'];
        }

        if (! is_array($candidate)) {
            return null;
        }

        $post = $candidate['post'] ?? null;
        if (! $post instanceof SocialPost) {
            return null;
        }

        $source = $candidate['source'] ?? 'following';

        return [
            'post' => $post,
            'source' => is_string($source) ? $source : 'following',
        ];
    }
}

