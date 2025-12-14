<?php

namespace App\Http\Controllers\TafeUniversity;

use App\Http\Controllers\Controller;
use App\Models\TafeProgram;
use App\Models\TafeStudentJourney;
use App\Services\Education\TafeUniversityInsightService;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class ProgramController extends Controller
{
    public function index(Request $request, TafeUniversityInsightService $insightService): View
    {
        $filters = $request->only(['q', 'level', 'mode', 'tag']);
        $normalizedTag = null;

        if (!empty($filters['tag'])) {
            $normalizedTag = ltrim(Str::lower($filters['tag']), '#');
        }

        $programs = TafeProgram::with('institution')
            ->published()
            ->when($filters['q'] ?? null, function ($query, $search) {
                $query->where(function ($inner) use ($search) {
                    $inner->where('title', 'like', "%{$search}%")
                        ->orWhere('summary', 'like', "%{$search}%");
                });
            })
            ->when($filters['level'] ?? null, fn ($query, $level) => $query->where('credential_level', $level))
            ->when($filters['mode'] ?? null, fn ($query, $mode) => $query->where('delivery_mode', $mode))
            ->when($normalizedTag, function ($query) use ($normalizedTag) {
                $query->where(function ($inner) use ($normalizedTag) {
                    $inner->whereJsonContains('tags', $normalizedTag)
                        ->orWhere('tags', 'like', "%{$normalizedTag}%");
                });
            })
            ->orderByDesc('ai_match_score')
            ->orderByDesc('updated_at')
            ->paginate(12)
            ->withQueryString()
            ->through(function (TafeProgram $program) use ($insightService, $request) {
                $program->calculated_match_score = $insightService->scoreProgram($request->user(), $program);
                return $program;
            });

        $filterOptions = [
            'levels' => [
                'certificate_iii' => 'Certificate III',
                'certificate_iv' => 'Certificate IV',
                'diploma' => 'Diploma',
                'advanced_diploma' => 'Advanced Diploma',
                'bachelor' => 'Bachelor',
                'masters' => 'Masters',
                'micro_credential' => 'Micro-credential',
            ],
            'modes' => [
                'on_campus' => 'On campus',
                'online' => 'Online',
                'hybrid' => 'Hybrid',
            ],
        ];

        return view('education.tafe.programs.index', [
            'programs' => $programs,
            'filters' => $filters,
            'filterOptions' => $filterOptions,
        ]);
    }

    public function show(TafeProgram $program, Request $request, TafeUniversityInsightService $insightService): View
    {
        $program->load(['institution', 'intakes' => fn ($query) => $query->orderBy('start_date')]);

        $journey = TafeStudentJourney::where('user_id', $request->user()->id)
            ->where('tafe_program_id', $program->id)
            ->first();

        $matchScore = $insightService->scoreProgram($request->user(), $program);
        $recommendedActions = $insightService->recommendedActions($program);

        $similarPrograms = TafeProgram::with('institution')
            ->published()
            ->where('id', '!=', $program->id)
            ->where('credential_level', $program->credential_level)
            ->orderByDesc('ai_match_score')
            ->take(3)
            ->get();

        return view('education.tafe.programs.show', [
            'program' => $program,
            'journey' => $journey,
            'matchScore' => $matchScore,
            'recommendedActions' => $recommendedActions,
            'similarPrograms' => $similarPrograms,
        ]);
    }
}

