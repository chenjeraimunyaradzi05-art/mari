<?php

namespace App\Services\Messaging;

use App\Models\Profile;
use App\Support\Messaging\MessagePolicy;
use Illuminate\Validation\ValidationException;

final class MessagingSafetyService
{

    private MessagePolicy $policy;

    public function __construct(?MessagePolicy $policy = null)
    {
        $this->policy = $policy ?? app(MessagePolicy::class);
    }


    public function ensureProfilesCanConnect(Profile $initiator, Profile $target): void
    {
        if ($initiator->is($target)) {
            throw ValidationException::withMessages([
                'participant_profile_ids' => ['You cannot start a conversation with yourself.'],
            ]);
        }

        if ($initiator->hasBlocked($target)) {
            throw ValidationException::withMessages([
                'participant_profile_ids' => ['You have blocked one of the selected profiles. Unblock them to continue.'],
            ]);
        }

        if ($initiator->isBlockedBy($target)) {
            throw ValidationException::withMessages([
                'participant_profile_ids' => ['One of the selected profiles has blocked you.'],
            ]);
        }

        if ($target->dm_policy === 'no_one') {
            throw ValidationException::withMessages([
                'participant_profile_ids' => ["{$target->display_name} is not accepting new messages right now."],
            ]);
        }

        $this->policy->assertCanMessage($initiator, $target);
    }
}

