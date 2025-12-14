<?php

namespace App\Http\Controllers\Impact;

use App\Http\Controllers\Controller;
use App\Services\Telemetry\RoleDashboardTelemetryService;
use Illuminate\Http\Request;
use Illuminate\View\View;

final class RoleDashboardImpactController extends Controller
{
    public function __construct(private readonly RoleDashboardTelemetryService $telemetry)
    {
    }

    public function __invoke(Request $request): View
    {
        $adoptionWindow = (int) $request->query('window_days', 14);
        $slaWindow = (int) $request->query('sla_window_days', 7);
        $slaThreshold = (float) $request->query('sla_threshold_ms', 400);

        return view('impact.role-dashboards', [
            'adoption' => $this->telemetry->adoptionTrend($adoptionWindow),
            'widgetSla' => $this->telemetry->widgetSlaSnapshot($slaWindow, $slaThreshold),
            'adoptionWindow' => $adoptionWindow,
            'slaWindow' => $slaWindow,
            'slaThreshold' => $slaThreshold,
        ]);
    }
}

