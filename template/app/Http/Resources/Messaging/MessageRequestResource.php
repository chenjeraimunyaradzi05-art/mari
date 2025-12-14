<?php

namespace App\Http\Resources\Messaging;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\SocialMessageRequest */
final class MessageRequestResource extends JsonResource
{
    #[\Override]
    /**
     * @return (\Illuminate\Http\Resources\MissingValue|array|int|mixed|null|string)[]
     *
     * @psalm-return array{id: int, thread_id: int, status: string, subject: null|string, requester: \Illuminate\Http\Resources\MissingValue|mixed, target_social_profile_id: int, expires_at: string, context: array|null, thread: \Illuminate\Http\Resources\MissingValue|mixed, created_at: string, updated_at: string}
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'thread_id' => $this->social_thread_id,
            'status' => $this->status instanceof \UnitEnum ? $this->status->value : $this->status,
            'subject' => $this->thread?->subject,
            'requester' => $this->whenLoaded('requester', function () {
                return [
                    'id' => $this->requester->id,
                    'username' => $this->requester->username,
                    'display_name' => $this->requester->display_name,
                    'avatar_url' => $this->requester->avatar_url,
                ];
            }),
            'target_social_profile_id' => $this->target_social_profile_id,
            'expires_at' => optional($this->expires_at)->toIso8601String(),
            'context' => $this->context,
            'thread' => $this->whenLoaded('thread', fn () => new ConversationResource(
                $this->thread->loadMissing(['participants.profile', 'lastMessage.sender', 'lastMessage.attachments'])
            )),
            'created_at' => optional($this->created_at)->toIso8601String(),
            'updated_at' => optional($this->updated_at)->toIso8601String(),
        ];
    }
}
