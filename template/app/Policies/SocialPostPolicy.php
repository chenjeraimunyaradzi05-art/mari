<?php

namespace App\Policies;

use App\Models\SocialPost;
use App\Models\User;
use App\Services\Social\SocialPrivacyService;

final class SocialPostPolicy
{
    private SocialPrivacyService $privacy;

    public function __construct(?SocialPrivacyService $privacy = null)
    {
        $this->privacy = $privacy ?? app(SocialPrivacyService::class);
    }
    public function view(?User $user, SocialPost $post): bool
    {
        return $this->privacy->canViewPost($user, $post);
    }

    public function interact(User $user, SocialPost $post): bool
    {
        return $this->privacy->canInteract($user, $post);
    }

    public function save(User $user, SocialPost $post): bool
    {
        // Owner saving their own post is a no-op — disallow (use client to handle UX)
        if ((int) $post->user_id === (int) $user->id) {
            return false;
        }

        return $this->privacy->canInteract($user, $post);
    }

    public function repost(User $user, SocialPost $post): bool
    {
        // Don't allow reposting your own post
        if ((int) $post->user_id === (int) $user->id) {
            return false;
        }

        if (! $this->privacy->canInteract($user, $post)) {
            return false;
        }

        // Deny reposts for posts with moderation statuses that should be blocked.
        // Prefer DB-backed admin setting 'social_repost_blocked_moderation_statuses' if provided
        $dbBlocked = config('settings.social_repost_blocked_moderation_statuses', null);
        if (! is_null($dbBlocked)) {
            $blocked = array_map('strtolower', array_values(array_filter(array_map('trim', explode(',', (string) $dbBlocked)))));
        } else {
            $blocked = array_map('strtolower', (array) config('social.repost.blocked_moderation_statuses', ['pending_review', 'flagged', 'rejected']));
        }

        if (! empty($post->moderation_status) && in_array(strtolower((string) $post->moderation_status), $blocked, true)) {
            return false;
        }

        // If configured, block reposts when AI moderation flags exist. Prefer DB value
        $dbBlockOnAi = config('settings.social_repost_block_on_ai_flags');
        $blockOnAi = is_null($dbBlockOnAi) ? (bool) config('social.repost.block_on_ai_flags', true) : (bool) $dbBlockOnAi;

        if ($blockOnAi) {
            $aiFlags = collect(data_get($post->ai_moderation_meta, 'flags', []))
                ->map(fn ($v) => strtolower((string) $v))
                ->filter()
                ->values()
                ->all();

            // If a specific set of AI flags is configured, only block when there
            // is an intersection between the post flags and the configured list.
            $dbAIBlocked = config('settings.social_repost_ai_blocked_flags', null);
            if (! is_null($dbAIBlocked)) {
                $blockedFlags = array_values(array_filter(array_map('trim', explode(',', (string) $dbAIBlocked))));
                $blockedFlags = array_map('strtolower', $blockedFlags);
            } else {
                $blockedFlags = array_map('strtolower', (array) config('social.repost.ai_blocked_flags', []));
            }

            if (! empty($blockedFlags)) {
                if (count(array_intersect($aiFlags, $blockedFlags)) > 0) {
                    return false;
                }
            } else {
                // No specific flags configured: any AI flag blocks reposting.
                if (! empty($aiFlags)) {
                    return false;
                }
            }
        }

        // rate-limit repeated reposting of the same post by the same social profile
        $profileId = $user->socialProfile?->id;
        if (! $profileId) {
            return false;
        }

            // Prefer DB-backed admin settings (config('settings.*')) if present, otherwise fall back to config/social.php
            $hours = (int) (
                config('settings.social_repost_rate_limit_hours') ?? config('social.repost.rate_limit_hours', 24)
            );

        $recent = \App\Models\SocialPostShare::query()
            ->where('social_post_id', $post->id)
            ->where('social_profile_id', $profileId)
            ->where('channel', 'repost')
            ->where('shared_at', '>=', now()->subHours($hours))
            ->exists();

        return ! $recent;
    }

    public function comment(User $user, SocialPost $post): bool
    {
        if ($post->comments_disabled) {
            return false;
        }

        return $this->privacy->canInteract($user, $post);
    }

    public function delete(User $user, SocialPost $post): bool
    {
        return (int) $post->user_id === (int) $user->id;
    }
}

