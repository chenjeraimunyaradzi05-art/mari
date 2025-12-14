<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\UserPersona;
use App\Http\Controllers\Controller;
use App\Http\Requests\Onboarding\UpdatePersonasRequest;
use App\Http\Requests\Onboarding\UpdateProfileRequest;
use App\Models\Course;
use App\Models\HousingListing;
use App\Models\Job;
use App\Models\MentorshipProgram;
use App\Models\Progress;
use App\Models\OrganizationPage;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

final class OnboardingController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->ensureCandidate($user);

        $this->syncChecklistProgress($user);

        $recommendedOrg = OrganizationPage::query()
            ->published()
            ->whereNotNull('safety_score')
            ->orderByDesc('safety_score')
            ->orderBy('name')
            ->with(['publishedCourses' => fn ($query) => $query
                ->published()
                ->with('page')
                ->latest('published_at')
                ->limit(3)
            ])
            ->first();

        $courses = Course::query()
            ->where('status', 'published')
            ->when($recommendedOrg, fn ($query) => $query->orderByRaw('provider_org_page_id = ? DESC', [$recommendedOrg->id]))
            ->with('page')
            ->latest('published_at')
            ->limit(6)
            ->get();

        $housingListings = HousingListing::query()
            ->where('status', 'published')
            ->orderBy('available_from')
            ->limit(2)
            ->get();

        $mentorshipPrograms = MentorshipProgram::query()
            ->where('status', 'published')
            ->orderByDesc('created_at')
            ->limit(2)
            ->get();

        $jobs = Job::query()
            ->with(['salaryType', 'city', 'state', 'company'])
            ->where('status', 'active')
            ->orderByDesc('featured_until')
            ->orderByDesc('highlight_until')
            ->orderByDesc('created_at')
            ->limit(3)
            ->get();

        $checklistItems = $this->buildChecklist($user);
        $completedTasks = collect($checklistItems)->where('completed', true)->count();
        $totalTasks = count($checklistItems);
        $progress = $totalTasks > 0 ? (int) round(($completedTasks / $totalTasks) * 100) : 0;
        $preferredSupportTypes = $this->recommendedSupportTypes($user);
        $personaFlags = array_values($user->persona_flags ?? []);

        $supportSections = $this->prepareSupportSections([
            'courses' => $courses,
            'housing' => $housingListings,
            'mentorship' => $mentorshipPrograms,
            'jobs' => $jobs,
        ], $preferredSupportTypes, $personaFlags);

        return response()->json([
            'user' => $this->transformUser($user),
            'persona_options' => $this->personaOptions(),
            'persona_guidance' => $this->personaGuidance($user),
            'checklist' => [
                'items' => $checklistItems,
                'completed' => $completedTasks,
                'total' => $totalTasks,
                'progress' => $progress,
            ],
            'recommendations' => [
                'organization' => $recommendedOrg
                    ? $this->transformOrganization($recommendedOrg)
                    : null,
                'supports' => $supportSections,
            ],
        ]);
    }

    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $this->ensureCandidate($user);
        $user->fill($request->validated());

        if (in_array($user->onboarding_step, [null, 'profile'], true)) {
            $user->onboarding_step = 'roles';
        }

        $user->save();
        $this->recordEvent($user, 'profile_updated', $request->validated());

        $user->refresh();
        $this->syncChecklistProgress($user);

        return response()->json([
            'user' => $this->transformUser($user),
        ]);
    }

    public function updatePersonas(UpdatePersonasRequest $request): JsonResponse
    {
        $user = $request->user();
        $this->ensureCandidate($user);

        $personas = collect($request->validated('personas'))
            ->map(fn (string $value) => UserPersona::from($value)->value)
            ->unique()
            ->values();

        $user->persona_flags = $personas->all();

        if (in_array($user->onboarding_step, [null, 'profile', 'roles'], true)) {
            $user->onboarding_step = 'journey';
        }

        $user->save();
        $this->recordEvent($user, 'personas_updated', [
            'persona_flags' => $user->persona_flags,
        ]);

        $user->refresh();
        $this->syncChecklistProgress($user);

        return response()->json([
            'user' => $this->transformUser($user),
        ]);
    }

    public function complete(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->ensureCandidate($user);

        if (empty($user->persona_flags)) {
            return response()->json([
                'message' => 'Select at least one persona before completing onboarding.',
            ], 422);
        }

        $user->onboarding_step = 'completed';
        $user->save();
        $this->recordEvent($user, 'completed');

        $user->refresh();
        $this->syncChecklistProgress($user);

        return response()->json([
            'user' => $this->transformUser($user),
        ]);
    }

    public function recordSupportEngagement(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->ensureCandidate($user);

        $catalog = config('womenrise.supports', []);
        $supportedTypes = array_keys($catalog);

        $validated = $request->validate([
            'support_type' => ['required', 'string', Rule::in($supportedTypes)],
            'support_id' => ['nullable', 'string'],
            'action' => ['required', 'string', Rule::in(['cta_clicked', 'nudge_dismissed'])],
            'cta_label' => ['nullable', 'string', 'max:255'],
            'highlighted' => ['nullable', 'boolean'],
            'metadata' => ['nullable', 'array'],
        ]);

        $catalogEntry = $catalog[$validated['support_type']] ?? [];

        $payload = [
            'support_type' => $validated['support_type'],
            'action' => $validated['action'],
            'cta_label' => $validated['cta_label'] ?? null,
            'highlighted' => (bool) ($validated['highlighted'] ?? false),
            'persona_flags' => array_values($user->persona_flags ?? []),
        ];

        if (! empty($validated['support_id'])) {
            $payload['support_id'] = $validated['support_id'];
        }

        $metadata = collect($validated['metadata'] ?? [])
            ->merge([
                'support_label' => $catalogEntry['label'] ?? null,
            ])
            ->filter(fn ($value) => $value !== null && $value !== '')
            ->all();

        if (! empty($metadata)) {
            $payload['metadata'] = $metadata;
        }

        $this->recordEvent($user, 'support_engagement', $payload);

        $this->syncChecklistProgress($user->fresh());

        return response()->json([
            'status' => 'recorded',
        ], 201);
    }

    /**
     * @return (array|mixed|null|string)[]
     *
     * @psalm-return array{id: mixed, name: string, preferred_name: null|string, pronouns: null|string, timezone: null|string, persona_flags: list<mixed>, onboarding_step: null|string}
     */
    private function transformUser(User $user): array
    {
        return [
            'id' => $user->getKey(),
            'name' => $user->name,
            'preferred_name' => $user->preferred_name,
            'pronouns' => $user->pronouns,
            'timezone' => $user->timezone,
            'persona_flags' => array_values($user->persona_flags ?? []),
            'onboarding_step' => $user->onboarding_step,
        ];
    }

    /**
     * @return (\Illuminate\Support\Stringable|array|mixed|null|string)[][]
     *
     * @psalm-return non-empty-list<array{description: mixed|null, icon: mixed|null, label: \Illuminate\Support\Stringable&static|mixed, recommended_supports: array<never, never>|mixed, value: 'career-shifter'|'caregiver'|'early-career'|'entrepreneur'|'student'}>
     */
    private function personaOptions(): array
    {
        $catalog = $this->personaCatalog();

        return array_values(array_map(
            /**
             * @return (\Illuminate\Support\Stringable|array|mixed|null|string)[]
             *
             * @psalm-return array{value: string, label: \Illuminate\Support\Stringable|mixed, description: mixed|null, icon: mixed|null, recommended_supports: array<never, never>|mixed}
             */
            static function (UserPersona $persona) use ($catalog): array {
                $entry = $catalog[$persona->value] ?? [];

                return [
                    'value' => $persona->value,
                    'label' => $entry['label'] ?? Str::of($persona->value)->replace('-', ' ')->title(),
                    'description' => $entry['description'] ?? null,
                    'icon' => $entry['icon'] ?? null,
                    'recommended_supports' => $entry['recommended_supports'] ?? [],
                ];
            },
            UserPersona::cases()
        ));
    }

    /**
     * @return (bool|string)[][]
     *
     * @psalm-return list{array{id: 'profile-basics', label: 'Confirm your profile basics', description: 'Set your preferred name, pronouns, and timezone so mentors and employers greet you correctly.', completed: bool, action: 'onboarding.profile'}, array{id: 'persona-selection', label: 'Select the support personas that fit', description: 'Choose the journeys that best describe what you need from WomenRise.', completed: bool, action: 'onboarding.personas'}, array{id: 'explore-supports', label: 'Explore your recommended supports', description: 'Review curated courses, housing, and mentorship designed for your path.', completed: bool, action: 'onboarding.journey'}, array{id: 'finish', label: 'Finish onboarding', description: 'Confirm you are ready to start your WomenRise journey.', completed: bool, action: 'onboarding.complete'}}
     */
    private function buildChecklist(User $user): array
    {
        return [
            [
                'id' => 'profile-basics',
                'label' => 'Confirm your profile basics',
                'description' => 'Set your preferred name, pronouns, and timezone so mentors and employers greet you correctly.',
                'completed' => $this->hasCompletedProfileBasics($user),
                'action' => 'onboarding.profile',
            ],
            [
                'id' => 'persona-selection',
                'label' => 'Select the support personas that fit',
                'description' => 'Choose the journeys that best describe what you need from WomenRise.',
                'completed' => $this->hasPersonaSelections($user),
                'action' => 'onboarding.personas',
            ],
            [
                'id' => 'explore-supports',
                'label' => 'Explore your recommended supports',
                'description' => 'Review curated courses, housing, and mentorship designed for your path.',
                'completed' => in_array($user->onboarding_step, ['journey', 'completed'], true),
                'action' => 'onboarding.journey',
            ],
            [
                'id' => 'finish',
                'label' => 'Finish onboarding',
                'description' => 'Confirm you are ready to start your WomenRise journey.',
                'completed' => $user->onboarding_step === 'completed',
                'action' => 'onboarding.complete',
            ],
        ];
    }

    private function hasCompletedProfileBasics(User $user): bool
    {
        return filled($user->preferred_name) || filled($user->pronouns) || filled($user->timezone);
    }

    private function hasPersonaSelections(User $user): bool
    {
        return count(array_filter($user->persona_flags ?? [])) > 0;
    }

    private function personaCatalog(): array
    {
        return config('womenrise.personas', []);
    }

    /**
     * @psalm-return array<int, mixed>
     */
    private function recommendedSupportTypes(User $user): array
    {
        $catalog = $this->personaCatalog();

        return collect($user->persona_flags ?? [])
            ->flatMap(static fn ($value) => $catalog[$value]['recommended_supports'] ?? [])
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    private function syncChecklistProgress(User $user): void
    {
        $this->setProgress(
            $user,
            'onboarding.profile',
            $this->hasCompletedProfileBasics($user)
        );

        $this->setProgress(
            $user,
            'onboarding.personas',
            $this->hasPersonaSelections($user)
        );

        $this->setProgress(
            $user,
            'onboarding.supports',
            in_array($user->onboarding_step, ['journey', 'completed'], true)
        );

        $this->setProgress(
            $user,
            'onboarding.complete',
            $user->onboarding_step === 'completed'
        );
    }

    private function setProgress(User $user, string $type, bool $completed, int $target = 100): void
    {
        $progress = Progress::firstOrNew([
            'user_id' => $user->getKey(),
            'type' => $type,
        ]);

        $desiredValue = $completed ? $target : 0;

        $shouldUpdate = $progress->exists === false
            || $progress->value !== $desiredValue
            || $progress->target !== $target
            || ($completed && $progress->completed_at === null)
            || (! $completed && $progress->completed_at !== null);

        if (! $shouldUpdate) {
            return;
        }

        $progress->value = $desiredValue;
        $progress->target = $target;
        $progress->completed_at = $completed
            ? ($progress->completed_at ?? now())
            : null;

        $progress->save();
    }

    /**
     * @return ((int|string)|array|bool|mixed|null)[][]
     *
     * @psalm-return list<array{cta_label: mixed|string, description: mixed|null, highlighted: bool, icon: mixed|null, items: array, nudges: array, title: mixed|string, type: array-key|mixed}>
     */
    private function prepareSupportSections(array $datasets, array $preferredTypes, array $personaFlags): array
    {
        $catalog = config('womenrise.supports', []);
        $order = array_values(array_unique(array_merge($preferredTypes, array_keys($datasets))));
        $sections = [];
        $personaFlags = array_values(array_filter($personaFlags));

        foreach ($order as $type) {
            $itemCollection = $datasets[$type] instanceof Collection
                ? $datasets[$type]
                : collect($datasets[$type] ?? []);

            if ($itemCollection->isEmpty()) {
                continue;
            }

            $catalogEntry = $catalog[$type] ?? [];

            $sections[] = [
                'type' => $type,
                'title' => $catalogEntry['label'] ?? Str::title($type),
                'description' => $catalogEntry['description'] ?? null,
                'icon' => $catalogEntry['icon'] ?? null,
                'highlighted' => in_array($type, $preferredTypes, true),
                'cta_label' => $catalogEntry['cta_label'] ?? $this->defaultSupportCta($type),
                'nudges' => $this->resolveSupportNudges($catalogEntry['nudges'] ?? [], $personaFlags),
                'items' => $this->mapSupportItems($type, $itemCollection),
            ];
        }

        return $sections;
    }

    private function defaultSupportCta(string $type): string
    {
        return match ($type) {
            'courses' => 'View course',
            'jobs' => 'View role',
            'housing' => 'Housing support info',
            'mentorship' => 'Mentorship details',
            default => 'Learn more',
        };
    }

    /**
     * @return string[]
     *
     * @psalm-return array<int, string>
     */
    private function resolveSupportNudges(array $catalogNudges, array $personaFlags): array
    {
        if (empty($catalogNudges)) {
            return [];
        }

        $messages = collect();

        foreach ($personaFlags as $flag) {
            if (! empty($catalogNudges[$flag])) {
                $messages = $messages->merge((array) $catalogNudges[$flag]);
            }
        }

        if ($messages->isEmpty() && ! empty($catalogNudges['default'])) {
            $messages = $messages->merge((array) $catalogNudges['default']);
        }

        return $messages
            ->filter()
            ->map(fn ($value) => is_string($value) ? trim($value) : $value)
            ->filter(fn ($value) => is_string($value) && $value !== '')
            ->unique()
            ->take(3)
            ->values()
            ->all();
    }

    /**
     * @return (array|mixed)[]
     *
     * @psalm-return array<int, array|mixed>
     */
    private function mapSupportItems(string $type, Collection $items): array
    {
        return $items->map(function ($item) use ($type) {
            return match ($type) {
                'courses' => $this->transformCourse($item),
                'housing' => $this->transformHousing($item),
                'mentorship' => $this->transformMentorship($item),
                'jobs' => $this->transformJob($item),
                default => $item,
            };
        })->values()->all();
    }

    /**
     * @return (\Illuminate\Support\Stringable|array|mixed|null)[][]
     *
     * @psalm-return array<int, array{value: mixed, label: \Illuminate\Support\Stringable|mixed, description: mixed|null, icon: mixed|null, journey_prompts: array<never, never>|mixed, recommended_supports: array<never, never>|mixed}>
     */
    private function personaGuidance(User $user): array
    {
        $catalog = $this->personaCatalog();

        return collect($user->persona_flags ?? [])
            ->filter(static fn ($value) => isset($catalog[$value]))
            ->map(/**
             * @return (\Illuminate\Support\Stringable|array|mixed|null)[]
             *
             * @psalm-return array{value: mixed, label: \Illuminate\Support\Stringable|mixed, description: mixed|null, icon: mixed|null, journey_prompts: array<never, never>|mixed, recommended_supports: array<never, never>|mixed}
             */
            static function ($value) use ($catalog): array {
                $entry = $catalog[$value];

                return [
                    'value' => $value,
                    'label' => $entry['label'] ?? Str::of($value)->replace('-', ' ')->title(),
                    'description' => $entry['description'] ?? null,
                    'icon' => $entry['icon'] ?? null,
                    'journey_prompts' => $entry['journey_prompts'] ?? [],
                    'recommended_supports' => $entry['recommended_supports'] ?? [],
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return ((array|mixed)[]|int|mixed|null|string)[]
     *
     * @psalm-return array{id: mixed, name: string, slug: string, tagline: null|string, safety_score: int, declaration: array, safety_commitments: array, highlights: array, courses: array<int, array>}
     */
    private function transformOrganization(OrganizationPage $org): array
    {
        return [
            'id' => $org->getKey(),
            'name' => $org->name,
            'slug' => $org->slug,
            'tagline' => $org->tagline,
            'safety_score' => $org->safety_score,
            'declaration' => $org->declaration ?? [],
            'safety_commitments' => $org->safety_commitments ?? [],
            'highlights' => $org->highlights ?? [],
            'courses' => $org->publishedCourses->map(fn (Course $course) => $this->transformCourse($course))->all(),
        ];
    }

    /**
     * @return (array|int|mixed|null|string)[]
     *
     * @psalm-return array{id: mixed, title: string, slug: string, rent_cents: int|null, rent_frequency: string, available_from: string, safety_level: string, amenities: array, safety_features: array, location: string}
     */
    private function transformHousing(HousingListing $listing): array
    {
        return [
            'id' => $listing->getKey(),
            'title' => $listing->title,
            'slug' => $listing->slug,
            'rent_cents' => $listing->rent_cents,
            'rent_frequency' => $listing->rent_frequency,
            'available_from' => optional($listing->available_from)->toDateString(),
            'safety_level' => $listing->safety_level,
            'amenities' => $listing->amenities ?? [],
            'safety_features' => $listing->safety_features ?? [],
            'location' => trim(implode(', ', array_filter([
                $listing->suburb,
                $listing->region,
            ]))),
        ];
    }

    /**
     * @return (array|int|mixed|null|string)[]
     *
     * @psalm-return array{id: mixed, title: string, slug: string, focus_area: null|string, delivery_mode: null|string, duration_minutes: int|null, price_cents: int|null, matching_criteria: array, impact_metrics: array}
     */
    private function transformMentorship(MentorshipProgram $program): array
    {
        return [
            'id' => $program->getKey(),
            'title' => $program->title,
            'slug' => $program->slug,
            'focus_area' => $program->focus_area,
            'delivery_mode' => $program->delivery_mode,
            'duration_minutes' => $program->duration_minutes,
            'price_cents' => $program->price_cents,
            'matching_criteria' => $program->matching_criteria ?? [],
            'impact_metrics' => $program->impact_metrics ?? [],
        ];
    }

    /**
     * @return ((float|null|string)[]|mixed|null|string)[]
     *
     * @psalm-return array{id: mixed, title: string, slug: string, company_name: null|string, location: string, salary_range: array{min: float|null, max: float|null, currency: null|string}, deadline: string, apply: array{mode: string, email: null|string, url: null|string}, url: string}
     */
    private function transformJob(Job $job): array
    {
        return [
            'id' => $job->getKey(),
            'title' => $job->title,
            'slug' => $job->slug,
            'company_name' => $job->company_name ?? optional($job->company)->name,
            'location' => trim(implode(', ', array_filter([
                optional($job->city)->name,
                optional($job->state)->name,
            ]))),
            'salary_range' => [
                'min' => $job->min_salary,
                'max' => $job->max_salary,
                'currency' => optional($job->salaryType)->name,
            ],
            'deadline' => $job->deadline,
            'apply' => [
                'mode' => $job->apply_on,
                'email' => $job->apply_email,
                'url' => $job->apply_url,
            ],
            'url' => route('jobs.show', ['slug' => $job->slug]),
        ];
    }

    /**
     * @return (array|mixed|null|string)[]
     *
     * @psalm-return array{id: mixed, title: string, slug: null|string, summary: null|string, mode: string, delivery_options: array, outcomes: array, application_url: null|string, provider: null|string, provider_slug: null|string, url: null|string}
     */
    private function transformCourse(Course $course): array
    {
        return [
            'id' => $course->getKey(),
            'title' => $course->title,
            'slug' => $course->slug,
            'summary' => $course->summary,
            'mode' => $course->mode,
            'delivery_options' => $course->delivery_options ?? [],
            'outcomes' => $course->outcomes ?? [],
            'application_url' => $course->application_url,
            'provider' => $course->page?->name,
            'provider_slug' => $course->page?->slug,
            'url' => $course->page?->slug
                ? route('organizations.courses.show', ['slug' => $course->page->slug, 'course' => $course])
                : null,
        ];
    }

    private function ensureCandidate(User $user): void
    {
        // Accept both legacy 'candidate' and canonical 'member' role values for onboarding flows.
        abort_if(! in_array($user->role, ['candidate', 'member'], true), 403);
    }

    private function recordEvent(User $user, string $action, array $payload = []): void
    {
        $user->onboardingEvents()->create([
            'action' => $action,
            'payload' => $payload ?: null,
            'occurred_at' => now(),
        ]);
    }
}

