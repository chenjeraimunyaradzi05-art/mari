<?php

namespace App\Support\Messaging;

final class ShareMetadataFormatter
{
    public static function normalizeStructuredBody(mixed $structuredBody): ?array
    {
        if (!is_array($structuredBody)) {
            return null;
        }

        $normalized = $structuredBody;
        if (isset($normalized['blocks']) && is_array($normalized['blocks'])) {
            $normalized['blocks'] = collect($normalized['blocks'])
                ->map(function ($block) {
                    if (!is_array($block)) {
                        return null;
                    }

                    return self::orderBlock($block);
                })
                ->filter()
                ->values()
                ->all();
        }

        return $normalized;
    }

    public static function canonicalize(array $metadata): array
    {
        $priority = [
            'caption' => 1,
            'client' => 2,
            'tags' => 3,
            'structured_body' => 4,
        ];

        uksort($metadata, static function ($a, $b) use ($priority) {
            $rankA = $priority[$a] ?? PHP_INT_MAX;
            $rankB = $priority[$b] ?? PHP_INT_MAX;

            return $rankA <=> $rankB;
        });

        if (isset($metadata['structured_body']['blocks']) && is_array($metadata['structured_body']['blocks'])) {
            $metadata['structured_body']['blocks'] = array_map(function ($block) {
                if (!is_array($block)) {
                    return $block;
                }

                return self::orderBlock($block);
            }, $metadata['structured_body']['blocks']);
        }

        return $metadata;
    }

    private static function orderBlock(array $block): array
    {
        $ordered = [];
        foreach (['type', 'text'] as $key) {
            if (array_key_exists($key, $block)) {
                $ordered[$key] = $block[$key];
                unset($block[$key]);
            }
        }

        foreach ($block as $key => $value) {
            $ordered[$key] = $value;
        }

        return $ordered;
    }
}

