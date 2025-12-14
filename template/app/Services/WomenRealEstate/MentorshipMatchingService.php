<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate;

use App\Enums\WomenRealEstate\CohortPersona;
use App\Models\MentorshipProgram;
use App\Models\WomenRealEstate\WomenCohortProfile;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

final class MentorshipMatchingService
{
    /**
     * @return (float|int|null|string)[][]
     *
     * @psalm-return array<int, array{program_id: int, title: string, mentor: string, focus_area: null|string, fit_score: float, next_session: string, cta: 'Book study support session'|'Request intro call', summary: string}>
     */
    public function recommendations(WomenCohortProfile $profile, int $limit = 3): array
    {
        $programs = MentorshipProgram::query()
            ->with(['mentor:id,name', 'sessions' => function ($query): void {
                /** @var \Illuminate\Database\Eloquent\Builder $query */
                $query->orderBy('scheduled_for');
            }])
            ->latest('updated_at')
            ->limit($limit * 2)
            ->get();

        if ($programs->isEmpty()) {
            return [];
        }

        $persona = $profile->persona ?? CohortPersona::FIRST_HOME_BUYER;
        $preferences = collect($profile->preferences ?? []);

        return $programs
            ->map(function (MentorshipProgram $program) use ($profile, $persona, $preferences) {
                $criteria = collect($program->matching_criteria ?? []);
                $personaMatch = collect((array) $criteria->get('personas', []))
                    ->contains($persona->value);

                $focusMatch = $this->focusMatchScore($program, $preferences);
                $experienceScore = (float) ($program->impact_metrics['mentee_success_rate'] ?? 68);

                $fitScore = min(100, 40 + ($personaMatch ? 25 : 0) + $focusMatch + ($experienceScore / 5));

                $nextSession = $program->sessions
                    ->filter(fn ($session) => $session->scheduled_for?->isFuture())
                    ->sortBy('scheduled_for')
                    ->first();

                return [
                    'program_id' => $program->id,
                    'title' => $program->title,
                    'mentor' => $program->mentor?->name ?? 'WomenRise mentor',
                    'focus_area' => $program->focus_area,
                    'fit_score' => round($fitScore, 1),
                    'next_session' => optional($nextSession?->scheduled_for)->toDateTimeString(),
                    'cta' => $persona === CohortPersona::LEARNER ? 'Book study support session' : 'Request intro call',
                    'summary' => Str::limit((string) Arr::get($program->matching_criteria, 'summary'), 140),
                ];
            })
            ->sortByDesc('fit_score')
            ->take($limit)
            ->values()
            ->all();
    }

    private function focusMatchScore(MentorshipProgram $program, Collection $preferences): float
    {
        $personaFocus = collect((array) $preferences->get('learning_focus', []));
        $programFocus = collect((array) ($program->matching_criteria['focus'] ?? []));

        if ($personaFocus->isEmpty() || $programFocus->isEmpty()) {
            return 15.0;
        }

        $overlap = $personaFocus->intersect($programFocus)->count();

        if ($overlap === 0) {
            return 10.0;
        }

        return min(30.0, 15.0 + ($overlap * 5));
    }
}

