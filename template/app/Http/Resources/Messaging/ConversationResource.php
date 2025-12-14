<?php

namespace App\Http\Resources\Messaging;

use Illuminate\Http\Resources\Json\JsonResource;

final class ConversationResource extends JsonResource
{
	/**
	 * Transform the resource into an array.
	 *
	 * @param  \Illuminate\Http\Request  $request
	 * @return array<string, mixed>
	 */
	public function toArray($request): array
	{
		return [
			'status' => $this->status instanceof \BackedEnum ? $this->status->value : ($this->status ?? null),
			'id' => $this->id,
			'thread_type' => $this->thread_type?->value ?? null,
			// legacy alias expected by some API consumers/tests
			'type' => $this->thread_type?->value ?? null,
			// preserve the metadata payload when available
			'metadata' => $this->metadata ?? null,
			'subject' => $this->subject,
			'latest_message' => $this->whenLoaded('lastMessage', function () {
				$m = $this->lastMessage;

				return [
					'id' => $m->id,
					'body' => $m->body,
					'message_type' => $m->message_type?->value ?? null,
					'sent_at' => optional($m->sent_at)->toIso8601String(),
				];
			}),
			'participants' => $this->whenLoaded('participants', function () {
				return $this->participants->map(function ($p) {
					return [
						'id' => $p->id,
						'role' => $p->role?->value ?? null,
						'social_profile' => [
							'id' => $p->profile?->id,
							'display_name' => $p->profile?->display_name,
						],
					];
				})->all();
			}),
		];
	}
}

