<?php

namespace App\Http\Controllers\Trades;

use App\Http\Controllers\Controller;
use App\Models\ApprenticeshipProgram;
use App\Models\ApprenticeshipProgressRecord;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

final class ApprenticeshipController extends Controller
{
    public function index(): \Illuminate\Contracts\View\View
    {
        $programs = ApprenticeshipProgram::paginate(10);
        return view('trades.apprenticeships.index', compact('programs'));
    }

    public function show(ApprenticeshipProgram $program): \Illuminate\Contracts\View\View
    {
        $program->load(['competencies', 'progressRecords']);
        return view('trades.apprenticeships.show', compact('program'));
    }

    public function apply(ApprenticeshipProgram $program): \Illuminate\Http\RedirectResponse
    {
        // Logic for applying to an apprenticeship
        // This would likely involve creating an application record
        // For now, we'll just return a view or redirect

        return redirect()->route('trades.apprenticeships.show', $program)
            ->with('success', 'Application submitted successfully!');
    }

    public function updateProgress(Request $request, ApprenticeshipProgram $program): \Illuminate\Http\RedirectResponse
    {
        $request->validate([
            'competency_id' => 'required|exists:apprenticeship_competencies,id',
            'status' => 'required|in:not_started,in_progress,completed',
            'notes' => 'nullable|string',
        ]);

        /** @var \App\Models\User $user */
        $user = Auth::user();

        if (!$user->candidate) {
            // Create a candidate profile if it doesn't exist
            $user->candidate()->create([]);
            $user->refresh();
        }

        ApprenticeshipProgressRecord::updateOrCreate(
            [
                'candidate_id' => $user->candidate->id,
                'apprenticeship_competency_id' => $request->competency_id,
            ],
            [
                'status' => $request->status,
                'coach_notes' => $request->notes, // Mapping notes to coach_notes for now
                'assessed_by' => $request->status === 'completed' ? $user->id : null, // Self-assessment for now
                'assessed_at' => $request->status === 'completed' ? now() : null,
            ]
        );

        return back()->with('success', 'Progress updated successfully!');
    }
}

