<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate;

use App\Enums\WomenRealEstate\CohortPersona;
use App\Enums\WomenRealEstate\GoalType;
use App\Models\WomenRealEstate\WomenCohortProfile;
use App\Models\WomenRealEstate\WomenGoalTracker;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

final class GoalTrackingService
{
    /**
     * @return (((array|float|string)[]|float|mixed)[]|float|mixed|null)[]
     *
     * @psalm-return array{overall_progress: float, primary_goal: array{type: mixed, label: mixed, target: float, current: float, progress: float, due_at: mixed}|null, upcoming_due: mixed|null, goals: array<array{type: string, label: string, target: float, current: float, progress: float, due_at: string, ai_nudges: array, status: string}>}
     */
    public function summary(WomenCohortProfile $profile): array
    {
        $trackers = $this->bootstrapTrackers($profile);

        if ($trackers->isEmpty()) {
            return [
                'overall_progress' => 0.0,
                'primary_goal' => null,
                'upcoming_due' => null,
                'goals' => [],
            ];
        }

        $ordered = $trackers->sortByDesc('progress_percent')->values();
        $primary = $ordered->first();

        $upcoming = $trackers
            ->filter(fn (WomenGoalTracker $tracker) => $tracker->due_at instanceof CarbonInterface && $tracker->due_at->isFuture())
            ->sortBy('due_at')
            ->first();

        $goals = $trackers->map(function (WomenGoalTracker $tracker) use ($profile) {
            $nudges = (array) ($tracker->ai_nudges ?? []);

            if ($nudges === [] && $profile->ai_insights !== null) {
                $nudges = (array) ($profile->ai_insights['recommendations'][$tracker->goal_type->value] ?? []);
            }

            return [
                'type' => $tracker->goal_type->value,
                'label' => $tracker->goal_type->label(),
                'target' => (float) $tracker->target_amount,
                'current' => (float) $tracker->current_amount,
                'progress' => (float) $tracker->progress_percent,
                'due_at' => optional($tracker->due_at)->toDateString(),
                'ai_nudges' => $nudges,
                'status' => $this->statusForTracker($tracker),
            ];
        })->all();

        return [
            'overall_progress' => round((float) $trackers->avg('progress_percent'), 1),
            'primary_goal' => $primary ? [
                'type' => $primary->goal_type->value,
                'label' => $primary->goal_type->label(),
                'target' => (float) $primary->target_amount,
                'current' => (float) $primary->current_amount,
                'progress' => (float) $primary->progress_percent,
                'due_at' => optional($primary->due_at)->toDateString(),
            ] : null,
            'upcoming_due' => optional($upcoming?->due_at)->diffForHumans(),
            'goals' => $goals,
        ];
    }

    /**
     * @psalm-return \Illuminate\Database\Eloquent\Collection<int, \Illuminate\Database\Eloquent\Model>
     */
    private function bootstrapTrackers(WomenCohortProfile $profile): \Illuminate\Database\Eloquent\Collection
    {
        $existing = $profile->goalTrackers()->get();

        if ($existing->isNotEmpty()) {
            return $existing;
        }

        $defaults = $this->defaultGoalsForPersona($profile->persona ?? CohortPersona::FIRST_HOME_BUYER);

        foreach ($defaults as $default) {
            $profile->goalTrackers()->create($default);
        }

        return $profile->goalTrackers()->get();
    }

    /**
     * @return array[]
     *
     * @psalm-return list{array, array}
     */
    private function defaultGoalsForPersona(CohortPersona $persona): array
    {
        $now = now();

        return match ($persona) {
            CohortPersona::LEARNER => [
                $this->goalPayload(GoalType::EDUCATION, 2500, $now->copy()->addMonths(6)),
                $this->goalPayload(GoalType::SAVINGS, 5000, $now->copy()->addYear()),
            ],
            CohortPersona::INVESTOR, CohortPersona::DEVELOPER => [
                $this->goalPayload(GoalType::INVESTMENT, 150000, $now->copy()->addMonths(9)),
                $this->goalPayload(GoalType::DEVELOPMENT, 300000, $now->copy()->addMonths(18)),
            ],
            default => [
                $this->goalPayload(GoalType::DEPOSIT, 75000, $now->copy()->addMonths(12)),
                $this->goalPayload(GoalType::SAVINGS, 25000, $now->copy()->addMonths(18)),
            ],
        };
    }

    /**
     * @return (CarbonInterface|float|int|string|string[])[]
     *
     * @psalm-return array{goal_type: string, target_amount: float, current_amount: float, progress_percent: 100|float, due_at: CarbonInterface, ai_nudges: list{string, string}}
     */
    private function goalPayload(GoalType $type, float $target, CarbonInterface $due): array
    {
        $current = round($target * 0.32, 2);

        return [
            'goal_type' => $type->value,
            'target_amount' => $target,
            'current_amount' => $current,
            'progress_percent' => min(100, round(($current / max($target, 1)) * 100, 2)),
            'due_at' => $due,
            'ai_nudges' => [
                'Focus on '.$type->label().' contributions this month.',
                'Set a reminder to review your '.$type->label().' plan next fortnight.',
            ],
        ];
    }

    private function statusForTracker(WomenGoalTracker $tracker): string
    {
        $progress = (float) $tracker->progress_percent;
        $due = $tracker->due_at;

        if ($progress >= 90) {
            return 'on-track';
        }

        if ($due instanceof CarbonInterface && $due->isPast()) {
            return 'overdue';
        }

        if ($progress >= 60) {
            return 'steady';
        }

        return Str::of($tracker->goal_type->label())->lower()->toString();
    }
}

