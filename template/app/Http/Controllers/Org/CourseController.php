<?php

namespace App\Http\Controllers\Org;

use App\Http\Controllers\Controller;
use App\Http\Resources\CourseResource;
use App\Models\Course;
use App\Models\OrganizationPage;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

final class CourseController extends Controller
{
	public function index(string $slug, Request $request): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
	{
		$page = OrganizationPage::published()
			->where('slug', $slug)
			->firstOrFail();

		$query = Course::query()
			->with(['page'])
			->where('provider_org_page_id', $page->id)
			->published();

		$filters = $this->resolveFilters($request);
		$query = $this->applyFilters($query, $filters);

		$perPage = (int) min(max((int) $request->integer('per_page', 12), 1), 50);
		$courses = $query
			->with(['intakes' => fn ($q) => $q->where('status', 'open')->orderBy('start_on')])
			->withCount([
				'intakes as open_intakes_count' => fn (Builder $builder) => $builder->where('status', 'open'),
				'apprenticeships',
			])
			->paginate($perPage)
			->appends($request->query());

		return CourseResource::collection($courses)->additional([
			'filters' => $filters,
		]);
	}

	public function show(string $slug, Course $course, Request $request): CourseResource
	{
		$page = OrganizationPage::published()
			->where('slug', $slug)
			->firstOrFail();

		if ((int) $course->provider_org_page_id !== (int) $page->id || $course->status !== 'published') {
			abort(404);
		}

		$course->loadMissing([
			'page',
			'intakes' => fn ($query) => $query->orderBy('start_on'),
			'apprenticeships' => fn ($query) => $query->where('status', 'published')->orderBy('title'),
		]);

		return CourseResource::make($course)->additional([
			'eligibility' => $this->buildEligibilityChecks($course, $request),
		]);
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

	/**
	 * @psalm-return Builder<\Illuminate\Database\Eloquent\Model>
	 */
	private function applyFilters(Builder $query, array $filters): Builder
	{
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
				$builder->where('status', 'open');

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
	 * @psalm-return list{0?: array{label: 'Applications Open'|'Prerequisite Review', passes: bool, context: string}, 1?: array{label: 'Applications Open', passes: bool, context: string}}
	 */
	private function buildEligibilityChecks(Course $course, Request $request): array
	{
		$checks = [];
		$user = $request->user();

		if ($course->prerequisites) {
			$checks[] = [
				'label' => 'Prerequisite Review',
				'passes' => $user ? $this->userMeetsPrerequisites($user, $course) : false,
				'context' => count($course->prerequisites).' prerequisites listed',
			];
		}

		$upcomingIntake = $course->intakes()->where('status', 'open')->orderBy('start_on')->first();
		if ($upcomingIntake) {
			$checks[] = [
				'label' => 'Applications Open',
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

