<?php

declare(strict_types=1);

namespace App\Livewire\Partners;

use App\Enums\WomenRealEstate\CohortPersona;
use App\Models\WomenRealEstate\WomenCohortProfile;
use App\Models\WomenRealEstate\WomenPartnerProject;
use App\Services\WomenRealEstate\WomenPartnerMatchingService;
use App\Support\Livewire\FallbackComponent;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

if (! class_exists(__NAMESPACE__.'\\LivewireComponent', false)) {
    if (class_exists('Livewire\\Component')) {
        class_alias('Livewire\\Component', __NAMESPACE__.'\\LivewireComponent');
    } else {
        class LivewireComponent extends FallbackComponent
        {
        }
    }
}

final class Opportunities extends LivewireComponent
{
    public int $profileId;

    public array $projects = [];

    public function mount(int $profileId, array $projects = []): void
    {
        $this->profileId = $profileId;
        $this->projects = $projects !== [] ? $projects : $this->loadProjects();
    }

    public function refreshProjects(): void
    {
        $this->projects = $this->loadProjects();
    }

    public function render()
    {
        return view('livewire.partners.opportunities', [
            'projects' => $this->projects,
        ]);
    }

    private function loadProjects(): array
    {
        $profile = WomenCohortProfile::query()
            ->where('user_id', Auth::id())
            ->whereKey($this->profileId)
            ->firstOrFail();

        $persona = $profile->persona ?? CohortPersona::FIRST_HOME_BUYER;

        if (! in_array($persona, [CohortPersona::INVESTOR, CohortPersona::DEVELOPER], true)) {
            return [];
        }

        $service = app(WomenPartnerMatchingService::class);

        return WomenPartnerProject::query()
            ->active()
            ->with('owner')
            ->latest()
            ->limit(4)
            ->get()
            ->map(function (WomenPartnerProject $project) use ($service) {
                $bestMatch = $service->recommendMatches($project)->first();
                $insights = is_array($bestMatch) ? ($bestMatch['insights'] ?? []) : [];
                $score = is_array($bestMatch) ? (float) ($bestMatch['score'] ?? 65.0) : 65.0;

                return [
                    'title' => $project->title,
                    'summary' => Str::limit((string) ($project->summary ?? 'Collaborate with fellow investors on a vetted women-led development.'), 140),
                    'owner' => $project->owner?->name ?? 'WomenRise member',
                    'match_score' => round($score, 1),
                    'launch_at' => optional($project->target_launch_at)->toDateString(),
                    'ai_summary' => $insights['summary'] ?? null,
                    'activation_steps' => $insights['activation_steps'] ?? [],
                    'values_alignment' => $insights['values_alignment'] ?? [],
                    'ai_provider' => $insights['provider'] ?? null,
                ];
            })
            ->values()
            ->all();
    }
}

