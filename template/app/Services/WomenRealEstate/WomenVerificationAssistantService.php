<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate;

use App\Models\AIInferenceLog;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Throwable;

final class WomenVerificationAssistantService
{
    /**
     * @param array<string, mixed> $context
     *
     * @return (float|string|string[])[]
     *
     * @psalm-return array{reply: string, confidence: float, follow_ups: array<int, string>}
     */
    public function respond(?User $user, array $context, string $prompt): array
    {
        $prompt = trim($prompt);
        $lowerPrompt = Str::lower($prompt);
        $documentsMissing = array_values(array_filter((array) Arr::get($context, 'documents_missing', [])));
        $documentsPresent = array_values(array_filter((array) Arr::get($context, 'documents_present', [])));
        $regulator = (string) Arr::get($context, 'regulator', 'your regulator');
        $step = (string) Arr::get($context, 'step', 'profile');

        $segments = [];
        $segments[] = 'I\'m here to walk alongside you—let\'s keep things clear and confident.';

        if ($documentsMissing !== []) {
            $segments[] = $this->documentsGuidance($documentsMissing);
        } elseif (str_contains($lowerPrompt, 'document')) {
            $segments[] = 'You\'ll need to upload your current license certificate and a government-issued photo ID. We also recommend adding your professional indemnity insurance to speed up approvals.';
        }

        if (str_contains($lowerPrompt, 'how long') || str_contains($lowerPrompt, 'timeline')) {
            $segments[] = 'Most verifications wrap within 2-3 business days once we have clear scans. If a regulator needs manual confirmation it may take a little longer—we\'ll email you with next steps.';
        }

        if (str_contains($lowerPrompt, 'after') || str_contains($lowerPrompt, 'next')) {
            $segments[] = 'After you submit, our reviewers confirm your license with '.$regulator.' and run safety checks. You\'ll receive an email for approvals, requests for more info, or escalations.';
        }

        if ($documentsMissing === [] && ! str_contains($lowerPrompt, 'document')) {
            $segments[] = 'Right now your uploads look complete—double-check that the scans are legible and match the details you entered.';
        }

        if ($step === 'documents' && $documentsMissing !== []) {
            $segments[] = 'Finish the document step and you can proceed to references. The submit button appears on the final review screen once everything is in place.';
        }

        if ($step === 'review') {
            $segments[] = 'On the review screen make sure references look accurate and tick the declaration before you submit for the WomenRise team to assess.';
        }

        $reply = implode(' ', $segments);

        $followUps = $this->followUpSuggestions($documentsMissing, $documentsPresent);

        $this->logInteraction($user, $prompt, $context, $reply);

        return [
            'reply' => $reply,
            'confidence' => 0.72,
            'follow_ups' => $followUps,
        ];
    }

    /**
     * @param array<int, string> $missing
     */
    private function documentsGuidance(array $missing): string
    {
        $labels = array_map(
            fn (string $item): string => Str::of($item)->replace('_', ' ')->title()->toString(),
            $missing
        );

        return 'I still need a clear upload of your '.implode(' and ', $labels).'. Once those are in place we can keep your verification moving.';
    }

    /**
     * @param array<int, string> $missing
     * @param array<int, string> $present
     *
     * @return string[]
     *
     * @psalm-return list<'Can you remind me which files are still outstanding?'|'How can I speed up the review?'|'What happens once I have uploaded everything?'|'What should my references include?'|'Which documents are essential to get started?'>
     */
    private function followUpSuggestions(array $missing, array $present): array
    {
        $suggestions = [
            'How can I speed up the review?',
            'What should my references include?',
        ];

        if ($missing !== []) {
            $suggestions[] = 'Can you remind me which files are still outstanding?';
        } elseif ($present !== []) {
            $suggestions[] = 'What happens once I have uploaded everything?';
        } else {
            $suggestions[] = 'Which documents are essential to get started?';
        }

        return array_slice($suggestions, 0, 3);
    }

    /**
     * @param array<string, mixed> $context
     */
    private function logInteraction(?User $user, string $prompt, array $context, string $reply): void
    {
        try {
            AIInferenceLog::create([
                'pipeline' => 'agent_verification_assistant',
                'provider' => 'rule-engine',
                'prompt_version' => 'v1',
                'prompt_hash' => sha1($prompt),
                'tokens_in' => Str::of($prompt)->wordCount(),
                'tokens_out' => Str::of($reply)->wordCount(),
                'confidence' => 0.72,
                'result_status' => 'success',
                'cache_hit' => false,
                'override_flag' => false,
                'meta' => [
                    'user_id' => $user?->id,
                    'context' => $context,
                ],
            ]);
        } catch (Throwable) {
            // Logging should never block the assistant response.
        }
    }
}

