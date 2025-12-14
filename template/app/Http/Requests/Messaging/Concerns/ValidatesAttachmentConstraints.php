<?php

namespace App\Http\Requests\Messaging\Concerns;

use App\Support\Messaging\AttachmentTypes;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Validator;

trait ValidatesAttachmentConstraints
{
    protected function validateAttachmentConstraints(Validator $validator, array $attachments, string $attributePrefix): void
    {
        foreach ($attachments as $index => $attachment) {
            $type = $attachment['type'] ?? null;

            if (!$type || !AttachmentTypes::has($type)) {
                continue;
            }

            $definition = AttachmentTypes::definition($type);

            $this->validateScheme($validator, $definition, $attachment, $attributePrefix, $index);
            $this->validateSize($validator, $definition, $attachment, $attributePrefix, $index);
        }
    }

    private function validateScheme(Validator $validator, array $definition, array $attachment, string $prefix, int $index): void
    {
        if (!isset($definition['allowed_schemes']) || empty($definition['allowed_schemes'])) {
            return;
        }

        $url = $attachment['url'] ?? null;

        if (!$url) {
            return;
        }

        $scheme = parse_url($url, PHP_URL_SCHEME);

        if (!$scheme || !in_array($scheme, $definition['allowed_schemes'], true)) {
            $validator->errors()->add(
                sprintf('%s.%d.url', $prefix, $index),
                sprintf(
                    'The %s.%d.url scheme must be one of: %s.',
                    $prefix,
                    $index,
                    implode(', ', $definition['allowed_schemes'])
                )
            );
        }
    }

    private function validateSize(Validator $validator, array $definition, array $attachment, string $prefix, int $index): void
    {
        if (!isset($definition['max_size_kb'])) {
            return;
        }

        $size = $this->resolveAttachmentSize($attachment);

        if ($size === null) {
            return;
        }

        $max = $definition['max_size_kb'];

        if ($size > $max) {
            $validator->errors()->add(
                sprintf('%s.%d.size_kb', $prefix, $index),
                sprintf('The %s.%d.size_kb may not exceed %d KB for %s attachments.', $prefix, $index, $max, $attachment['type'])
            );
        }
    }

    private function resolveAttachmentSize(array $attachment): ?int
    {
        if (array_key_exists('size_kb', $attachment) && $attachment['size_kb'] !== null) {
            return (int) $attachment['size_kb'];
        }

        $upload = $attachment['upload'] ?? null;

        if ($upload instanceof UploadedFile) {
            return (int) ceil($upload->getSize() / 1024);
        }

        return null;
    }
}
