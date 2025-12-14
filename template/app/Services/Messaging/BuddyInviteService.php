<?php

namespace App\Services\Messaging;

use App\Models\Profile;
use App\Services\Messaging\ConversationService;
use App\Services\Messaging\MessagingSafetyService;
use App\Models\SocialThread;
use App\Models\WellnessBuddyInvite;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

final class BuddyInviteService
{
    private MessagingSafetyService $safety;
    private ConversationService $conversations;

    public function __construct(?MessagingSafetyService $safety = null, ?ConversationService $conversations = null)
    {
        $this->safety = $safety ?? app(MessagingSafetyService::class);
        $this->conversations = $conversations ?? app(ConversationService::class);
    }


    public function sendInvite(Profile $requester, Profile $target, array $payload): WellnessBuddyInvite
    {
        $this->safety->ensureProfilesCanConnect($requester, $target);

        if ($this->hasActiveInviteBetween($requester, $target)) {
            throw ValidationException::withMessages([
                'target_profile_id' => ['You already have a pending invite with this profile.'],
            ]);
        }

        return WellnessBuddyInvite::create([
            'requester_profile_id' => $requester->id,
            'target_profile_id' => $target->id,
            'activity_type' => $payload['activity_type'] ?? null,
            'location_preference' => $payload['location_preference'] ?? null,
            'preferred_schedule' => $payload['preferred_schedule'] ?? null,
            'comfort_preferences' => $payload['comfort_preferences'] ?? null,
            'intro_message' => $payload['intro_message'] ?? null,
            'status' => 'pending',
        ]);
    }

    /**
     * @return array{invite: WellnessBuddyInvite, conversation: ?SocialThread}
     */
    public function respond(Profile $actor, WellnessBuddyInvite $invite, string $action, ?string $messageBody = null): array
    {
        $invite->loadMissing(['requester', 'target']);

        if ($invite->status !== 'pending') {
            throw ValidationException::withMessages([
                'action' => ['This invite has already been answered.'],
            ]);
        }

        $conversation = null;

        if ($action === 'accept') {
            $this->assertTarget($actor, $invite);

            $invite = $this->markInvite($invite, 'accepted');

            $conversation = $this->conversations->startConversation(
                $actor,
                Collection::make([$invite->requester])->filter(),
                'direct',
                false,
                null,
                ['buddy_invite_id' => $invite->id],
                $this->buildInitialMessagePayload($messageBody)
            );
        } elseif ($action === 'decline') {
            $this->assertTarget($actor, $invite);
            $invite = $this->markInvite($invite, 'declined');
        } elseif ($action === 'withdraw') {
            $this->assertRequester($actor, $invite);
            $invite = $this->markInvite($invite, 'withdrawn');
        } else {
            throw ValidationException::withMessages([
                'action' => ['Unsupported action. Use accept, decline, or withdraw.'],
            ]);
        }

        return compact('invite', 'conversation');
    }

    private function hasActiveInviteBetween(Profile $requester, Profile $target): bool
    {
        return WellnessBuddyInvite::query()
            ->where(function ($query) use ($requester, $target) {
                $query->where(function ($inner) use ($requester, $target) {
                    $inner->where('requester_profile_id', $requester->id)
                        ->where('target_profile_id', $target->id);
                })->orWhere(function ($inner) use ($requester, $target) {
                    $inner->where('requester_profile_id', $target->id)
                        ->where('target_profile_id', $requester->id);
                });
            })
            ->where('status', 'pending')
            ->exists();
    }

    private function markInvite(WellnessBuddyInvite $invite, string $status): WellnessBuddyInvite|null
    {
        $invite->forceFill([
            'status' => $status,
            'responded_at' => now(),
        ])->save();

        return $invite->fresh(['requester', 'target']);
    }

    private function assertTarget(Profile $actor, WellnessBuddyInvite $invite): void
    {
        if ($actor->getKey() !== $invite->target_profile_id) {
            throw ValidationException::withMessages([
                'action' => ['Only the invited profile can perform this action.'],
            ]);
        }
    }

    private function assertRequester(Profile $actor, WellnessBuddyInvite $invite): void
    {
        if ($actor->getKey() !== $invite->requester_profile_id) {
            throw ValidationException::withMessages([
                'action' => ['Only the profile who sent the invite can withdraw it.'],
            ]);
        }
    }

    /**
     * @return string[]
     *
     * @psalm-return array{message_type: 'text', body: string}
     */
    private function buildInitialMessagePayload(?string $messageBody): array
    {
        $body = trim((string) ($messageBody ?? ''));

        if ($body === '') {
            $body = 'Thanks for connecting! Looking forward to being wellness buddies.';
        }

        return [
            'message_type' => 'text',
            'body' => $body,
        ];
    }
}

