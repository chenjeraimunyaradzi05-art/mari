<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Social\SocialInsightsService;
use App\Services\Social\SocialMetricsHeatmapService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class SocialApiController extends Controller
{
    private const JSON_OPTIONS = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION;

    public function __construct(
        private SocialInsightsService $insights,
        private SocialMetricsHeatmapService $heatmapService,
    )
    {
    }

    public function connectionRecommendations(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $validated = $request->validate([
            'limit' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);

        $limit = (int) ($validated['limit'] ?? 10);

        $data = $this->insights
            ->connectionRecommendations($user, $limit)
            ->take($limit)
            ->values()
            ->all();

        return $this->jsonResponse($data);
    }

    public function suggestedConnections(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $validated = $request->validate([
            'limit' => ['sometimes', 'integer', 'min:1', 'max:25'],
        ]);

        $limit = (int) ($validated['limit'] ?? 5);

        $data = $this->insights
            ->suggestedConnections($user, $limit)
            ->take($limit)
            ->values()
            ->all();

        return $this->jsonResponse($data);
    }

    public function networkClusters(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $validated = $request->validate([
            'limit' => ['sometimes', 'integer', 'min:1', 'max:10'],
        ]);

        $limit = (int) ($validated['limit'] ?? 5);

        $payload = $this->insights->networkClusters($user, $limit);

        return $this->jsonResponse($payload);
    }

    public function connectionPulse(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $payload = $this->insights->connectionPulse($user);

        return $this->jsonResponse($payload);
    }

    public function connectionMomentum(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $validated = $request->validate([
            'weeks' => ['sometimes', 'integer', 'min:2', 'max:12'],
        ]);

        $weeks = (int) ($validated['weeks'] ?? 6);

        $payload = $this->insights->connectionMomentum($user, $weeks);

        return $this->jsonResponse($payload);
    }

    public function connectionStatusBreakdown(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $payload = $this->insights->connectionStatusBreakdown($user);

        return $this->jsonResponse($payload);
    }

    public function profileStrength(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $payload = $this->insights->profileStrength($user);

        return $this->jsonResponse($payload);
    }

    public function jobMatch(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $payload = $this->insights->jobMatch($user);

        return $this->jsonResponse($payload);
    }

    public function bestPostingTime(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $payload = $this->insights->bestPostingTime($user);

        return $this->jsonResponse($payload);
    }

    public function analyticsSummary(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $summary = $this->insights->analyticsSummary($user);

        return $this->jsonResponse($summary);
    }

    public function analyticsHeatmap(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $validated = $request->validate([
            'date' => ['sometimes', 'date_format:Y-m-d'],
            'heatmap_range' => ['sometimes', 'in:7,30'],
            'cohort' => ['sometimes', 'array', 'max:3'],
            'cohort.*' => ['string', 'max:64'],
        ]);

        $targetDate = isset($validated['date'])
            ? CarbonImmutable::createFromFormat('Y-m-d', $validated['date'])->startOfDay()
            : CarbonImmutable::now()->startOfDay();

        $range = (int) ($validated['heatmap_range'] ?? 7);

        $cohortFilters = collect($validated['cohort'] ?? [])
            ->map(fn ($value) => trim((string) $value))
            ->filter()
            ->map(fn ($value) => Str::lower($value))
            ->unique()
            ->values();

        $payload = $this->heatmapService->build($targetDate, $range, $cohortFilters);

        return $this->jsonResponse($payload);
    }

    public function engagementTimeline(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $validated = $request->validate([
            'weeks' => ['sometimes', 'integer', 'min:1', 'max:12'],
        ]);

        $weeks = (int) ($validated['weeks'] ?? 6);

        $payload = $this->insights->engagementTimeline($user, $weeks);

        return $this->jsonResponse($payload);
    }

    public function contentHighlights(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $validated = $request->validate([
            'limit' => ['sometimes', 'integer', 'min:1', 'max:10'],
        ]);

        $limit = (int) ($validated['limit'] ?? 5);

        $payload = $this->insights->contentHighlights($user, $limit);

        return $this->jsonResponse($payload);
    }

    public function hashtagSuggestions(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $validated = $request->validate([
            'topic' => ['sometimes', 'nullable', 'string', 'max:120'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:20'],
        ]);

        $topic = $validated['topic'] ?? null;
        $limit = (int) ($validated['limit'] ?? 8);

        $suggestions = $this->insights->hashtagSuggestions($topic, $limit);

        return $this->jsonResponse($suggestions);
    }

    private function jsonResponse(array $payload, int $status = 200, array $headers = []): JsonResponse
    {
        return response()->json(['data' => $payload], $status, $headers, self::JSON_OPTIONS);
    }
}

