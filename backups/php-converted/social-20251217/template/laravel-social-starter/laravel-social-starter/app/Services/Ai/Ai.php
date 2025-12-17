<?php

namespace App\Services\Ai;

interface Ai {
    public function caption(string $textContext): string;
    /** @return array<int,string> */
    public function tags(string $textContext): array;
    /** Return true if content passes moderation */
    public function moderate(string $textContext): bool;
}
