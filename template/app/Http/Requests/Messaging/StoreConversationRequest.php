<?php

namespace App\Http\Requests\Messaging;

use App\Enums\SocialMessageType;
use App\Enums\SocialThreadType;
use App\Http\Requests\Messaging\Concerns\ValidatesAttachmentConstraints;
use App\Support\Messaging\AttachmentTypes;
use App\Support\Messaging\ShareableTypes;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * @property int|null $type
 * @property int|null $participant_social_profile_ids
 * @property int|null $participant_social_profile_ids.*
 * @property array<int, mixed>|null $subject
 * @property array<int, mixed>|null $requires_approval
 * @property array<int, mixed>|null $request_mode
 * @property array<int, mixed>|null $metadata
 * @property array<int, mixed>|null $initial_message
 * @property array<int, mixed>|null $initial_message.message_type
 * @property array<int, mixed>|null $initial_message.body
 * @property array<int, mixed>|null $initial_message.attachments
 * @property array<int, mixed>|null $initial_message.attachments.*
 * @property string|null $initial_message.attachments.*.type
 * @property int|null $initial_message.attachments.*.url
 * @property int|null $initial_message.attachments.*.upload
 * @property int|null $initial_message.attachments.*.size_kb
 * @property string|null $initial_message.shareable_type
 * @property int|null $initial_message.shareable_id
 */
final class StoreConversationRequest extends FormRequest
{
    use ValidatesAttachmentConstraints;

    /**
    * @return int[]
    *
    * @psalm-return list<int>
     */
    public function participantSocialProfileIds(): array
    {
        return array_values($this->input('participant_social_profile_ids', []));
    }

    public function initialMessagePayload(): ?array
    {
        return $this->input('initial_message');
    }

    public function rules(): array
    {
        $threadTypes = array_map(fn($e) => $e->value, \App\Enums\SocialThreadType::cases());
        $messageTypes = array_map(fn($e) => $e->value, \App\Enums\SocialMessageType::cases());

        return [
            'type' => ['required', 'string', \Illuminate\Validation\Rule::in($threadTypes)],
            'participant_social_profile_ids' => ['required', 'array', 'min:1'],
            'participant_social_profile_ids.*' => ['integer', 'distinct'],
            'initial_message' => ['nullable', 'array'],
            'initial_message.message_type' => ['nullable', 'string', \Illuminate\Validation\Rule::in($messageTypes)],
            'initial_message.body' => ['nullable'],
            'initial_message.attachments' => ['nullable', 'array'],
            'initial_message.attachments.*.type' => ['nullable', AttachmentTypes::rule()],
            'initial_message.attachments.*.url' => ['nullable', 'url'],
            'initial_message.attachments.*.size_kb' => ['nullable', 'integer'],
            'initial_message.shareable_type' => ['nullable', ShareableTypes::rule()],
            'initial_message.shareable_id' => ['nullable', 'integer'],
        ];
    }

    public function withValidator(\Illuminate\Validation\Validator $validator): void
    {
        $validator->after(function ($v) {
            $payload = $this->input('initial_message');

            if (!is_array($payload)) {
                return;
            }

            $type = $payload['message_type'] ?? null;

            if ($type === \App\Enums\SocialMessageType::PostShare->value) {
                if (empty($payload['shareable_type'])) {
                    $v->errors()->add('initial_message.shareable_type', 'The initial_message.shareable_type field is required for post_share.');
                }

                if (empty($payload['shareable_id'])) {
                    $v->errors()->add('initial_message.shareable_id', 'The initial_message.shareable_id field is required for post_share.');
                }

                return;
            }

            if ($type === \App\Enums\SocialMessageType::Media->value || $type === \App\Enums\SocialMessageType::Video->value) {
                $attachments = $payload['attachments'] ?? null;

                if (!is_array($attachments) || empty($attachments)) {
                    $v->errors()->add('initial_message.attachments', 'Provide at least one attachment for media messages.');
                    return;
                }

                foreach ($attachments as $index => $attachment) {
                    $hasType = !empty($attachment['type']);
                    $hasUrl = !empty($attachment['url']);
                    $hasUpload = array_key_exists('upload', $attachment) && $attachment['upload'] !== null;

                    if ($hasType && !$hasUrl && !$hasUpload) {
                        $v->errors()->add(sprintf('initial_message.attachments.%d.url', $index), 'The url field is required when type is present.');
                    }

                    if ($hasUrl && !$hasType) {
                        $v->errors()->add(sprintf('initial_message.attachments.%d.type', $index), 'The type field is required when url is present.');
                    }
                }

                $this->validateAttachmentConstraints($v, $attachments, 'initial_message.attachments');
            }
        });
    }
}
