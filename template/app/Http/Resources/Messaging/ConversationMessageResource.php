<?php

namespace App\Http\Resources\Messaging;

use Illuminate\Http\Resources\Json\JsonResource;

final class ConversationMessageResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return array<string, mixed>
     */
    public function toArray($request): array
    {
        $guard = app(\App\Services\Messaging\MessagingPreviewPrivacyGuard::class);
        $decision = $guard->evaluate($request->user(), $this->sender ?? null, $this->social_thread_id ?? null, $this->id ?? null, (bool) $this->is_system);

        $isRedacted = $decision->isRedacted();
        $redactionReason = $decision->reason;

        // Compute viewer's reaction (if any).
        $viewerReaction = null;

        try {
            $profile = \App\Support\ActiveProfile::forUser($request->user());
            if ($profile) {
                $social = \App\Support\ActiveSocialProfile::forProfile($profile);
                if ($social && ($this->reactions ?? null) instanceof \Illuminate\Support\Collection) {
                    $found = $this->reactions->firstWhere('social_profile_id', $social->getKey());
                    $viewerReaction = $found?->emoji ?? null;
                }
            }
        } catch (\Throwable $_) {
            // Defensive — if ActiveProfile or ActiveSocialProfile throw we
            // continue with null viewer reaction.
        }

        return [
            'id' => $this->id,
            'message_type' => ($this->message_type instanceof \BackedEnum)
                ? $this->message_type->value
                : ($this->message_type ?? null),
            // Evaluate whether the viewer is allowed to see a message preview
            // (e.g. for private senders). We can safely evaluate here using the
            // MessagingPreviewPrivacyGuard and the current request user.
            'body' => $isRedacted ? null : $this->body,
            'structured_body' => $this->structured_body ?? null,
            'is_system' => (bool) $this->is_system,
            'shareable_type' => $this->shareable_type,
            'shareable_id' => $this->shareable_id,
            'reply_to_message_id' => $this->reply_to_message_id,
            'sender' => $this->whenLoaded('sender', function () {
                return [
                    'id' => $this->sender?->id,
                    'display_name' => $this->sender?->display_name,
                ];
            }),
            'attachments' => $this->whenLoaded('attachments', function () {
                $attachments = $this->attachments instanceof \Illuminate\Support\Collection
                    ? $this->attachments
                    : collect($this->attachments ?? []);

                return $attachments->map(function ($a) {
                    return [
                        'id' => $a->id,
                        'type' => $a->media_type,
                        'file_path' => $a->file_path,
                        'thumbnail_path' => $a->thumbnail_path,
                        'file_size' => $a->file_size,
                        'mime_type' => $a->mime_type,
                    ];
                })->all();
            }),
            'sent_at' => optional($this->sent_at)->toIso8601String(),

            // Include any redaction metadata for previews so consumers can hide
            // the message body when the viewer isn't permitted to read it.
            'is_redacted' => $isRedacted,

            'redaction_reason' => $redactionReason,

            // Reaction summary for the viewer + global reaction counts.
            'viewer_reaction' => $viewerReaction,

            'reactions' => $this->whenLoaded('reactions', function () {
                $reactions = $this->reactions instanceof \Illuminate\Support\Collection
                    ? $this->reactions
                    : collect($this->reactions ?? []);

                return $reactions->groupBy('emoji')->map(function ($group, $emoji) {
                    return [
                        'emoji' => $emoji,
                        'count' => $group->count(),
                    ];
                })->values()->all();
            }),
        ];
    }
}
