<?php

namespace App\Http\Requests\Messaging;

use App\Http\Requests\Messaging\Concerns\ValidatesAttachmentConstraints;
use App\Support\Messaging\AttachmentTypes;
use App\Support\Messaging\ShareableTypes;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * @property int|null $shareable_type
 * @property int|null $shareable_id
 * @property array<int, mixed>|null $caption
 * @property array<int, mixed>|null $client
 * @property array<int, mixed>|null $structured_body
 * @property array<int, mixed>|null $metadata
 * @property array<int, mixed>|null $attachments
 * @property array<int, mixed>|null $attachments.*
 * @property int|null $attachments.*.type
 * @property int|null $attachments.*.url
 * @property int|null $attachments.*.upload
 * @property int|null $attachments.*.size_kb
 * @property array<int, mixed>|null $attachments.*.meta
 */
final class StoreConversationShareRequest extends FormRequest
{
    use ValidatesAttachmentConstraints;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'shareable_type' => ['required', ShareableTypes::rule()],
            'shareable_id' => ['required', 'integer'],
            'caption' => ['nullable', 'string'],
            'client' => ['nullable', 'string'],
            'metadata' => ['nullable', 'array'],
            'structured_body' => ['nullable', 'array'],
            'attachments' => ['nullable', 'array'],
            'attachments.*.type' => ['nullable', AttachmentTypes::rule()],
            'attachments.*.url' => ['nullable', 'url'],
            'attachments.*.size_kb' => ['nullable', 'integer'],
        ];
    }

    public function withValidator(\Illuminate\Validation\Validator $validator): void
    {
        $validator->after(function ($v) {
            $attachments = $this->validated()['attachments'] ?? $this->input('attachments', []);

            foreach ($attachments as $idx => $attachment) {
                $hasType = !empty($attachment['type']);
                $hasUrl = !empty($attachment['url']);
                $hasUpload = array_key_exists('upload', $attachment) && $attachment['upload'] !== null;

                if ($hasType && !$hasUrl && !$hasUpload) {
                    $v->errors()->add(sprintf('attachments.%d.url', $idx), 'The url field is required when type is present.');
                }

                if ($hasUrl && !$hasType) {
                    $v->errors()->add(sprintf('attachments.%d.type', $idx), 'The type field is required when url is present.');
                }
            }

            $this->validateAttachmentConstraints($v, $attachments, 'attachments');
        });
    }
}

