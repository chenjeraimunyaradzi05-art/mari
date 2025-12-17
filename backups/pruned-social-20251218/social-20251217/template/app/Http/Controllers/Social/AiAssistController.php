<?php

namespace App\Http\Controllers\Social;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AiAssistController extends Controller
{
    /**
     * Provide an AI-assisted caption suggestion for the given context.
     */
    public function caption(Request $request): JsonResponse
    {
        $data = $request->validate([
            'context' => ['nullable', 'string', 'max:2000'],
        ]);

        $context = (string) ($data['context'] ?? '');
        $caption = $context !== ''
            ? $context . ' — ✨ Women supporting women'
            : 'Sharing today’s moment — ✨ Women supporting women';

        return response()->json([
            'success' => true,
            'caption' => $caption,
        ]);
    }

    /**
     * Return a set of AI-generated tags for the provided context.
     */
    public function tags(Request $request): JsonResponse
    {
        $data = $request->validate([
            'context' => ['nullable', 'string', 'max:2000'],
        ]);

        $tags = $this->generateTags($data['context'] ?? '');

        return response()->json([
            'success' => true,
            'tags' => $tags,
        ]);
    }

    /**
     * Run lightweight moderation and report whether content is safe.
     */
    public function moderate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'context' => ['nullable', 'string', 'max:2000'],
        ]);

        $isSafe = $this->passesModeration($data['context'] ?? '');

        return response()->json([
            'success' => true,
            'safe' => $isSafe,
        ]);
    }

    /**
     * Lightweight keyword-based tag generator.
     *
     * @return string[]
     *
     * @psalm-return non-empty-list<'apprenticeships'|'careers'|'education'|'women'|'women-in-tech'|'women-leaders'>
     */
    protected function generateTags(?string $context): array
    {
        $base = ['women', 'careers', 'education'];
        $context = strtolower((string) $context);

        if (str_contains($context, 'tech')) {
            $base[] = 'women-in-tech';
        }
        if (str_contains($context, 'apprentice')) {
            $base[] = 'apprenticeships';
        }
        if (str_contains($context, 'leadership')) {
            $base[] = 'women-leaders';
        }

        return array_values(array_unique($base));
    }

    protected function passesModeration(?string $context): bool
    {
        $context = strtolower((string) $context);
        $blocked = ['hate', 'violence', 'harass'];

        foreach ($blocked as $word) {
            if (str_contains($context, $word)) {
                return false;
            }
        }

        return true;
    }
}

