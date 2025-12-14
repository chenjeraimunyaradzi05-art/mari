<?php

namespace App\Http\Controllers\Api\Wellbeing;

use App\Http\Controllers\Controller;
use App\Support\Wellbeing\WellbeingTelemetryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class WellbeingTelemetryController extends Controller
{
    public function __construct(private readonly WellbeingTelemetryService $telemetry)
    {
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user, 403);

        $payload = $request->validate([
            'event' => ['required', 'string', 'max:64'],
            'context' => ['nullable', 'array'],
        ]);

        $this->telemetry->recordInteraction($user, $payload['event'], $payload['context'] ?? []);

        return response()->json([
            'status' => 'recorded',
        ]);
    }

    public function adoption(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user, 403);

        $windowDays = (int) $request->input('window_days', 30);
        $snapshot = $this->telemetry->adoptionSnapshot($windowDays);
        $snapshot['threshold_met'] = $this->telemetry->adoptionThresholdMet(60.0, $windowDays);

        return response()->json($snapshot);
    }
}

