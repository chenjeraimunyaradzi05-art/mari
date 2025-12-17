<?php

namespace App\Services\Ai;

class DummyAiService implements Ai
{
    public function caption(string $textContext): string
    {
        $base = trim($textContext) ?: 'Sharing a moment from our community';
        return $base . ' — ✨ #WomenAtWork';
    }

    public function tags(string $textContext): array
    {
        return ['women','careers','education','apprenticeships','community'];
    }

    public function moderate(string $textContext): bool
    {
        $bad = ['hate','slur','violence'];
        foreach ($bad as $word) {
            if (stripos($textContext, $word) !== false) return false;
        }
        return true;
    }
}
