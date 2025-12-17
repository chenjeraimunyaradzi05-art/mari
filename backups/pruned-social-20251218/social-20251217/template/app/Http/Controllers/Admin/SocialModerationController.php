<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SocialBlock;
use App\Models\SocialReport;
use App\Models\SocialSensitiveTerm;
use App\Models\SocialTransparencyLog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use App\Models\SocialModerationEvent;
use App\Services\SocialModerationService;
use App\Models\SocialEnforcementAction;
use Illuminate\View\View;

final class SocialModerationController extends Controller
{
    public function dashboard(): View
    {
        $stats = [
            'open_reports' => SocialReport::open()->count(),
            'active_blocks' => SocialBlock::active()->count(),
            'actions_7_days' => SocialEnforcementAction::where('created_at', '>=', now()->subDays(7))->count(),
            'public_logs' => SocialTransparencyLog::where('visibility', 'public')->count(),
        ];

        $recentLogs = SocialTransparencyLog::latest()->limit(20)->get();
        $recentReports = SocialReport::with('reportable', 'reporter')->latest()->limit(10)->get();

        return view('admin.moderation.dashboard', compact('stats', 'recentLogs', 'recentReports'));
    }

    public function reports(Request $request): View
    {
        $query = SocialReport::query()->with(['reportable', 'reporter', 'reviewer']);

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        if ($category = $request->input('category')) {
            $query->where('category', $category);
        }

        $reports = $query->latest()->paginate(30)->withQueryString();

        return view('admin.moderation.reports', compact('reports'));
    }

    public function showReport(SocialReport $report): View
    {
        $report->load(['reportable', 'reporter', 'reviewer', 'enforcementActions']);

        return view('admin.moderation.report', compact('report'));
    }

    public function assignReport(Request $request, SocialReport $report): RedirectResponse|\Illuminate\Http\JsonResponse
    {
        $admin = $request->user('admin');
        // Only admins with moderation.review should be able to assign reports
        abort_if(!$admin || !$admin->can('moderation.review'), 403);

        $report->update([
            'reviewer_id' => $admin?->id,
            // normalize to existing enum statuses
            'status' => 'under_review',
        ]);

        // Record moderation event
        $subject = $report->reportable;

        SocialModerationEvent::create([
            'social_post_id' => $subject instanceof \App\Models\SocialPost ? $subject->id : $report->reportable_id,
            'event_type' => 'assigned',
            'actor_type' => 'admin',
            'actor_id' => $admin?->id,
            'payload' => ['report_id' => $report->id, 'assigned_to' => $admin?->id],
            'occurred_at' => now(),
        ]);

        if ($request->expectsJson()) {
            return response()->json(['status' => 'assigned', 'report' => $report->fresh()], 200);
        }

        return redirect()->route('admin.moderation.reports.show', $report)->with('success', 'Report assigned to you.');
    }

    public function decideReport(Request $request, SocialReport $report): RedirectResponse|\Illuminate\Http\JsonResponse
    {
        $admin = $request->user('admin');

        $admin = $request->user('admin');
        // Only admins with moderation.review should be able to decide reports
        abort_if(!$admin || !$admin->can('moderation.review'), 403);

        $validated = $request->validate([
            'decision' => ['required', 'string', 'in:approved,rejected,dismissed'],
            'reason' => ['nullable', 'string', 'max:1000'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        // map incoming decision strings into canonical report statuses
        $decisionToReportStatus = [
            'approved' => 'dismissed',
            'rejected' => 'action_taken',
            'dismissed' => 'dismissed',
        ];

        $mappedStatus = $decisionToReportStatus[$validated['decision']] ?? $validated['decision'];

        $report->update([
            'status' => $mappedStatus,
            'reviewed_at' => now(),
            'reviewer_id' => $admin?->id,
        ]);

        // Apply decision to underlying post via SocialModerationService
        $subject = $report->reportable;
        if ($subject) {
            // if reportable is a post, let the moderation service record the decision
            if ($subject instanceof \App\Models\SocialPost) {
                app(SocialModerationService::class)->recordDecision($subject, $validated['decision'], [
                'report_ids' => [$report->id],
                'reviewer_id' => $admin?->id,
                'rationale' => $validated['reason'] ?? null,
                'actor_type' => 'admin',
                'actor_id' => $admin?->id,
            ]);
            }

        }


        // store enforcement action for audit trail
        // store enforcement action for audit trail. Use reportable type and id as subject
        SocialEnforcementAction::create([
            'subject_type' => $report->reportable_type,
            'subject_id' => $report->reportable_id,
            'action_type' => 'moderation_decision',
            // enforcement actions use their own lifecycle fields - mark as active when applied
            'status' => 'active',
            'reason' => $validated['reason'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'issued_by' => $admin?->id,
            'issued_by_type' => 'admin',
            'report_id' => $report->id,
        ]);

        if ($request->expectsJson()) {
            return response()->json(['status' => 'decision_recorded', 'report' => $report->fresh()], 200);
        }

        return redirect()->route('admin.moderation.reports.show', $report)->with('success', 'Decision recorded.');
    }

    public function reportEvents(SocialReport $report): \Illuminate\Http\JsonResponse
    {
        $postId = $report->reportable_id;
        $events = SocialModerationEvent::query()->where('social_post_id', $postId)->latest()->get();

        return response()->json(['events' => $events]);
    }

    /**
     * Provider metrics for observability (OpenAI circuit and counters)
     */
    public function providerMetrics(): \Illuminate\Http\JsonResponse
    {
        $failures = (int) Cache::get('openai_moderation_failures', 0);
        $successes = (int) Cache::get('openai_moderation_success', 0);
        $circuitOpen = (bool) Cache::get('openai_moderation_circuit', false);

        return response()->json([
            'openai' => [
                'failures' => $failures,
                'successes' => $successes,
                'circuit_open' => $circuitOpen,
            ],
        ]);
    }

    /**
     * Bulk assignment for a set of report ids.  Expects JSON { report_ids: [..] }
     */
    public function bulkAssign(Request $request): \Illuminate\Http\JsonResponse
    {
        $admin = $request->user('admin');
        abort_if(!$admin || !$admin->can('moderation.review'), 403);

        $validated = $request->validate([
            'report_ids' => ['required', 'array', 'min:1'],
            'report_ids.*' => ['integer', 'exists:social_reports,id']
        ]);

        $reports = SocialReport::whereIn('id', $validated['report_ids'])->get();

        foreach ($reports as $report) {
            $report->update(['reviewer_id' => $admin?->id, 'status' => 'under_review']);

            SocialModerationEvent::create([
                'social_post_id' => $report->reportable_id,
                'event_type' => 'assigned',
                'actor_type' => 'admin',
                'actor_id' => $admin?->id,
                'payload' => ['report_id' => $report->id, 'assigned_to' => $admin?->id],
                'occurred_at' => now(),
            ]);
        }

        return response()->json(['status' => 'assigned', 'count' => $reports->count()]);
    }

    /**
     * Bulk decision processing. Expects { report_ids: [], decision: 'approved|rejected|dismissed' }
     */
    public function bulkDecide(Request $request): \Illuminate\Http\JsonResponse
    {
        $admin = $request->user('admin');
        abort_if(!$admin || !$admin->can('moderation.review'), 403);

        $validated = $request->validate([
            'report_ids' => ['required', 'array', 'min:1'],
            'report_ids.*' => ['integer', 'exists:social_reports,id'],
            'decision' => ['required', 'string', 'in:approved,rejected,dismissed'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $mapping = [
            'approved' => 'dismissed',
            'rejected' => 'action_taken',
            'dismissed' => 'dismissed',
        ];

        $reports = SocialReport::whereIn('id', $validated['report_ids'])->get();

        foreach ($reports as $report) {
            $report->update([
                'status' => $mapping[$validated['decision']] ?? $validated['decision'],
                'reviewed_at' => now(),
                'reviewer_id' => $admin?->id,
            ]);

            $subject = $report->reportable;
            if ($subject instanceof \App\Models\SocialPost) {
                app(SocialModerationService::class)->recordDecision($subject, $validated['decision'], [
                    'report_ids' => [$report->id],
                    'reviewer_id' => $admin?->id,
                    'rationale' => $validated['reason'] ?? null,
                    'actor_type' => 'admin',
                    'actor_id' => $admin?->id,
                ]);
            }

            SocialEnforcementAction::create([
                'subject_type' => $report->reportable_type,
                'subject_id' => $report->reportable_id,
                'action_type' => 'moderation_decision',
                'status' => 'active',
                'reason' => $validated['reason'] ?? null,
                'notes' => null,
                'issued_by' => $admin?->id,
                'issued_by_type' => 'admin',
                'report_id' => $report->id,
            ]);

            SocialModerationEvent::create([
                'social_post_id' => $report->reportable_id,
                'event_type' => 'decision_recorded',
                'actor_type' => 'admin',
                'actor_id' => $admin?->id,
                'payload' => ['report_id' => $report->id, 'decision' => $validated['decision']],
                'occurred_at' => now(),
            ]);
        }

        return response()->json(['status' => 'decision_recorded', 'count' => $reports->count()], 200);
    }

    public function blocks(): View
    {
        $blocks = SocialBlock::with(['blocker', 'blocked', 'enforcementAction'])->latest()->paginate(30);

        return view('admin.moderation.blocks', compact('blocks'));
    }

    public function terms(): View
    {
        $terms = SocialSensitiveTerm::orderBy('term')->paginate(50);

        return view('admin.moderation.terms', compact('terms'));
    }

    public function storeTerm(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'term' => ['required', 'string', 'max:255'],
            'severity' => ['required', 'string'],
            'replacement' => ['nullable', 'string', 'max:255'],
            'tags' => ['nullable', 'array'],
            'contexts' => ['nullable', 'array'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $validated['created_by'] = $request->user('admin')?->id;
        $validated['is_active'] = $request->boolean('is_active', true);

        SocialSensitiveTerm::create($validated);

        return redirect()->route('admin.moderation.terms')->with('success', 'Sensitive term added.');
    }

    public function updateTerm(SocialSensitiveTerm $term, Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'term' => ['required', 'string', 'max:255'],
            'severity' => ['required', 'string'],
            'replacement' => ['nullable', 'string', 'max:255'],
            'tags' => ['nullable', 'array'],
            'contexts' => ['nullable', 'array'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $validated['is_active'] = $request->boolean('is_active', true);

        $term->update($validated);

        return redirect()->route('admin.moderation.terms')->with('success', 'Sensitive term updated.');
    }

    public function destroyTerm(SocialSensitiveTerm $term): RedirectResponse
    {
        $term->delete();

        return redirect()->route('admin.moderation.terms')->with('success', 'Sensitive term removed.');
    }
}

