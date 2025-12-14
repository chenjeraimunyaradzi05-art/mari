<?php

namespace App\Support\Messaging;

use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\In;

final class AttachmentTypes
{
    private const DEFINITIONS = [
        'image' => [
            'max_size_kb' => 5_120,
            'allowed_schemes' => ['https'],
            'mime_types' => ['image/png', 'image/jpeg', 'image/webp'],
            'description' => 'PNG, JPEG, or WebP images optimized for chat previews.',
        ],
        'file' => [
            'max_size_kb' => 10_240,
            'allowed_schemes' => ['https'],
            'mime_types' => [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ],
            'description' => 'General documents such as PDF or DOCX shared via secure links.',
        ],
        'video' => [
            'max_size_kb' => 51_200,
            'allowed_schemes' => ['https'],
            'mime_types' => ['video/mp4', 'video/webm', 'video/quicktime'],
            'description' => 'Short-form clips up to 50 MB (MP4, WebM, MOV).',
        ],
    ];

    /**
     * @return string[]
     *
     * @psalm-return non-empty-list<'file'|'image'|'video'>
     */
    public static function allowed(): array
    {
        return array_keys(self::DEFINITIONS);
    }

    public static function rule(): In
    {
        return Rule::in(self::allowed());
    }

    /**
     * @return (int|string|string[])[][]
     *
     * @psalm-return array{image: array{max_size_kb: 5120, allowed_schemes: list{'https'}, mime_types: list{'image/png', 'image/jpeg', 'image/webp'}, description: 'PNG, JPEG, or WebP images optimized for chat previews.'}, file: array{max_size_kb: 10240, allowed_schemes: list{'https'}, mime_types: list{'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}, description: 'General documents such as PDF or DOCX shared via secure links.'}, video: array{max_size_kb: 51200, allowed_schemes: list{'https'}, mime_types: list{'video/mp4', 'video/webm', 'video/quicktime'}, description: 'Short-form clips up to 50 MB (MP4, WebM, MOV).'}}
     */
    public static function definitions(): array
    {
        return self::DEFINITIONS;
    }

    /**
     * @return (int|string|string[])[]
     *
     * @psalm-return array{max_size_kb?: 5120|10240|51200, allowed_schemes?: list{'https'}, mime_types?: list{'application/pdf'|'image/png'|'video/mp4', 'application/msword'|'image/jpeg'|'video/webm', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'|'image/webp'|'video/quicktime'}, description?: 'General documents such as PDF or DOCX shared via secure links.'|'PNG, JPEG, or WebP images optimized for chat previews.'|'Short-form clips up to 50 MB (MP4, WebM, MOV).'}
     */
    public static function definition(string $type): array
    {
        return self::DEFINITIONS[$type] ?? [];
    }

    public static function has(string $type): bool
    {
        return array_key_exists($type, self::DEFINITIONS);
    }
}

