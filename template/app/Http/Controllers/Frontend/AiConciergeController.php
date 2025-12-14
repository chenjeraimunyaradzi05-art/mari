<?php

namespace App\Http\Controllers\Frontend;

use App\Contracts\AI\TextModel;
use App\Http\Controllers\Controller;
use App\Models\BankTransactionContext;
use App\Services\AiConciergeTelemetryService;
use App\Services\AiContextHistoryService;
use App\Services\Privacy\PrivacyTierService;
use App\Support\AiConcierge;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use JsonException;

final class AiConciergeController extends Controller
{
    public function __construct(
        private readonly TextModel $textModel,
        private readonly PrivacyTierService $privacyTiers,
        private readonly AiContextHistoryService $history,
        private readonly AiConciergeTelemetryService $telemetry,
    )
    {
    }

    public function index(Request $request): View
    {
        $contexts = $this->contextMetadata();
        $user = $request->user();
        $requestedContext = $this->resolveContextKey($request->query('context'), $contexts);
        $prompt = trim((string) $request->query('prompt', ''));
        $contextSummary = $this->decodeContextPayload($request->query('context_payload'));
        $barPayloads = [];

        if ($contextSummary && $requestedContext) {
            $selectionPreview = $contextSummary['selection'] ?? [];
            $barPayloads[$requestedContext] = [
                'context_payload' => $request->query('context_payload'),
                'prompt' => $prompt !== '' ? $prompt : null,
                'token' => $contextSummary['token'] ?? null,
                'filters' => $contextSummary['filters'] ?? [],
                'selection_preview' => $selectionPreview,
                'selection_total' => $contextSummary['selection_total'] ?? count($selectionPreview),
                'surface' => $contextSummary['surface'] ?? 'standalone_concierge',
                'resumed_from_history' => true,
            ];
        }
        $history = $user
            ? $this->history->latest($user->id, 5)->map(fn (BankTransactionContext $context) => $this->presentHistoryEntry($context))->all()
            : [];

        return view('ai.concierge', [
            'contexts' => $contexts,
            'requestedContext' => $requestedContext,
            'requestedPrompt' => $prompt !== '' ? $prompt : null,
            'contextSummary' => $contextSummary,
            'history' => $history,
            'aiConciergePayloads' => $barPayloads,
            'aiConciergeSurface' => 'standalone_concierge',
        ]);
    }

    public function respond(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user, 403);

        $contexts = $this->contextMetadata();

        $data = $request->validate([
            'context' => ['required', Rule::in(array_keys($contexts))],
            'question' => ['required', 'string', 'max:1200'],
            'surface' => ['nullable', 'string', 'max:64'],
            'selection_total' => ['nullable', 'integer', 'min:0', 'max:5000'],
            'filters' => ['nullable', 'array'],
            'history_token' => ['nullable', 'string', 'max:80'],
            'payload_token' => ['nullable', 'string', 'max:80'],
            'used_history_payload' => ['nullable', 'boolean'],
        ]);

        $systemPrompt = $this->systemPromptForContext($data['context']);
        $question = trim((string) $data['question']);
        $surface = $this->normaliseSurface($data['surface'] ?? null);
        $selectionTotal = isset($data['selection_total']) ? max(0, (int) $data['selection_total']) : null;
        $filters = $this->normaliseFilters($data['filters'] ?? []);
        $historyToken = $this->trimToken($data['history_token'] ?? null);
        $payloadToken = $this->trimToken($data['payload_token'] ?? null);
        $usedHistoryPayload = (bool) ($data['used_history_payload'] ?? false) || !empty($historyToken);

        $privacyDecision = $this->privacyTiers->guardAnalytics($user, 'ai_concierge', ['member_name', 'pronouns']);
        $allowName = in_array('member_name', $privacyDecision['granted'], true);
        $allowPronouns = in_array('pronouns', $privacyDecision['granted'], true);

        $memberName = $allowName
            ? ($user->preferred_name ?? $user->name ?? 'Member')
            : 'Member';
        $pronouns = $allowPronouns ? ($user->pronouns ?? 'she/her') : 'they/them';

        $prompt = sprintf(
            "%s\n\nMember info:\n- Name: %s\n- Pronouns: %s\n\nQuestion:\n\"\"\"%s\"\"\"\n\nReply in under 180 words using two short paragraphs or a few bullet points. Keep it warm, shame-free, and finish with a gentle reminder that this is educational only.",
            $systemPrompt,
            $memberName,
            $pronouns,
            $question
        );

        $this->telemetry->questionSent(
            $user->id,
            $data['context'],
            $surface,
            $question,
            $usedHistoryPayload,
            [
                'history_token' => $historyToken,
                'snapshot_token' => $payloadToken,
                'selection_total' => $selectionTotal,
                'filters' => $filters,
            ]
        );

        $answer = trim($this->textModel->generate($prompt, ['max_tokens' => 420]));

        if ($answer === '') {
            $answer = 'I need a little more detail to respond kindly. Could you share what part of the budget or statement feels confusing?';
        }

        Log::info('ai.concierge.interaction', [
            'user_id' => $user->id,
            'context' => $data['context'],
        ]);

        return response()->json([
            'answer' => $answer,
            'disclaimer' => $contexts[$data['context']]['guardrails'],
        ]);
    }

    public function budgetAdvice(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user, 403);

        $validated = $request->validate([
            'scope' => ['required', 'string', 'max:32'],
            'snapshot' => ['required', 'string', 'max:6000'],
        ]);

        $snapshot = trim(strip_tags($validated['snapshot']));
        $systemPrompt = (string) config('athena_ai.money_budget_system_prompt');

        $prompt = sprintf(
            "%s\n\nYou are reviewing an anonymised budget snapshot from a member inside the Athena budgeting workspace.\n\nReturn STRICT JSON with this shape (no commentary before or after it):\n{\n  \"headline\": \"Concise <= 18 words summarising the theme\",\n  \"insights\": [\"Up to three observations about income vs expenses vs debt\"],\n  \"nudges\": [\"Up to three shame-free ideas to explore next\"],\n  \"watch\": [\"Optional leak or risk reminders\" ],\n  \"why\": [\n    {\n      \"label\": \"Short label e.g. Income vs expenses\",\n      \"detail\": \"Optional numeric detail e.g. ≈ $4.5k vs $5.2k\",\n      \"reason\": \"Plain-language explanation of why the insight matters\"\n    }\n  ]\n}\n\nRules:\n- Offer reflective language (\"You could consider...\").\n- Do not mention banks, products, or providers.\n- Keep each bullet under 120 characters.\n- \"why\" may include up to three entries and should only appear when you have concrete numbers to reference.\n- If details are missing, say which details would help next time.\n\nScope: %s\nSnapshot:\n%s",
            $systemPrompt,
            $validated['scope'],
            $snapshot,
        );

        $raw = trim($this->textModel->generate($prompt, ['max_tokens' => 600]));
        $structured = $this->parseBudgetAdviceResponse($raw);

        if ($structured === null) {
            $structured = [
                'headline' => 'Athena needs a little more detail',
                'insights' => $raw !== ''
                    ? [Str::limit($raw, 240)]
                    : ['Please save a few budget lines, then refresh for a calmer review.'],
                'nudges' => [],
                'watch' => [],
                'why' => [],
            ];
        }

        Log::info('ai.concierge.money-budget', [
            'user_id' => $user->id,
            'scope' => $validated['scope'],
        ]);

        return response()->json([
            'headline' => $structured['headline'],
            'insights' => $structured['insights'],
            'nudges' => $structured['nudges'],
            'watch' => $structured['watch'],
            'why' => $structured['why'],
            'disclaimer' => (string) config('athena_ai.money_budget_disclaimer', 'Educational reflections only. Not financial advice or product recommendations.'),
        ]);
    }

    private function systemPromptForContext(string $context): string
    {
        return AiConcierge::systemPrompt($context);
    }

    /**
     * @return array[]
     *
     * @psalm-return array<string, array<string, mixed>>
     */
    private function contextMetadata(): array
    {
        return AiConcierge::contexts();
    }

    /**
     * @return (array|string)[]|null
     *
     * @psalm-return array{headline: string, insights: array, nudges: array, watch: array, why: array}|null
     */
    private function parseBudgetAdviceResponse(string $raw): array|null
    {
        $decoded = $this->decodeJsonFragment($raw);

        if (!$decoded) {
            return null;
        }

        return [
            'headline' => $this->stringValue($decoded['headline'] ?? 'Calm budget reflection'),
            'insights' => $this->stringList($decoded['insights'] ?? $decoded['observations'] ?? []),
            'nudges' => $this->stringList($decoded['nudges'] ?? $decoded['actions'] ?? []),
            'watch' => $this->stringList($decoded['watch'] ?? $decoded['risks'] ?? []),
            'why' => $this->normaliseWhyEntries($decoded['why'] ?? $decoded['why_data'] ?? []),
        ];
    }

    /**
     * @return (null|string)[][]
     *
     * @psalm-return list<array{detail: non-empty-string|null, label: string, reason: null|string}>
     */
    private function normaliseWhyEntries(mixed $entries): array
    {
        if (empty($entries)) {
            return [];
        }

        $arrayEntries = is_array($entries) ? $entries : [$entries];

        $normalised = [];

        foreach ($arrayEntries as $entry) {
            if (is_string($entry)) {
                $normalised[] = [
                    'label' => Str::limit($entry, 80),
                    'detail' => null,
                    'reason' => Str::limit($entry, 160),
                ];
                continue;
            }

            if (!is_array($entry)) {
                continue;
            }

            $label = $this->trimmedText($entry['label'] ?? $entry['title'] ?? null, 'Insight');
            $detail = $this->trimmedText($entry['detail'] ?? $entry['value'] ?? null, null, 80);
            $reason = $this->trimmedText($entry['reason'] ?? $entry['explanation'] ?? null, null, 160);

            $normalised[] = [
                'label' => $label,
                'detail' => $detail !== '' ? $detail : null,
                'reason' => $reason !== '' ? $reason : null,
            ];
        }

        return array_slice(array_values(array_filter($normalised, fn ($entry) => $entry['label'] !== '' || $entry['reason'] !== null)), 0, 3);
    }

    private function trimmedText(mixed $value, ?string $fallback = '', int $limit = 120): string
    {
        if ($value === null) {
            return $fallback ?? '';
        }

        $text = trim((string) $value);

        if ($text === '' && $fallback !== null) {
            $text = $fallback;
        }

        $text = $text === '' ? '' : Str::limit($text, $limit);

        return $text;
    }

    private function decodeJsonFragment(string $raw): ?array
    {
        $candidates = [trim($raw)];

        $start = strpos($raw, '{');
        $end = strrpos($raw, '}');

        if ($start !== false && $end !== false && $end > $start) {
            $candidates[] = substr($raw, $start, $end - $start + 1);
        }

        foreach ($candidates as $candidate) {
            if ($candidate === '') {
                continue;
            }

            try {
                $decoded = json_decode($candidate, true, 512, JSON_THROW_ON_ERROR);
            } catch (JsonException) {
                continue;
            }

            if (is_array($decoded)) {
                return $decoded;
            }
        }

        return null;
    }

    private function stringValue(mixed $value): string
    {
        $text = is_string($value) ? trim($value) : '';

        return Str::limit($text === '' ? 'Calm budget reflection' : $text, 140);
    }

    /**
     * @return string[]
     *
     * @psalm-return list<non-empty-string>
     */
    private function stringList(mixed $value): array
    {
        $items = [];

        if (is_string($value) || is_numeric($value)) {
            $items[] = trim((string) $value);
        } elseif (is_array($value)) {
            foreach ($value as $entry) {
                if (is_string($entry) || is_numeric($entry)) {
                    $items[] = trim((string) $entry);
                }
            }
        }

        $sanitised = array_values(array_filter(array_map(
            fn (string $line) => Str::limit($line, 160),
            $items
        ), fn (string $line) => $line !== ''));

        return array_slice($sanitised, 0, 4);
    }

    private function resolveContextKey(?string $contextKey, array $contexts): string|null
    {
        if (!$contextKey) {
            return null;
        }

        return array_key_exists($contextKey, $contexts) ? $contextKey : null;
    }

    /**
     * @return (((array|bool|float|mixed|null|string)[]|null)[]|int|mixed|null)[]|null
     *
     * @psalm-return array{token: mixed|null, generated_at: mixed|null, selection_total: int, filters: array<never, never>|mixed, selection: array<int, array{id: mixed|null, description: string, amount: float|null, direction: mixed|null, status: mixed|null, flagged: bool, category: mixed|null, account: mixed|null, posted_at: mixed|null, ai_suggestions: array}|null>, surface: mixed|null}|null
     */
    private function decodeContextPayload(?string $encoded): array|null
    {
        if (!$encoded) {
            return null;
        }

        $decoded = base64_decode($encoded, true);

        if ($decoded === false) {
            return null;
        }

        try {
            $payload = json_decode($decoded, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return null;
        }

        if (!is_array($payload)) {
            return null;
        }

        $selection = collect($payload['selection'] ?? [])
            ->take(8)
            ->map(function ($entry) {
                if (!is_array($entry)) {
                    return null;
                }

                return [
                    'id' => $entry['id'] ?? null,
                    'description' => Str::limit((string) ($entry['description'] ?? 'Transaction'), 100),
                    'amount' => isset($entry['amount']) ? (float) $entry['amount'] : null,
                    'direction' => $entry['direction'] ?? null,
                    'status' => $entry['status'] ?? null,
                    'flagged' => (bool) ($entry['flagged'] ?? false),
                    'category' => $entry['category'] ?? null,
                    'account' => $entry['account'] ?? null,
                    'posted_at' => $entry['posted_at_display'] ?? $entry['posted_at'] ?? null,
                    'ai_suggestions' => $this->describeSuggestions($entry['ai_suggestions'] ?? []),
                ];
            })
            ->filter()
            ->values()
            ->all();

        return [
            'token' => $payload['token'] ?? null,
            'generated_at' => $payload['generated_at'] ?? null,
            'selection_total' => (int) ($payload['selection_total'] ?? count($selection)),
            'filters' => $payload['filters'] ?? [],
            'selection' => $selection,
            'surface' => $payload['surface'] ?? null,
        ];
    }

    /**
     * @return string[]
     *
     * @psalm-return list<string>
     */
    private function describeSuggestions(mixed $suggestions): array
    {
        $chips = [];

        foreach ((array) $suggestions as $suggestion) {
            if (is_string($suggestion)) {
                $label = trim($suggestion);

                if ($label !== '') {
                    $chips[] = Str::limit($label, 50);
                }
                continue;
            }

            if (is_array($suggestion)) {
                $label = $suggestion['label']
                    ?? $suggestion['category']
                    ?? $suggestion['tag']
                    ?? null;

                if (!$label || trim((string) $label) === '') {
                    continue;
                }

                $confidence = $suggestion['confidence'] ?? null;

                if (is_numeric($confidence)) {
                    $confidence = (float) $confidence;
                    $confidence = $confidence > 1 ? $confidence : ($confidence * 100);
                    $label = sprintf('%s (%.0f%%)', $label, $confidence);
                }

                $chips[] = Str::limit((string) $label, 60);
            }
        }

        return array_slice($chips, 0, 4);
    }

    private function normaliseSurface(?string $value): string
    {
        $text = trim((string) $value);

        if ($text === '') {
            return 'standalone_concierge';
        }

        return Str::of($text)->lower()->limit(64)->value();
    }

    /**
     * @return (array|null|string)[]
     *
     * @psalm-return array<array<int, mixed>|null|string>
     */
    private function normaliseFilters(mixed $filters): array
    {
        if (!is_array($filters)) {
            return [];
        }

        return collect($filters)
            ->take(8)
            ->map(function ($value) {
                if (is_array($value)) {
                    return collect($value)->take(6)->values()->all();
                }

                if (is_scalar($value)) {
                    return (string) $value;
                }

                return null;
            })
            ->filter(fn ($value) => $value !== null && $value !== [])
            ->all();
    }

    private function trimToken(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $token = trim($value);

        if ($token === '') {
            return null;
        }

        return Str::of($token)->limit(80)->value();
    }

    /**
     * @return (array|int|null|string)[]
     *
     * @psalm-return array{token: string, surface: null|string, context_key: string, filters: array, selection_total: int, selection_preview: array, prompt: null|string, context_payload: string, resume_url: string, created_at: string, created_for_humans: string}
     */
    private function presentHistoryEntry(BankTransactionContext $context): array
    {
        $resumeQuery = array_filter([
            'context' => $context->context_key,
            'context_payload' => $context->context_payload,
            'prompt' => $context->prompt,
        ], fn ($value) => $value !== null && $value !== '');

        $resumeUrl = route('ai.concierge');

        if (!empty($resumeQuery)) {
            $resumeUrl .= '?' . http_build_query($resumeQuery);
        }

        return [
            'token' => $context->token,
            'surface' => $context->surface,
            'context_key' => $context->context_key,
            'filters' => $context->filters ?? [],
            'selection_total' => $context->selection_total,
            'selection_preview' => $context->selection_preview ?? [],
            'prompt' => $context->prompt,
            'context_payload' => $context->context_payload,
            'resume_url' => $resumeUrl,
            'created_at' => optional($context->created_at)->toIso8601String(),
            'created_for_humans' => optional($context->created_at)->diffForHumans(),
        ];
    }
}

