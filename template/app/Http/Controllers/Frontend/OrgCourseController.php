<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\OrganizationPage;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Illuminate\View\View;

final class OrgCourseController extends Controller
{
    public function index(string $slug, Request $request): View
    {
        $page = $this->resolvePage($slug);

        $filters = $this->resolveFilters($request);

        $courses = $this->buildCourseQuery($page->id, $filters)
            ->with(['intakes' => fn ($query) => $query->open()->orderBy('start_on')])
            ->withCount([
                'intakes as open_intakes_count' => fn (Builder $builder) => $builder->open(),
                'apprenticeships',
            ])
            ->paginate(9)
            ->appends($request->query());

        return view('frontend.org-pages.courses.index', [
            'page' => $page,
            'courses' => $courses,
            'filters' => $filters,
        ]);
    }

    public function show(string $slug, Course $course, Request $request): View
    {
        $page = $this->resolvePage($slug);

        abort_if((int) $course->provider_org_page_id !== (int) $page->id || $course->status !== 'published', 404);

        $course->loadMissing([
            'intakes' => fn ($query) => $query->orderBy('start_on'),
            'apprenticeships' => fn ($query) => $query->where('status', 'published')->orderBy('title'),
        ]);

        $relatedCourses = Course::query()
            ->published()
            ->where('provider_org_page_id', $page->id)
            ->where('id', '!=', $course->id)
            ->inRandomOrder()
            ->limit(3)
            ->get();

        $eligibilityChecks = $this->buildEligibilityChecks($course, $request);

        return view('frontend.org-pages.courses.show', [
            'page' => $page,
            'course' => $course,
            'eligibilityChecks' => $eligibilityChecks,
            'relatedCourses' => $relatedCourses,
        ]);
    }

    private function resolvePage(string $slug): OrganizationPage
    {
        return OrganizationPage::with(['company'])
            ->withCount('followers')
            ->published()
            ->where('slug', $slug)
            ->firstOrFail();
    }

    /**
     * @return (\Illuminate\Support\Carbon|array|bool|int|null|string)[]
     *
     * @psalm-return array{mode: array<int, mixed>, type: array<int, mixed>, price_max_cents: int, duration_max_weeks: int, query: string, start_after: \Illuminate\Support\Carbon|null, scholarship: bool}
     */
    private function resolveFilters(Request $request): array
    {
        return [
            'mode' => $request->collect('mode')->filter()->values()->all(),
            'type' => $request->collect('type')->filter()->values()->all(),
            'price_max_cents' => $request->integer('price_max_cents'),
            'duration_max_weeks' => $request->integer('duration_max_weeks'),
            'query' => Str::squish((string) $request->get('q', '')),
            'start_after' => $request->date('start_after'),
            'scholarship' => $request->boolean('scholarship'),
        ];
    }

    private function buildCourseQuery(int $orgPageId, array $filters): Builder
    {
        $query = Course::query()
            ->published()
            ->where('provider_org_page_id', $orgPageId);

        if ($filters['mode'] !== []) {
            $query->whereIn('mode', Arr::wrap($filters['mode']));
        }

        if ($filters['type'] !== []) {
            $query->whereIn('type', Arr::wrap($filters['type']));
        }

        if (! empty($filters['price_max_cents'])) {
            $query->where('cost_cents', '<=', $filters['price_max_cents']);
        }

        if (! empty($filters['duration_max_weeks'])) {
            $query->where(function (Builder $builder) use ($filters): void {
                $builder->whereNull('duration_weeks')
                    ->orWhere('duration_weeks', '<=', $filters['duration_max_weeks']);
            });
        }

        if (! empty($filters['query'])) {
            $query->whereFullText(['title', 'summary'], $filters['query']);
        }

        if (! empty($filters['start_after']) || ! empty($filters['scholarship'])) {
            $query->whereHas('intakes', function (Builder $builder) use ($filters): void {
                $builder->open();

                if (! empty($filters['start_after'])) {
                    $builder->whereDate('start_on', '>=', $filters['start_after']);
                }

                if (! empty($filters['scholarship'])) {
                    $builder->whereNotNull('scholarships');
                }
            });
        }

        return $query->orderByDesc('published_at')->orderBy('title');
    }

    /**
     * @return (bool|string)[][]
     *
     * @psalm-return list{0?: array{label: 'Applications open'|'Prerequisite review', passes: bool, context: string}, 1?: array{label: 'Applications open', passes: bool, context: string}}
     */
    private function buildEligibilityChecks(Course $course, Request $request): array
    {
        $checks = [];
        $user = $request->user();

        if ($course->prerequisites) {
            $checks[] = [
                'label' => 'Prerequisite review',
                'passes' => $user ? $this->userMeetsPrerequisites($user, $course) : false,
                'context' => count($course->prerequisites).' prerequisites listed',
            ];
        }

        $upcomingIntake = $course->intakes()->open()->orderBy('start_on')->first();
        if ($upcomingIntake) {
            $checks[] = [
                'label' => 'Applications open',
                'passes' => now()->lte(optional($upcomingIntake->apply_by) ?? now()->addYear()),
                'context' => 'Apply by '.$upcomingIntake->apply_by?->format('M j, Y'),
            ];
        }

        return $checks;
    }

    private function userMeetsPrerequisites($user, Course $course): bool
    {
        $prerequisites = collect($course->prerequisites ?? [])
            ->flatMap(fn ($item) => is_array($item) ? $item : [$item])
            ->map(fn ($item) => Str::lower((string) $item))
            ->filter();

        if ($prerequisites->isEmpty()) {
            return true;
        }

        $resumeSkills = collect(optional($user->candidate)->skills ?? [])
            ->map(fn ($skill) => Str::lower(is_array($skill) ? ($skill['name'] ?? '') : (string) $skill))
            ->filter();

        return $prerequisites->every(fn ($requirement) => $resumeSkills->contains($requirement));
    }
}

