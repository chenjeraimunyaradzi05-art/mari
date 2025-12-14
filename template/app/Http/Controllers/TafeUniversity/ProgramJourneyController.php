<?php

namespace App\Http\Controllers\TafeUniversity;

use App\Http\Controllers\Controller;
use App\Models\TafeProgram;
use App\Models\TafeStudentJourney;
use App\Services\Education\TafeUniversityInsightService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

final class ProgramJourneyController extends Controller
{
    public function store(Request $request, TafeProgram $program, TafeUniversityInsightService $insightService): RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'in:exploring,applied,interviewing,accepted,enrolled,graduated,on_hold'],
            'motivation_note' => ['nullable', 'string', 'max:800'],
        ]);

        $status = $validated['status'] ?? 'exploring';

        $journey = TafeStudentJourney::firstOrNew([
            'user_id' => $request->user()->id,
            'tafe_program_id' => $program->id,
        ]);

        $journey->fill([
            'status' => $status,
            'motivation_note' => $validated['motivation_note'] ?? $journey->motivation_note,
            'next_action' => $journey->next_action ?? 'Book a discovery call with the student success squad',
            'next_action_due_at' => $journey->next_action_due_at ?? now()->addDays(7),
            'ai_success_probability' => $insightService->scoreProgram($request->user(), $program),
            'ai_recommended_actions' => $insightService->recommendedActions($program),
        ]);

        if ($status === 'applied' && blank($journey->applied_at)) {
            $journey->applied_at = now();
        }

        if ($status === 'accepted' && blank($journey->accepted_at)) {
            $journey->accepted_at = now();
        }

        if ($status === 'enrolled' && blank($journey->enrolled_at)) {
            $journey->enrolled_at = now();
        }

        $journey->save();

        return back()->with('success', 'Journey updated. Your AI playbook has been refreshed.');
    }
}

