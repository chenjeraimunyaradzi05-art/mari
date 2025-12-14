<?php

namespace App\Services\Careers;

use App\Models\ApprenticeshipProgram;
use App\Models\CareerInterest;
use App\Models\Course;
use App\Models\Job;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

final class CareerInterestMatchService
{
    /**
     * @psalm-return array<int, never>
     */
    public function findMatches(CareerInterest $interest, int $limit = 5): array
    {
        $limit = max(1, $limit);
        $matches = collect();

        if ($this->shouldScanJobs($interest)) {
            $matches = $matches->merge($this->mapJobs($this->searchJobs($interest, $limit)));
        }

        if ($this->shouldScanCourses($interest)) {
            $matches = $matches->merge($this->mapCourses($this->searchCourses($interest, max(1, (int) ceil($limit / 2)))));
        }

        if ($this->shouldScanApprenticeships($interest)) {
            $matches = $matches->merge($this->mapApprenticeships($this->searchApprenticeships($interest, max(1, (int) ceil($limit / 2)))));
        }

        return $matches
            ->sortByDesc(fn (array $match) => $match['weight'])
            ->unique('link')
            ->take($limit)
            ->map(fn (array $match) => Arr::except($match, ['weight']))
            ->values()
            ->all();
    }

    private function shouldScanJobs(CareerInterest $interest): bool
    {
        return in_array($interest->pathway_type, [
            'job',
            'public_sector',
            'trade',
            'other',
        ], true);
    }

    private function shouldScanCourses(CareerInterest $interest): bool
    {
        return in_array($interest->pathway_type, [
            'tafe_course',
            'university_course',
        ], true);
    }

    private function shouldScanApprenticeships(CareerInterest $interest): bool
    {
        return in_array($interest->pathway_type, [
            'apprenticeship',
            'traineeship',
            'trade',
        ], true);
    }

    private function searchJobs(CareerInterest $interest, int $limit): Collection
    {
        $terms = $this->keywords($interest);
        $locations = $this->locations($interest);

        $query = Job::query()
            ->select([
                'id',
                'title',
                'slug',
                'company_name',
                'address',
                'description',
                'deadline',
                'created_at',
                'min_salary',
                'max_salary',
            ])
            ->where('status', 'active')
            ->when($terms->isNotEmpty(), function ($builder) use ($terms) {
                $builder->where(function ($termQuery) use ($terms) {
                    foreach ($terms as $term) {
                        $termQuery->orWhere('title', 'like', "%{$term}%");
                    }
                });
            })
            ->when(! empty($locations), function ($builder) use ($locations) {
                $builder->where(function ($locationQuery) use ($locations) {
                    foreach ($locations as $location) {
                        $locationQuery->orWhere('address', 'like', "%{$location}%");
                    }
                });
            })
            ->orderByDesc('created_at')
            ->limit($limit);

        return $query->get();
    }

    /**
     * @psalm-return Collection<array-key, array{type: 'job', title: string, provider: null|string, location: null|string, deadline: string, summary: string, link: string, salary: null|string, weight: float|int|string}>
     */
    private function mapJobs(Collection $jobs): Collection
    {
        return $jobs->map(function (Job $job) {
            $link = $job->slug ? route('jobs.show', $job->slug) : route('jobs.index');

            return [
                'type' => 'job',
                'title' => $job->title,
                'provider' => $job->company_name,
                'location' => $job->address,
                'deadline' => $job->deadline,
                'summary' => Str::limit(strip_tags((string) $job->description), 150),
                'link' => $link,
                'salary' => $this->formatSalary($job->min_salary, $job->max_salary),
                'weight' => ($job->created_at?->timestamp) ?? now()->timestamp,
            ];
        });
    }

    private function searchCourses(CareerInterest $interest, int $limit): Collection
    {
        $terms = $this->keywords($interest);
        $locations = $this->locations($interest);

        return Course::query()
            ->with('page:id,slug,name')
            ->published()
            ->select(['id', 'provider_org_page_id', 'title', 'slug', 'summary', 'location', 'mode', 'created_at'])
            ->when($terms->isNotEmpty(), function ($builder) use ($terms) {
                $builder->where(function ($termQuery) use ($terms) {
                    foreach ($terms as $term) {
                        $termQuery->orWhere('title', 'like', "%{$term}%");
                    }
                });
            })
            ->when(! empty($locations), function ($builder) use ($locations) {
                $builder->where(function ($locationQuery) use ($locations) {
                    foreach ($locations as $location) {
                        $locationQuery->orWhere('location', 'like', "%{$location}%");
                    }
                });
            })
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();
    }

    /**
     * @psalm-return Collection<array-key, array{type: 'course', title: string, provider: null|string, location: null|string, mode: string, summary: string, link: string, weight: float|int|string}>
     */
    private function mapCourses(Collection $courses): Collection
    {
        return $courses->map(function (Course $course) {
            $link = $course->page && $course->slug
                ? route('organizations.courses.show', ['slug' => $course->page->slug, 'course' => $course->slug])
                : route('careers.wishlist');

            return [
                'type' => 'course',
                'title' => $course->title,
                'provider' => $course->page?->name,
                'location' => $course->location,
                'mode' => $course->mode,
                'summary' => Str::limit(strip_tags((string) $course->summary), 150),
                'link' => $link,
                'weight' => ($course->created_at?->timestamp) ?? now()->timestamp,
            ];
        });
    }

    private function searchApprenticeships(CareerInterest $interest, int $limit): Collection
    {
        $terms = $this->keywords($interest);
        $locations = $this->locations($interest);

        return ApprenticeshipProgram::query()
            ->with('page:id,slug,name')
            ->select(['id', 'org_page_id', 'title', 'summary', 'location', 'status', 'created_at'])
            ->where('status', 'published')
            ->when($terms->isNotEmpty(), function ($builder) use ($terms) {
                $builder->where(function ($termQuery) use ($terms) {
                    foreach ($terms as $term) {
                        $termQuery->orWhere('title', 'like', "%{$term}%");
                    }
                });
            })
            ->when(! empty($locations), function ($builder) use ($locations) {
                $builder->where(function ($locationQuery) use ($locations) {
                    foreach ($locations as $location) {
                        $locationQuery->orWhere('location', 'like', "%{$location}%");
                    }
                });
            })
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();
    }

    /**
     * @psalm-return Collection<array-key, array{type: 'apprenticeship', title: string, provider: null|string, location: null|string, summary: string, link: string, weight: float|int|string}>
     */
    private function mapApprenticeships(Collection $programs): Collection
    {
        return $programs->map(function (ApprenticeshipProgram $program) {
            $link = $program->page
                ? route('organizations.show', $program->page->slug)
                : route('careers.wishlist');

            return [
                'type' => 'apprenticeship',
                'title' => $program->title,
                'provider' => $program->page?->name,
                'location' => $program->location,
                'summary' => Str::limit(strip_tags((string) $program->summary), 150),
                'link' => $link,
                'weight' => ($program->created_at?->timestamp) ?? now()->timestamp,
            ];
        });
    }

    /**
     * @psalm-return Collection<int, string>
     */
    private function keywords(CareerInterest $interest): Collection
    {
        return collect([
            $interest->title,
            $interest->field,
            $interest->industry,
            $interest->level,
        ])
            ->merge($interest->target_roles ?? [])
            ->merge($interest->target_sectors ?? [])
            ->map(fn ($value) => is_string($value) ? trim($value) : null)
            ->filter()
            ->map(fn ($value) => Str::limit($value, 80, ''))
            ->filter()
            ->unique()
            ->values();
    }

    /**
     * @return (null|string)[]
     *
     * @psalm-return array<int, null|string>
     */
    private function locations(CareerInterest $interest): array
    {
        return collect(array_merge(
            $interest->preferred_location ? [$interest->preferred_location] : [],
            is_array($interest->preferred_locations_multi) ? $interest->preferred_locations_multi : []
        ))
            ->map(fn ($value) => is_string($value) ? trim($value) : null)
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    private function formatSalary(?float $min, ?float $max): string|null
    {
        if (! $min && ! $max) {
            return null;
        }

        if ($min && $max) {
            return sprintf('$%s – $%s', number_format($min), number_format($max));
        }

        if ($min) {
            return sprintf('From $%s', number_format($min));
        }

        return sprintf('Up to $%s', number_format((float) $max));
    }
}

