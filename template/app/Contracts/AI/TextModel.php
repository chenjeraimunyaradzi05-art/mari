<?php

namespace App\Contracts\AI;

/**
 * Abstraction for text-generation providers powering AI-driven features.
 */
interface TextModel
{
    /**
     * Produce a text response for the given prompt.
     *
     * @param string $prompt Free-form prompt supplied by the caller.
     * @param array<string, mixed> $options Optional provider hints (temperature, max_tokens, etc.).
     */
    public function generate(string $prompt, array $options = []): string;

    /**
     * Return an embedding vector for the provided text.
     *
     * @param string $text
     * @param array<string,mixed> $options
     */
    public function embed(string $text, array $options = []): array;

    /**
     * Stream generated text chunks back to a caller-provided callback.
     *
     * @param string $prompt
     * @param callable $onChunk
     * @param array<string,mixed> $options
     */
    public function stream(string $prompt, callable $onChunk, array $options = []): void;
}
