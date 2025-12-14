<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\CandidateJobAlert;
use App\Models\JobAlertLog;
use App\Models\JobCategory;
use App\Models\JobType;
use App\Models\JobRole;
use App\Models\JobExperience;
use App\Services\JobAlertService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

final class CandidateJobAlertController extends Controller
{
    public function __construct(
        protected JobAlertService $alertService
    ) {
        $this->middleware('auth')->except(['unsubscribe', 'trackClick']);
    }

    /**
     * Display job alerts dashboard
     */
    public function index(): \Illuminate\Contracts\View\View
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate) {
            abort(404);
        }

        $alerts = CandidateJobAlert::where('candidate_id', $candidate->id)
            ->with('logs')
            ->latest()
            ->paginate(10);

        $suggestions = $this->alertService->suggestAlerts($candidate);

        return view('frontend.candidate-dashboard.job-alerts.index', compact('alerts', 'suggestions'));
    }

    /**
     * Show create alert form
     */
    public function create(): \Illuminate\Contracts\View\View
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate) {
            abort(404);
        }

        $categories = JobCategory::active()->get();
        $types = JobType::all();
        $roles = JobRole::active()->get();
        $experiences = JobExperience::all();

        $suggestions = $this->alertService->suggestAlerts($candidate);

        return view('frontend.candidate-dashboard.job-alerts.create', compact(
            'categories',
            'types',
            'roles',
            'experiences',
            'suggestions'
        ));
    }

    /**
     * Store new alert
     */
    public function store(Request $request): \Illuminate\Http\RedirectResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate) {
            abort(404);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'keywords' => 'nullable|array',
            'keywords.*' => 'string',
            'job_categories' => 'nullable|array',
            'job_types' => 'nullable|array',
            'job_roles' => 'nullable|array',
            'locations' => 'nullable|array',
            'min_salary' => 'nullable|numeric|min:0',
            'max_salary' => 'nullable|numeric|min:0',
            'experience_levels' => 'nullable|array',
            'email_enabled' => 'boolean',
            'sms_enabled' => 'boolean',
            'push_enabled' => 'boolean',
            'frequency' => 'required|in:immediate,daily,weekly',
            'preferred_time' => 'nullable|date_format:H:i',
            'quiet_hours_start' => 'nullable|date_format:H:i',
            'quiet_hours_end' => 'nullable|date_format:H:i',
            'match_threshold' => 'required|integer|min:0|max:100',
        ]);

        // Prepare data
        $data = [
            'candidate_id' => $candidate->id,
            'name' => $validated['name'],
            'keywords' => $validated['keywords'] ?? null,
            'job_categories' => $validated['job_categories'] ?? null,
            'job_types' => $validated['job_types'] ?? null,
            'job_roles' => $validated['job_roles'] ?? null,
            'locations' => $validated['locations'] ?? null,
            'experience_levels' => $validated['experience_levels'] ?? null,
            'email_enabled' => $request->boolean('email_enabled', true),
            'sms_enabled' => $request->boolean('sms_enabled', false),
            'push_enabled' => $request->boolean('push_enabled', true),
            'frequency' => $validated['frequency'],
            'preferred_time' => $validated['preferred_time'] ?? null,
            'match_threshold' => $validated['match_threshold'],
        ];

        // Add salary range if provided
        if ($request->filled('min_salary') || $request->filled('max_salary')) {
            $data['salary_range'] = [
                'min' => $validated['min_salary'] ?? null,
                'max' => $validated['max_salary'] ?? null,
            ];
        }

        // Add quiet hours if provided
        if ($request->filled('quiet_hours_start') && $request->filled('quiet_hours_end')) {
            $data['quiet_hours'] = [
                'start' => $validated['quiet_hours_start'],
                'end' => $validated['quiet_hours_end'],
            ];
        }

        CandidateJobAlert::create($data);

        notify()->success('Job alert created successfully! You will receive notifications for matching jobs.', 'Success');

        return redirect()->route('member.job-alerts.index');
    }

    /**
     * Show edit form
     */
    public function edit(CandidateJobAlert $jobAlert): \Illuminate\Contracts\View\View
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate || $jobAlert->candidate_id !== $candidate->id) {
            abort(403);
        }

        $categories = JobCategory::active()->get();
        $types = JobType::all();
        $roles = JobRole::active()->get();
        $experiences = JobExperience::all();

        $stats = $this->alertService->getAlertStats($jobAlert);

        return view('frontend.candidate-dashboard.job-alerts.edit', compact(
            'jobAlert',
            'categories',
            'types',
            'roles',
            'experiences',
            'stats'
        ));
    }

    /**
     * Update alert
     */
    public function update(Request $request, CandidateJobAlert $jobAlert): \Illuminate\Http\RedirectResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate || $jobAlert->candidate_id !== $candidate->id) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'keywords' => 'nullable|array',
            'job_categories' => 'nullable|array',
            'job_types' => 'nullable|array',
            'job_roles' => 'nullable|array',
            'locations' => 'nullable|array',
            'min_salary' => 'nullable|numeric|min:0',
            'max_salary' => 'nullable|numeric|min:0',
            'experience_levels' => 'nullable|array',
            'email_enabled' => 'boolean',
            'sms_enabled' => 'boolean',
            'push_enabled' => 'boolean',
            'frequency' => 'required|in:immediate,daily,weekly',
            'preferred_time' => 'nullable|date_format:H:i',
            'quiet_hours_start' => 'nullable|date_format:H:i',
            'quiet_hours_end' => 'nullable|date_format:H:i',
            'match_threshold' => 'required|integer|min:0|max:100',
            'is_active' => 'boolean',
        ]);

        $data = [
            'name' => $validated['name'],
            'keywords' => $validated['keywords'] ?? null,
            'job_categories' => $validated['job_categories'] ?? null,
            'job_types' => $validated['job_types'] ?? null,
            'job_roles' => $validated['job_roles'] ?? null,
            'locations' => $validated['locations'] ?? null,
            'experience_levels' => $validated['experience_levels'] ?? null,
            'email_enabled' => $request->boolean('email_enabled', true),
            'sms_enabled' => $request->boolean('sms_enabled', false),
            'push_enabled' => $request->boolean('push_enabled', true),
            'frequency' => $validated['frequency'],
            'preferred_time' => $validated['preferred_time'] ?? null,
            'match_threshold' => $validated['match_threshold'],
            'is_active' => $request->boolean('is_active', true),
        ];

        if ($request->filled('min_salary') || $request->filled('max_salary')) {
            $data['salary_range'] = [
                'min' => $validated['min_salary'] ?? null,
                'max' => $validated['max_salary'] ?? null,
            ];
        }

        if ($request->filled('quiet_hours_start') && $request->filled('quiet_hours_end')) {
            $data['quiet_hours'] = [
                'start' => $validated['quiet_hours_start'],
                'end' => $validated['quiet_hours_end'],
            ];
        }

        $jobAlert->update($data);

        notify()->success('Job alert updated successfully!', 'Success');

        return redirect()->route('member.job-alerts.index');
    }

    /**
     * Delete alert
     */
    public function destroy(CandidateJobAlert $jobAlert): \Illuminate\Http\RedirectResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate || $jobAlert->candidate_id !== $candidate->id) {
            abort(403);
        }

        $jobAlert->delete();

        notify()->success('Job alert deleted successfully!', 'Success');

        return redirect()->route('member.job-alerts.index');
    }

    /**
     * Toggle alert active status
     */
    public function toggle(CandidateJobAlert $jobAlert): \Illuminate\Http\RedirectResponse
    {
        $candidate = Auth::user()->candidate;

        if (!$candidate || $jobAlert->candidate_id !== $candidate->id) {
            abort(403);
        }

        $jobAlert->update([
            'is_active' => !$jobAlert->is_active
        ]);

        $status = $jobAlert->is_active ? 'activated' : 'deactivated';
        notify()->success("Job alert {$status} successfully!", 'Success');

        return redirect()->back();
    }

    /**
     * Unsubscribe from alert (via email link)
     */
    public function unsubscribe(CandidateJobAlert $jobAlert): \Illuminate\Contracts\View\View
    {
        $jobAlert->update(['is_active' => false]);

        return view('frontend.candidate-dashboard.job-alerts.unsubscribed', compact('jobAlert'));
    }

    /**
     * Track alert click
     */
    public function trackClick(Request $request): \Illuminate\Http\JsonResponse
    {
        $alertId = $request->input('alert');
        $jobId = $request->input('job');

        if ($alertId && $jobId) {
            $log = JobAlertLog::where('alert_id', $alertId)
                ->where('job_id', $jobId)
                ->latest()
                ->first();

            if ($log) {
                $log->markAsClicked();

                // Learn from interaction
                $this->alertService->learnFromInteraction(
                    $log->alert,
                    $log->job,
                    'click'
                );
            }
        }

        return response()->json(['success' => true]);
    }
}

