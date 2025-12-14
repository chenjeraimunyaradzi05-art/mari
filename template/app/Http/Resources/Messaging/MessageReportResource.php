<?php

namespace App\Http\Resources\Messaging;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\SocialMessageReport */
final class MessageReportResource extends JsonResource
{
    #[\Override]
    /**
     * @return (\Illuminate\Http\Resources\MissingValue|array|int|mixed|null|string)[]
     *
     * @psalm-return array{id: int, reason: null|string, status: string, notes: null|string, metadata: array|null, message: \Illuminate\Http\Resources\MissingValue|mixed, incident: \Illuminate\Http\Resources\MissingValue|mixed, created_at: string, updated_at: string}
     */
    public function toArray(Request $request): array
    {
        $status = $this->status instanceof \UnitEnum ? $this->status->value : $this->status;

        return [
            'id' => $this->id,
            'reason' => $this->reason,
            'status' => $status,
            'notes' => $this->notes,
            'metadata' => $this->metadata,
            'message' => $this->whenLoaded('message', function () {
                return [
                    'id' => $this->message->id,
                    'thread_id' => $this->message->social_thread_id,
                    'body' => $this->message->body,
                    'sender' => $this->message->sender ? [
                        'id' => $this->message->sender->id,
                        'username' => $this->message->sender->username,
                        'display_name' => $this->message->sender->display_name,
                        'avatar_url' => $this->message->sender->avatar_url,
                    ] : null,
                ];
            }),
            'incident' => $this->whenLoaded('incident', function () {
                return [
                    'id' => $this->incident->id,
                    'uuid' => $this->incident->uuid,
                    'status' => $this->incident->status,
                ];
            }),
            'created_at' => optional($this->created_at)->toIso8601String(),
            'updated_at' => optional($this->updated_at)->toIso8601String(),
        ];
    }
}
