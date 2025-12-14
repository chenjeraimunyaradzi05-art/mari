<?php

namespace App\Support\Messaging;

use App\Models\Connection;
use App\Models\MentorshipMatch;
use App\Models\Profile;
use App\Models\SocialProfile;
use App\Support\ActiveSocialProfile;
use Illuminate\Validation\ValidationException;

final class MessagePolicy
{
    /**
     * Ensures the sender satisfies the target persona's direct message rules.
     *
     * @throws ValidationException
     */
    public function assertCanMessage(Profile $sender, Profile $target): void
    {
        $policy = $target->dm_policy ?: 'everyone';
        $normalized = $this->normalizePolicy($policy);

        if ($normalized === 'no_one') {
            throw $this->reject($target, 'is not accepting new messages right now.');
        }

        if (in_array($normalized, ['public', 'everyone'], true)) {
            return;
        }

        if ($normalized === 'followers' && $this->senderFollowsTarget($sender, $target)) {
            return;
        }

        if (in_array($normalized, ['followers', 'connections_only', 'trusted'], true)) {
            if ($normalized === 'followers') {
                throw $this->reject($target, 'only allows direct messages from followers.');
            }

            if ($this->areProfilesConnected($sender, $target)) {
                return;
            }

            throw $this->reject($target, 'only allows messages from existing connections.');
        }

        if ($normalized === 'mentors_only') {
            if ($this->senderIsMentorFor($sender, $target)) {
                return;
            }

            throw $this->reject($target, 'only allows mentors they have already matched with to DM them.');
        }
    }

    private function normalizePolicy(?string $policy): string
    {
        $policy = strtolower((string) $policy);

        $aliases = [
            'connections' => 'connections_only',
            'connection_only' => 'connections_only',
            'trusted_only' => 'trusted',
            'mentors' => 'mentors_only',
        ];

        return $aliases[$policy] ?? $policy;
    }

    private function senderFollowsTarget(Profile $sender, Profile $target): bool
    {
        $senderSocial = $this->resolveSocialProfile($sender);
        $targetSocial = $this->resolveSocialProfile($target);

        if (!$senderSocial || !$targetSocial) {
            return false;
        }

        return $senderSocial->following()->where('following_id', $targetSocial->getKey())->exists();
    }

    private function areProfilesConnected(Profile $sender, Profile $target): bool
    {
        $senderUserId = $sender->user_id;
        $targetUserId = $target->user_id;

        if (!$senderUserId || !$targetUserId) {
            return false;
        }

        return Connection::query()
            ->where('status', Connection::STATUS_ACCEPTED)
            ->where(function ($query) use ($senderUserId, $targetUserId) {
                $query->where(function ($sub) use ($senderUserId, $targetUserId) {
                    $sub->where('user_id', $senderUserId)
                        ->where('connected_user_id', $targetUserId);
                })->orWhere(function ($sub) use ($senderUserId, $targetUserId) {
                    $sub->where('user_id', $targetUserId)
                        ->where('connected_user_id', $senderUserId);
                });
            })
            ->exists();
    }

    private function senderIsMentorFor(Profile $sender, Profile $target): bool
    {
        $senderSocial = $this->resolveSocialProfile($sender);
        $targetSocial = $this->resolveSocialProfile($target);

        if (!$senderSocial || !$targetSocial) {
            return false;
        }

        return MentorshipMatch::query()
            ->where('mentor_profile_id', $senderSocial->getKey())
            ->where('mentee_profile_id', $targetSocial->getKey())
            ->whereNotIn('status', ['closed', 'cancelled'])
            ->exists();
    }

    private function resolveSocialProfile(Profile $profile): ?SocialProfile
    {
        return ActiveSocialProfile::forProfile($profile, false);
    }

    private function reject(Profile $target, string $message): ValidationException
    {
        $display = $target->display_name ?: 'This member';

        return ValidationException::withMessages([
            'participant_profile_ids' => [sprintf('%s %s', $display, $message)],
        ]);
    }
}

