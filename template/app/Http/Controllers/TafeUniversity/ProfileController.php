<?php

namespace App\Http\Controllers\TafeUniversity;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

final class ProfileController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'motivations' => ['nullable', 'string', 'max:600'],
            'focus_areas' => ['nullable', 'string', 'max:255'],
            'preferred_sectors' => ['nullable', 'string', 'max:255'],
            'salary_aspiration' => ['nullable', 'string', 'max:120'],
            'impact_goals' => ['nullable', 'string', 'max:600'],
            'work_style' => ['nullable', 'string', 'max:120'],
            'top_skills' => ['nullable', 'string', 'max:255'],
        ]);

        $payload = [
            'motivations' => $validated['motivations'] ?? null,
            'focus_areas' => $this->splitToArray($validated['focus_areas'] ?? null),
            'preferred_sectors' => $this->splitToArray($validated['preferred_sectors'] ?? null),
            'salary_aspiration' => $validated['salary_aspiration'] ?? null,
            'impact_goals' => $validated['impact_goals'] ?? null,
            'work_style' => $validated['work_style'] ?? null,
            'top_skills' => $this->splitToArray($validated['top_skills'] ?? null, 6),
        ];

        $user->tafeCareerProfile()->updateOrCreate([], $payload);

        return redirect()
            ->route('education.tafe.dashboard')
            ->with('tafe_profile_saved', true);
    }

    /**
     * @return array<int, string>
     */
    private function splitToArray(?string $value, int $limit = 5): array
    {
        return collect(explode(',', (string) $value))
            ->map(static fn (string $entry) => trim($entry))
            ->filter()
            ->unique()
            ->take($limit)
            ->values()
            ->all();
    }
}

