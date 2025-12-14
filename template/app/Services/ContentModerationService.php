<?php

namespace App\Services;

final class ContentModerationService
{
    /**
     * Very small, local moderation stub.
     * Returns an array of detected violation categories (if any).
     * Categories: pornographic, sexist, homophobic, racist, abusive
     */
    public function scanText(string $text): array
    {
        $provider = config('moderation.provider', 'local');

        if ($provider !== 'local') {
            // try to resolve a provider implementation
            $class = match ($provider) {
                'openai' => \App\Services\Moderation\OpenAIModerationProvider::class,
                default => null,
            };

            if ($class && class_exists($class)) {
                try {
                    $impl = app($class);
                    if (method_exists($impl, 'scanText')) {
                        return $impl->scanText($text);
                    }
                } catch (\Throwable $e) {
                    // fallback to local heuristics
                    \Illuminate\Support\Facades\Log::warning('Moderation provider failed: '.$e->getMessage());
                }
            }
        }
        $text = mb_strtolower($text);

        $violations = [];

        // combine provider/local heuristics with configured blocklist
        $pornPatterns = [
            'porn', 'xxx', 'nsfw', 'sex', 'nude', 'nudity', 'explicit', 'hardcore'
        ];

        // check configured blocklist (dictionary) patterns
        $dictionary = config('moderation.dictionaries.block', []);
        $dictionaryPatterns = array_keys($dictionary ?: []);

        foreach ($pornPatterns as $p) {
            if (str_contains($text, $p)) {
                $violations[] = ['type' => 'pornographic', 'match' => $p];
                break;
            }
        }

        // Check configured dictionary patterns
        foreach ($dictionaryPatterns as $term) {
            if ($term === '') continue;
            if (str_contains($text, mb_strtolower($term))) {
                $violations[] = ['type' => 'blocked_term', 'match' => $term, 'severity' => $dictionary[$term] ?? 'medium'];
                // do not break; collect all configured matches
            }
        }

        // sexist patterns
        $sexistPatterns = ['bitch', 'slut', 'whore', 'objectify', 'sexist'];
        foreach ($sexistPatterns as $p) {
            if (str_contains($text, $p)) {
                $violations[] = ['type' => 'sexist', 'match' => $p];
                break;
            }
        }

        // homophobic patterns
        $homophobicPatterns = ['fag', 'faggot', 'dyke', 'homophobic'];
        foreach ($homophobicPatterns as $p) {
            if (str_contains($text, $p)) {
                $violations[] = ['type' => 'homophobic', 'match' => $p];
                break;
            }
        }

        // racist patterns (example, not exhaustive)
        $racistPatterns = ['nigger', 'nigga', 'chink', 'spic', 'racist'];
        foreach ($racistPatterns as $p) {
            if (str_contains($text, $p)) {
                $violations[] = ['type' => 'racist', 'match' => $p];
                break;
            }
        }

        // abusive / threats
        $abusePatterns = ['kill you', 'i will kill', 'hurt you', 'rape'];
        foreach ($abusePatterns as $p) {
            if (str_contains($text, $p)) {
                $violations[] = ['type' => 'abusive', 'match' => $p];
                break;
            }
        }

        return $violations;
    }

    /**
     * Very small media heuristic — for now just checks filename / mime hints
     */
    public function scanFile(array $fileInfo): array
    {
        $provider = config('moderation.provider', 'local');

        if ($provider !== 'local') {
            $class = match ($provider) {
                'openai' => \App\Services\Moderation\OpenAIModerationProvider::class,
                default => null,
            };

            if ($class && class_exists($class)) {
                try {
                    $impl = app($class);
                    if (method_exists($impl, 'scanFile')) {
                        return $impl->scanFile($fileInfo);
                    }
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::warning('Moderation provider file-scan failed: '.$e->getMessage());
                }
            }
        }
        // $fileInfo should contain ['filename' => '', 'mime' => '']
        $filename = mb_strtolower($fileInfo['filename'] ?? '');
        $mime = mb_strtolower($fileInfo['mime'] ?? '');

        $violations = [];

        if (str_contains($filename, 'porn') || str_contains($filename, 'xxx')) {
            $violations[] = ['type' => 'pornographic', 'match' => $filename];
        }

        // basic image/video mime checks for crude heuristics
        if (str_contains($mime, 'image') || str_contains($mime, 'video')) {
            // no-op for now; real implementation would call a vision model
        }

        return $violations;
    }
}

