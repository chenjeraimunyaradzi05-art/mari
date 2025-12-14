<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Http\Requests\Grants\StoreGrantFilterPresetRequest;
use App\Http\Requests\Grants\UpdateGrantApplicationRequest;
use App\Http\Requests\Grants\UpdateGrantFilterPresetRequest;
use App\Models\GrantApplication;
use App\Models\GrantFilterPreset;
use App\Models\GrantProgram;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Storage;
use Illuminate\View\View;

final class GrantExperienceController extends Controller
{
    public function index(Request $request): View
    {
        $query = GrantProgram::query();
        $user = $request->user();
        $activePresetId = null;
        $presetFilters = null;

        if ($user && $request->filled('preset')) {
            $preset = GrantFilterPreset::query()
                ->where('user_id', $user->id)
                ->where('id', (int) $request->input('preset'))
                ->first();

            if ($preset) {
                $activePresetId = $preset->id;
                $presetFilters = $preset->filters ?? [];
            }
        }

        $activeFilters = $this->applyFilterScopes($request, $query, $presetFilters);

        $grants = $query
            ->orderBy('closes_at')
            ->orderByDesc('match_score')
            ->paginate(6)
            ->withQueryString();

        $metrics = [
            'active_count' => GrantProgram::whereDate('closes_at', '>=', now())->count(),
            'closing_soon' => GrantProgram::whereBetween('closes_at', [now(), now()->addWeeks(2)])->count(),
            'applications_total' => 0,
            'applications_submitted' => 0,
            'applications_ready' => 0,
        ];

        $userApplications = collect();
        $savedPresets = collect();

        if ($user) {
            $userApplications = GrantApplication::query()
                ->where('user_id', $user->id)
                ->latest('updated_at')
                ->get()
                ->keyBy('grant_program_id');

            $metrics['applications_total'] = $userApplications->count();
            $metrics['applications_submitted'] = $userApplications->where('status', 'submitted')->count();
            $metrics['applications_ready'] = $userApplications->where('ready_for_review', true)->count();

            $savedPresets = GrantFilterPreset::query()
                ->forPersona($user, $this->resolvePersonaKey($user))
                ->latest()
                ->get();
        }

        return view('grants.index', [
            'grants' => $grants,
            'filters' => $this->filters(),
            'metrics' => $metrics,
            'activeFilters' => $activeFilters,
            'userApplications' => $userApplications,
            'savedPresets' => $savedPresets,
            'activePresetId' => $activePresetId,
        ]);
    }

    public function show(Request $request, GrantProgram $grant): View
    {
        $application = null;

        if ($user = $request->user()) {
            $application = $grant->applications()
                ->where('user_id', $user->id)
                ->latest('updated_at')
                ->first();
        }

        return view('grants.show', [
            'grant' => $grant,
            'application' => $application,
        ]);
    }

    public function apply(Request $request, GrantProgram $grant): View
    {
        $application = GrantApplication::firstOrCreate(
            [
                'grant_program_id' => $grant->id,
                'user_id' => $request->user()->id,
            ],
            []
        );

        return view('grants.application', [
            'grant' => $grant,
            'application' => $application->refresh(),
            'fundingUses' => $this->fundingUses(),
        ]);
    }

    public function updateApplication(UpdateGrantApplicationRequest $request, GrantApplication $application): RedirectResponse
    {
        $validated = $request->validated();

        $application->fill([
            'project_summary' => $validated['project_summary'],
            'funding_use' => $validated['funding_use'],
            'impact_statement' => $validated['impact_statement'],
            'ready_for_review' => $request->boolean('ready_for_review'),
        ]);

        $application->funding_requested_cents = (int) round($validated['funding_requested'] * 100);

        if ($request->boolean('submit_final')) {
            $application->status = 'submitted';
            $application->submitted_at ??= now();
        } else {
            $application->status = 'draft';
        }

        if ($request->hasFile('supporting_documents')) {
            $documents = $application->documents ?? [];

            foreach ($request->file('supporting_documents', []) as $upload) {
                if (! $upload) {
                    continue;
                }

                $path = $upload->store('grant-applications/'.$application->id, 'public');

                $documents[] = [
                    'name' => $upload->getClientOriginalName(),
                    'path' => $path,
                    'url' => Storage::url($path),
                    'uploaded_at' => now()->toIso8601String(),
                ];
            }

            $application->documents = $documents;
        }

        $application->updateProgress();
        $application->save();

        return back()->with('status', 'Application updated successfully.');
    }

    public function storePreset(StoreGrantFilterPresetRequest $request): RedirectResponse
    {
        $user = $request->user();

        if (! $user) {
            return redirect()->route('grants.index');
        }

        GrantFilterPreset::create([
            'user_id' => $user->id,
            'persona_key' => $this->resolvePersonaKey($user),
            'name' => $request->validated('name'),
            'filters' => $this->normalizeFilters($request->validated('filters')),
            'notify_in_app' => $request->boolean('notify_in_app'),
            'notify_email' => $request->boolean('notify_email'),
        ]);

        return redirect()->route('grants.index', $this->filtersToQueryParams($request->validated('filters')))
            ->with('status', 'Preset saved.');
    }

    public function updatePreset(UpdateGrantFilterPresetRequest $request, GrantFilterPreset $preset): RedirectResponse
    {
        $this->authorizePreset($request->user(), $preset);

        $preset->update([
            'name' => $request->validated('name'),
            'notify_in_app' => $request->has('notify_in_app')
                ? $request->boolean('notify_in_app')
                : $preset->notify_in_app,
            'notify_email' => $request->has('notify_email')
                ? $request->boolean('notify_email')
                : $preset->notify_email,
        ]);

        return back()->with('status', 'Preset renamed.');
    }

    public function destroyPreset(Request $request, GrantFilterPreset $preset): RedirectResponse
    {
        $this->authorizePreset($request->user(), $preset);

        $preset->delete();

        return back()->with('status', 'Preset deleted.');
    }

    /**
     * @return (mixed|string)[][]
     *
     * @psalm-return array{types: array<int, mixed>, providers: array, industries: array<int, mixed>, states: array<int<0, 7>, string>}
     */
    private function filters(): array
    {
        $types = GrantProgram::query()
            ->select('provider_type')
            ->distinct()
            ->orderBy('provider_type')
            ->pluck('provider_type')
            ->filter()
            ->values();

        $providers = GrantProgram::query()
            ->select('provider_name')
            ->distinct()
            ->orderBy('provider_name')
            ->pluck('provider_name');

        $industries = GrantProgram::query()
            ->select('tags')
            ->pluck('tags')
            ->filter()
            ->flatMap(fn ($tags) => Arr::wrap($tags))
            ->unique()
            ->sort()
            ->values();

        $states = collect(['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT']);

        return [
            'types' => $types->all(),
            'providers' => $providers->all(),
            'industries' => $industries->all(),
            'states' => $states->all(),
        ];
    }

    /**
     * @return string[]
     *
     * @psalm-return array{product_development: 'Product development', community_program: 'Community program', clean_energy_infrastructure: 'Clean energy infrastructure', workforce_training: 'Workforce training'}
     */
    private function fundingUses(): array
    {
        return [
            'product_development' => 'Product development',
            'community_program' => 'Community program',
            'clean_energy_infrastructure' => 'Clean energy infrastructure',
            'workforce_training' => 'Workforce training',
        ];
    }

    /**
     * @psalm-return array{type: mixed, provider: mixed, industry: mixed, state: mixed, closing_soon: mixed, women_only: mixed, q: mixed,...}
     */
    private function applyFilterScopes(Request $request, Builder $query, ?array $presetFilters = null): array
    {
        $filters = array_merge($this->defaultFilters(), Arr::only($presetFilters ?? [], $this->filterKeys()));

        foreach (['type', 'provider', 'industry', 'state', 'q'] as $key) {
            $value = $request->string($key)->trim()->toString();
            if ($value !== '') {
                $filters[$key] = $value;
            }
        }

        foreach (['women_only', 'closing_soon'] as $flag) {
            if ($request->has($flag)) {
                $filters[$flag] = $request->boolean($flag);
            }
        }

        if ($filters['type']) {
            $query->where('provider_type', $filters['type']);
        }

        if ($filters['provider']) {
            $query->where('provider_name', $filters['provider']);
        }

        if ($filters['industry']) {
            $query->whereJsonContains('tags', $filters['industry']);
        }

        if ($filters['state']) {
            $query->whereJsonContains('states', $filters['state']);
        }

        if ($filters['closing_soon']) {
            $query->whereBetween('closes_at', [now(), now()->addWeeks(2)]);
        }

        if ($filters['women_only']) {
            $query->where(function ($filter): void {
                $filter->whereJsonContains('tags', 'Women')
                    ->orWhere('name', 'like', '%Women%');
            });
        }

        if ($filters['q']) {
            $query->where(function ($search) use ($filters): void {
                $search->where('name', 'like', '%'.$filters['q'].'%')
                    ->orWhere('description', 'like', '%'.$filters['q'].'%')
                    ->orWhere('provider_name', 'like', '%'.$filters['q'].'%');
            });
        }

        return $filters;
    }

    /**
     * @return (false|null)[]
     *
     * @psalm-return array{type: null, provider: null, industry: null, state: null, q: null, women_only: false, closing_soon: false}
     */
    private function defaultFilters(): array
    {
        return [
            'type' => null,
            'provider' => null,
            'industry' => null,
            'state' => null,
            'q' => null,
            'women_only' => false,
            'closing_soon' => false,
        ];
    }

    /**
     * @return (int|string)[]
     *
     * @psalm-return list<array-key>
     */
    private function filterKeys(): array
    {
        return array_keys($this->defaultFilters());
    }

    private function normalizeFilters(?array $filters): array
    {
        $filters = $filters ?? [];
        $clean = [];
        foreach ($this->filterKeys() as $key) {
            $value = $filters[$key] ?? null;
            if (in_array($key, ['women_only', 'closing_soon'], true)) {
                $clean[$key] = (bool) $value;
                continue;
            }
            $clean[$key] = $value !== '' ? $value : null;
        }

        return $clean;
    }

    private function resolvePersonaKey(?User $user): string
    {
        if (! $user) {
            return 'guest';
        }

        $flags = collect($user->persona_flags ?? [])->filter()->values();
        if ($flags->isNotEmpty()) {
            return (string) $flags->first();
        }

        if ($user->primary_role) {
            return (string) $user->primary_role;
        }

        return 'member';
    }

    private function filtersToQueryParams(array $filters): array
    {
        return collect($this->normalizeFilters($filters))
            ->reject(fn ($value) => $value === null || $value === false)
            ->all();
    }

    private function authorizePreset(?User $user, GrantFilterPreset $preset): void
    {
        abort_if(! $user || $preset->user_id !== $user->id, 403);
    }
}

