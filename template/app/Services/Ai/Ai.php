<?php

namespace App\Services\Ai;

interface Ai
{
    /**
     * Generate a social-friendly caption for the provided context.
     */
    public function caption(string $textContext): string;

    /**
     * Suggest lightweight topical tags derived from the provided context.
     *
     * @return array<int, string>
     */
    public function tags(string $textContext): array;

    /**
     * Determine if the provided content is safe for publishing.
     */
    public function moderate(string $textContext): bool;
}
