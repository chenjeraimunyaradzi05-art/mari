<?php

namespace App\Http\Requests\Messaging;

use App\Enums\SocialMessageType;
use App\Http\Requests\Messaging\Concerns\ValidatesAttachmentConstraints;
use App\Support\Messaging\AttachmentTypes;
use App\Support\Messaging\ShareableTypes;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * @property array<int, mixed>|null $message_type
 * @property array<int, mixed>|null $body
 * @property array<int, mixed>|null $structured_body
 * @property array<int, mixed>|null $attachments
 * @property array<int, mixed>|null $attachments.*
 * @property int|null $attachments.*.type
 * @property int|null $attachments.*.url
 * @property int|null $attachments.*.upload
 * @property int|null $attachments.*.size_kb
 * @property int|null $shareable_type
 * @property int|null $shareable_id
 * @property int|null $reply_to_message_id
 */
final class SendConversationMessageRequest extends FormRequest
{
    use ValidatesAttachmentConstraints;

    public function rules(): array
    {
        $messageTypes = array_map(fn($e) => $e->value, \App\Enums\SocialMessageType::cases());

        return [
            'message_type' => ['required', 'string', \Illuminate\Validation\Rule::in($messageTypes)],
            'body' => ['nullable'],
            'structured_body' => ['nullable', 'array'],
            'attachments' => ['nullable', 'array'],
            'attachments.*.type' => ['nullable', AttachmentTypes::rule()],
            'attachments.*.url' => ['nullable', 'url'],
            'attachments.*.size_kb' => ['nullable', 'integer'],
            'shareable_type' => ['nullable', 'required_with:shareable_id', ShareableTypes::rule()],
            'shareable_id' => ['nullable', 'required_with:shareable_type', 'integer'],
            'reply_to_message_id' => ['nullable', 'integer', 'exists:social_messages,id'],
        ];
    }

    public function withValidator(\Illuminate\Validation\Validator $validator): void
    {
        $validator->after(function ($v) {
            // Prefer raw inputs merged with validated values so any UploadedFile
            // instances (which validated() may drop) remain available for
            // downstream validators and services.
            // Merge raw inputs, any uploaded files and validated values so the
            // payload contains UploadedFile instances when provided.
            $payload = array_merge($this->all(), $this->allFiles(), $this->validated() ?? []);

            $type = $payload['message_type'] ?? null;

            if ($type === \App\Enums\SocialMessageType::PostShare->value) {
                if (empty($payload['shareable_type'])) {
                    $v->errors()->add('shareable_type', 'The shareable_type field is required for post_share.');
                }

                if (empty($payload['shareable_id'])) {
                    $v->errors()->add('shareable_id', 'The shareable_id field is required for post_share.');
                }

                return;
            }

            if ($type === \App\Enums\SocialMessageType::Media->value || $type === \App\Enums\SocialMessageType::Video->value) {
                $attachments = $payload['attachments'] ?? null;

                if (!is_array($attachments) || empty($attachments)) {
                    $v->errors()->add('attachments', 'Provide at least one attachment for media messages.');
                    return;
                }

                foreach ($attachments as $index => $attachment) {
                    $hasType = !empty($attachment['type']);
                    $hasUrl = !empty($attachment['url']);
                    $hasUpload = array_key_exists('upload', $attachment) && $attachment['upload'] !== null;

                    if ($hasType && !$hasUrl && !$hasUpload) {
                        $v->errors()->add(sprintf('attachments.%d.url', $index), 'The url field is required when type is present.');
                    }

                    if ($hasUrl && !$hasType) {
                        $v->errors()->add(sprintf('attachments.%d.type', $index), 'The type field is required when url is present.');
                    }
                }

                $this->validateAttachmentConstraints($v, $attachments, 'attachments');
                return;
            }

            // Text messages require a body. If neither body nor attachments are
            // present, add errors for both keys so callers are told which content
            // fields need supplying (tests assert both keys). Treat a structured
            // body as satisfying the "body" requirement as well.
            if ($type === \App\Enums\SocialMessageType::Text->value) {
                $isBodyEmpty = empty($payload['body']) && empty($payload['structured_body']);
                $attachmentsEmpty = empty($payload['attachments']);

                if ($isBodyEmpty) {
                    $v->errors()->add('body', 'The body field is required for text messages.');
                }

                if ($isBodyEmpty && $attachmentsEmpty) {
                    $v->errors()->add('attachments', 'Provide at least one attachment or a body for the message.');
                }
            }

            // When a caller includes a shareable payload (either type or id) we
            // require both fields so validation errors are clear to callers.
            if (!empty($payload['shareable_type']) && empty($payload['shareable_id'])) {
                $v->errors()->add('shareable_id', 'The shareable_id field is required when shareable_type is present.');
            }

            if (!empty($payload['shareable_id']) && empty($payload['shareable_type'])) {
                $v->errors()->add('shareable_type', 'The shareable_type field is required when shareable_id is present.');
            }
        });
    }
}

