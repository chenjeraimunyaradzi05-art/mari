<?php

namespace App\Http\Resources\Messaging;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\WellnessBuddyInvite */
final class WellnessBuddyInviteResource extends JsonResource
{
    #[\Override]
    /**
     * @return (\Illuminate\Http\Resources\MissingValue|array|int|mixed|null|string)[]
     *
     * @psalm-return array{id: int, activity_type: null|string, location_preference: null|string, preferred_schedule: array|null, comfort_preferences: array|null, status: string, intro_message: null|string, responded_at: string, created_at: string, updated_at: string, requester: \Illuminate\Http\Resources\MissingValue|mixed, target: \Illuminate\Http\Resources\MissingValue|mixed}
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'activity_type' => $this->activity_type,
            'location_preference' => $this->location_preference,
            'preferred_schedule' => $this->preferred_schedule,
            'comfort_preferences' => $this->comfort_preferences,
            'status' => $this->status,
            'intro_message' => $this->intro_message,
            'responded_at' => optional($this->responded_at)->toIso8601String(),
            'created_at' => optional($this->created_at)->toIso8601String(),
            'updated_at' => optional($this->updated_at)->toIso8601String(),
            'requester' => $this->whenLoaded('requester', function () {
                return [
                    'id' => $this->requester->id,
                    'display_name' => $this->requester->display_name,
                    'handle' => $this->requester->handle,
                    'avatar_path' => $this->requester->avatar_path,
                ];
            }),
            'target' => $this->whenLoaded('target', function () {
                return [
                    'id' => $this->target->id,
                    'display_name' => $this->target->display_name,
                    'handle' => $this->target->handle,
                    'avatar_path' => $this->target->avatar_path,
                ];
            }),
        ];
    }
}
