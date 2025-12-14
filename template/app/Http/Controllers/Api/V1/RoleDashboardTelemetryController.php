<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Telemetry\RoleDashboardTelemetryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class RoleDashboardTelemetryController extends Controller
{
    public function __construct(private readonly RoleDashboardTelemetryService $telemetry)
    {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user, 403);

        $adoptionWindow = (int) $request->query('window_days', 14);
        $slaWindow = (int) $request->query('sla_window_days', 7);
        $slaThreshold = (float) $request->query('sla_threshold_ms', 400);

        return response()->json([
            'adoption' => $this->telemetry->adoptionTrend($adoptionWindow),
            'widget_sla' => $this->telemetry->widgetSlaSnapshot($slaWindow, $slaThreshold),
        ]);
    }
}

