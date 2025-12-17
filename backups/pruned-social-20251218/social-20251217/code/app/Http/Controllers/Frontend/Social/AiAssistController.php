<?php

namespace App\Http\Controllers\Frontend\Social;

use App\Http\Controllers\Controller;
use App\Services\Ai\Ai;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AiAssistController extends Controller
{
    public function __construct(private readonly Ai $assistant)
    {
    }

    public function caption(Request $request): JsonResponse
    {
        $data = $request->validate([
            'context' => ['nullable', 'string', 'max:4000'],
        ]);

        return response()->json([
            'success' => true,
            'caption' => $this->assistant->caption((string) ($data['context'] ?? '')),
        ]);
    }

    public function tags(Request $request): JsonResponse
    {
        $data = $request->validate([
            'context' => ['nullable', 'string', 'max:4000'],
        ]);

        return response()->json([
            'success' => true,
            'tags' => $this->assistant->tags((string) ($data['context'] ?? '')),
        ]);
    }

    public function moderate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'context' => ['nullable', 'string', 'max:4000'],
        ]);

        return response()->json([
            'success' => true,
            'safe' => $this->assistant->moderate((string) ($data['context'] ?? '')),
        ]);
    }
}

