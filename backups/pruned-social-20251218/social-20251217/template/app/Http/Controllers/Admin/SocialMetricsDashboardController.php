<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SocialMetricsDaily;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

final class SocialMetricsDashboardController extends Controller
{
    public function index(Request $request): \Illuminate\Contracts\View\View
    {
        $dateInput = $request->input('date');
        $personaFilter = $request->input('persona_id');
        $targetDate = $dateInput ? Carbon::parse($dateInput) : Carbon::now();
        $displayDate = $targetDate->toDateString();
        $range = $this->normalizeRange($request->input('range'));
        $trendRange = $this->normalizeTrendRange((int) $request->input('trend_range', 7));
        $rangeStart = $range === 'rolling7'
            ? $targetDate->copy()->subDays(6)
            : $targetDate->copy();

        $metricsQuery = SocialMetricsDaily::query()
            ->with(['persona.user'])
            ->where('captured_on', $displayDate)
            ->orderByDesc('total_connections');

        if ($personaFilter) {
            $metricsQuery->where('persona_id', $personaFilter);
        }

        $totalCount = (clone $metricsQuery)->count();
        $records = (clone $metricsQuery)->limit(50)->get();

        $summaryRecords = SocialMetricsDaily::query()
            ->whereBetween('captured_on', [$rangeStart->toDateString(), $displayDate])
            ->when($range === 'day', fn ($query) => $query->where('captured_on', $displayDate))
            ->when($personaFilter, fn ($query) => $query->where('persona_id', $personaFilter))
            ->get();

        $summary = $this->buildSummary($summaryRecords, $range);

        $trendSeries = SocialMetricsDaily::query()
            ->selectRaw('captured_on, SUM(total_connections) as total_connections, SUM(total_invites_sent) as total_invites_sent')
            ->groupBy('captured_on')
            ->orderByDesc('captured_on')
            ->limit($trendRange)
            ->get()
            ->sortBy('captured_on')
            ->values();

        return view('admin.analytics.social-metrics', [
            'records' => $records,
            'summary' => $summary,
            'trendSeries' => $trendSeries,
            'selectedDate' => $displayDate,
            'personaFilter' => $personaFilter,
            'totalCount' => $totalCount,
            'range' => $range,
            'trendRange' => $trendRange,
            'rangeOptions' => [
                'day' => 'Daily snapshot',
                'rolling7' => 'Rolling 7-day',
            ],
            'trendOptions' => [7, 28],
        ]);
    }

    private function normalizeRange(?string $range): string
    {
        return in_array($range, ['rolling7'], true) ? 'rolling7' : 'day';
    }

    private function normalizeTrendRange(int $range): int
    {
        return in_array($range, [28], true) ? 28 : 7;
    }

    /**
     * @return (float|int|mixed|null)[]
     *
     * @psalm-return array{total_personas: int, total_connections: 0|mixed, invites_sent: 0|mixed, invites_accepted: 0|mixed, avg_civility: float|null}
     */
    private function buildSummary(Collection $records, string $range): array
    {
        if ($records->isEmpty()) {
            return [
                'total_personas' => 0,
                'total_connections' => 0,
                'invites_sent' => 0,
                'invites_accepted' => 0,
                'avg_civility' => null,
            ];
        }

        $personaGroups = $records->groupBy('persona_id');
        $connectionSum = $range === 'day'
            ? $records->sum('total_connections')
            : $personaGroups->map(fn ($group) => optional($group->sortBy('captured_on')->last())->total_connections ?? 0)->sum();
        $avgCivilityRaw = $records->avg('messaging_civility_score');

        return [
            'total_personas' => $range === 'day' ? $records->count() : $personaGroups->count(),
            'total_connections' => $connectionSum,
            'invites_sent' => $records->sum('total_invites_sent'),
            'invites_accepted' => $records->sum('total_invites_accepted'),
            'avg_civility' => $avgCivilityRaw === null ? null : round((float) $avgCivilityRaw, 2),
        ];
    }
}

