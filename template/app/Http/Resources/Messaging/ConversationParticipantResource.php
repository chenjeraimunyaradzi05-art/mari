<?php

namespace App\Http\Resources\Messaging;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\SocialThreadParticipant */
final class ConversationParticipantResource extends JsonResource
{
    /**
     * @param Request $request
     */
    #[\Override]
    /**
     * @return (\Illuminate\Http\Resources\MissingValue|bool|int|mixed|string)[]
     *
     * @psalm-return array{id: int, thread_id: int, social_profile: \Illuminate\Http\Resources\MissingValue|mixed, role: 'member'|'moderator'|'owner', status: string, notifications_enabled: bool, last_read_at: string, joined_at: string}
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'thread_id' => $this->social_thread_id,
            'social_profile' => $this->whenLoaded('profile', function () {
                return [
                    'id' => $this->profile->id,
                    'username' => $this->profile->username,
                    'display_name' => $this->profile->display_name,
                    'avatar_url' => $this->profile->avatar_url,
                ];
            }),
            'role' => $this->role instanceof \UnitEnum ? $this->role->value : $this->role,
            'status' => $this->status instanceof \UnitEnum ? $this->status->value : $this->status,
            'notifications_enabled' => (bool) $this->notifications_enabled,
            'last_read_at' => optional($this->last_read_at)->toIso8601String(),
            'joined_at' => optional($this->joined_at)->toIso8601String(),
        ];
    }
}
