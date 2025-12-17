<?php

namespace App\Services\Social;

use App\Models\SocialPost;
use App\Models\SocialPostShare;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class SocialShareService
{


    /**
     * Share a post to multiple channels.
     *
     * @param User $user
     * @param SocialPost $post
     * @param array $channels List of channel names (e.g. ['facebook', 'twitter'])
     * @param string|null $customMessage Optional custom message for the share
     *
     * @return array[] Results of sharing
     *
     * @psalm-return array<array>
     */
    public function sharePost(User $user, SocialPost $post, array $channels, ?string $customMessage = null): array
    {
        $results = [];

        foreach ($channels as $channel) {
            try {
                $results[$channel] = $this->shareToChannel($user, $post, $channel, $customMessage);
            } catch (\Exception $e) {
                $results[$channel] = [
                    'status' => 'failed',
                    'error' => $e->getMessage(),
                ];
            }
        }

        return $results;
    }

    /**
     * @return (array|string)[]
     *
     * @psalm-return array{status: 'success', data: array}
     */
    protected function shareToChannel(User $user, SocialPost $post, string $channel, ?string $customMessage = null): array
    {
        // Prepare content
        $content = [
            'text' => $customMessage ?? $post->caption ?? $post->content ?? '',
            'url' => route('social.posts.show', $post->id), // Assuming this route exists or similar
            'media' => $post->media->map(fn($m) => $m->url)->toArray(),
        ];

        // Post to provider
        $response = $this->integrationService->postToProvider($user, $channel, $content);

        // Record the share
        DB::transaction(function () use ($user, $post, $channel, $response) {
            SocialPostShare::create([
                'social_post_id' => $post->id,
                'social_profile_id' => $post->social_profile_id, // Or the sharer's profile? Assuming sharer is user
                'user_id' => $user->id,
                'channel' => $channel,
                'meta' => $response,
                'shared_at' => now(),
            ]);

            $post->increment('shares_count');
        });

        return [
            'status' => 'success',
            'data' => $response,
        ];
    }
}

