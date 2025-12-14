<?php

namespace App\Http\Controllers\Api\Business;

use App\Exceptions\AthenaDocumentRateLimitException;
use App\Http\Controllers\Controller;
use App\Services\Business\AthenaAiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

final class BusinessDocumentAiController extends Controller
{
    public function __construct(private readonly AthenaAiService $ai)
    {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $promptKeys = array_keys(config('business_entities.ai_prompts', []));

        $data = $request->validate([
            'template' => ['required', 'string', Rule::in($promptKeys)],
            'prompt' => ['required', 'string', 'max:8000'],
            'context' => ['nullable', 'array'],
        ]);

        $user = $request->user();

        $contextToken = (string) Str::uuid();
        $context = array_merge($data['context'] ?? [], [
            'template' => $data['template'],
            'user_id' => $user?->id,
            'user_email' => $user?->email,
            'context_token' => $contextToken,
        ]);

        try {
            $draft = $this->ai->draftBusinessDocument($data['prompt'], $context);
        } catch (AthenaDocumentRateLimitException $exception) {
            return response()->json([
                'message' => 'Too many Athena drafting requests. Please try again shortly.',
                'retry_after' => $exception->retryAfter,
            ], 429)->withHeaders(['Retry-After' => $exception->retryAfter]);
        }

        Log::info('ai.business_documents.generated', [
            'context_token' => $contextToken,
            'template' => $data['template'],
            'user_id' => $user?->id,
        ]);

        return response()->json([
            'context_token' => $contextToken,
            'template' => $data['template'],
            'draft' => $draft,
            'meta' => [
                'length' => mb_strlen($draft),
            ],
        ]);
    }
}

