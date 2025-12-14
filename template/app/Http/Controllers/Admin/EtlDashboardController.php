<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SocialMetricsDaily;
use Carbon\Carbon;
use Illuminate\View\View;

final class EtlDashboardController extends Controller
{
    public function __invoke(): View
    {
        $latestCapture = SocialMetricsDaily::query()
            ->orderByDesc('captured_on')
            ->first();

        $latestDate = $latestCapture?->captured_on;
        $personasProcessed = $latestDate
            ? SocialMetricsDaily::query()->whereDate('captured_on', $latestDate)->count()
            : 0;

        $recentRuns = SocialMetricsDaily::query()
            ->selectRaw('captured_on, COUNT(*) as personas, SUM(total_connections) as connections, SUM(total_invites_sent) as invites')
            ->groupBy('captured_on')
            ->orderByDesc('captured_on')
            ->limit(7)
            ->get()
            ->map(function ($row) {
                return [
                    'captured_on' => Carbon::parse($row->captured_on)->toDateString(),
                    'personas' => (int) $row->personas,
                    'connections' => (int) $row->connections,
                    'invites' => (int) $row->invites,
                ];
            });

        $pipelines = [
            [
                'name' => 'Social Metrics Daily',
                'description' => 'Aggregates invite, connection, civility signals for personas.',
                'command' => 'php artisan social:metrics-daily',
                'last_run' => $latestDate ? $latestDate->toDateString() : '—',
                'personas_processed' => $personasProcessed,
            ],
        ];

        return view('admin.etl.dashboard', [
            'pipelines' => $pipelines,
            'latestDate' => $latestDate?->toDateString(),
            'personasProcessed' => $personasProcessed,
            'recentRuns' => $recentRuns,
        ]);
    }
}

