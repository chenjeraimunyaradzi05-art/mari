<?php

namespace App\Services\Social;

use App\Models\IncidentReport;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class MentorModerationService
{
    /**
     * @return int[]
     *
     * @psalm-return array{open_incidents: int, reports_last_day: int, repeat_offenders: int, pending_auto_suspensions: int}
     */
    public function summary(?int $repeatOffenderCount = null, ?int $pendingAutoSuspensions = null): array
    {
        return [
            'open_incidents' => $this->openIncidentsCount(),
            'reports_last_day' => $this->reportsLastDay(),
            'repeat_offenders' => $repeatOffenderCount ?? $this->repeatOffenderGroupCount(),
            'pending_auto_suspensions' => $pendingAutoSuspensions ?? $this->pendingAutoSuspensionsCount(),
        ];
    }

    /**
     * @psalm-return Collection<int, array{user_id: int, name: string, avatar: string, incidents: int, last_report_at: Carbon, auto_suspend_at: Carbon, eta_minutes: 0|float}>|Collection<never, never>|EloquentCollection<int, array{user_id: int, name: string, avatar: string, incidents: int, last_report_at: Carbon, auto_suspend_at: Carbon, eta_minutes: 0|float}>
     */
    public function repeatedOffenders(int $limit = 12, int $windowDays = 14): Collection|EloquentCollection
    {
        $threshold = $this->repeatOffenderThreshold();
        $windowStart = Carbon::now()->subDays($windowDays);

        $rows = IncidentReport::query()
            ->select([
                'subject_user_id',
                DB::raw('COUNT(*) as total'),
                DB::raw('MAX(created_at) as last_report_at'),
            ])
            ->whereNotNull('subject_user_id')
            ->where('created_at', '>=', $windowStart)
            ->groupBy('subject_user_id')
            ->having('total', '>=', $threshold)
            ->orderByDesc('total')
            ->limit($limit)
            ->get();

        if ($rows->isEmpty()) {
            return collect();
        }

        $users = User::query()
            ->whereIn('id', $rows->pluck('subject_user_id')->all())
            ->get(['id', 'name', 'avatar_path', 'image', 'primary_role'])
            ->keyBy('id');

        $autoMinutes = $this->autoSuspendMinutes();
        $now = Carbon::now();

        return $rows->map(function ($row) use ($users, $autoMinutes, $now) {
            $user = $users->get($row->subject_user_id);
            $lastReportAt = Carbon::parse($row->last_report_at);
            $autoSuspendAt = $lastReportAt->copy()->addMinutes($autoMinutes);
            $etaMinutes = $autoSuspendAt->greaterThan($now)
                ? $now->diffInMinutes($autoSuspendAt)
                : 0;

            return [
                'user_id' => (int) $row->subject_user_id,
                'name' => $user?->name ?? 'Unknown user',
                'avatar' => $user?->avatar_url ?? asset('images/default-avatar.png'),
                'incidents' => (int) $row->total,
                'last_report_at' => $lastReportAt,
                'auto_suspend_at' => $autoSuspendAt,
                'eta_minutes' => $etaMinutes,
            ];
        });
    }

    /**
     * @psalm-return Collection<int, array>|Collection<never, never>
     */
    public function suspensionTimers(?Collection $offenders = null, int $limit = 10): Collection
    {
        $source = $offenders ?? $this->repeatedOffenders($limit * 2);

        if ($source->isEmpty()) {
            return collect();
        }

        return $source
            ->map(function (array $offender) {
                $state = $offender['eta_minutes'] <= 0 ? 'ready' : 'countdown';

                return $offender + [
                    'state' => $state,
                    'countdown_label' => $offender['eta_minutes'] > 0
                        ? Carbon::now()->addMinutes($offender['eta_minutes'])->diffForHumans(null, true)
                        : 'Ready',
                ];
            })
            ->sortBy(fn ($offender) => $offender['auto_suspend_at'])
            ->take($limit)
            ->values();
    }

    /**
     * @psalm-return EloquentCollection<int, IncidentReport>
     */
    public function unresolvedIncidents(int $limit = 15): EloquentCollection
    {
        $severityOrder = "FIELD(severity, 'critical','high','medium','low')";

        return IncidentReport::query()
            ->with(['subject:id,name,avatar_path,image,primary_role', 'reporter:id,name'])
            ->where(function ($query) {
                $query->whereNull('resolved_at')
                    ->orWhereNotIn('status', ['resolved', 'closed', 'dismissed']);
            })
            ->orderByRaw($severityOrder)
            ->latest('created_at')
            ->limit($limit)
            ->get();
    }

    /**
     * @psalm-return int<1, max>
     */
    public function repeatOffenderThreshold(): int
    {
        return max(1, (int) config('social.moderation.repeat_offender_threshold', 2));
    }

    /**
     * @psalm-return int<30, max>
     */
    public function autoSuspendMinutes(): int
    {
        return max(30, (int) config('social.moderation.auto_suspend_minutes', 180));
    }

    protected function openIncidentsCount(): int
    {
        return IncidentReport::query()
            ->whereNull('resolved_at')
            ->count();
    }

    protected function reportsLastDay(): int
    {
        return IncidentReport::query()
            ->where('created_at', '>=', Carbon::now()->subDay())
            ->count();
    }

    protected function repeatOffenderGroupCount(): int
    {
        $threshold = $this->repeatOffenderThreshold();
        $windowStart = Carbon::now()->subDays(14);

        return IncidentReport::query()
            ->select('subject_user_id', DB::raw('COUNT(*) as total'))
            ->whereNotNull('subject_user_id')
            ->where('created_at', '>=', $windowStart)
            ->groupBy('subject_user_id')
            ->having('total', '>=', $threshold)
            ->get()
            ->count();
    }

    protected function pendingAutoSuspensionsCount(): int
    {
        $autoWindowStart = Carbon::now()->subMinutes($this->autoSuspendMinutes());

        return IncidentReport::query()
            ->whereNotNull('subject_user_id')
            ->where('created_at', '>=', $autoWindowStart)
            ->distinct('subject_user_id')
            ->count('subject_user_id');
    }
}

