<?php

declare(strict_types=1);

namespace App\Http\Controllers\WomenRealEstate;

use App\Http\Controllers\Controller;
use App\Models\LearningPathEnrolment;
use App\Models\RealEstateLearningPath;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\View\View;

final class LearningPathController extends Controller
{
    public function __construct()
    {
        $this->middleware(['auth', 'verified']);
    }

    public function index(Request $request): View
    {
        $paths = RealEstateLearningPath::query()
            ->orderBy('difficulty_level')
            ->orderBy('title')
            ->withCount([
                'enrolments as active_enrolments_count' => fn ($query) => $query->where('enrolment_status', 'active'),
                'enrolments as completed_enrolments_count' => fn ($query) => $query->where('enrolment_status', 'completed'),
                'enrolments as dropped_enrolments_count' => fn ($query) => $query->where('enrolment_status', 'dropped'),
            ])
            ->get();

        $user = $request->user();

        $enrolments = $user->realEstateLearningPathEnrolments()
            ->with('path')
            ->get()
            ->keyBy('real_estate_learning_path_id');

        $progressAverages = LearningPathEnrolment::query()
            ->selectRaw('real_estate_learning_path_id, AVG(progress_percent) as avg_progress')
            ->groupBy('real_estate_learning_path_id')
            ->pluck('avg_progress', 'real_estate_learning_path_id');

        $pathInsights = $paths
            ->map(function (RealEstateLearningPath $path) use ($progressAverages) {
                $avgProgress = (float) ($progressAverages[$path->id] ?? 0);

                return [
                    'id' => $path->id,
                    'title' => $path->title,
                    'label' => Str::limit($path->title, 28, '...'),
                    'active' => (int) $path->active_enrolments_count,
                    'completed' => (int) $path->completed_enrolments_count,
                    'dropped' => (int) $path->dropped_enrolments_count,
                    'avg_progress' => round($avgProgress, 1),
                ];
            })
            ->sortByDesc(fn (array $insight) => $insight['active'] + $insight['completed'])
            ->take(8)
            ->values();

        $enrolmentSnapshot = LearningPathEnrolment::query()
            ->selectRaw('COUNT(*) as total')
            ->selectRaw('SUM(enrolment_status = "active") as active')
            ->selectRaw('SUM(enrolment_status = "completed") as completed')
            ->selectRaw('SUM(enrolment_status = "dropped") as dropped')
            ->selectRaw('AVG(progress_percent) as avg_progress')
            ->first();

        $dashboardStats = [
            [
                'label' => 'Total Cohorts',
                'value' => $paths->count(),
                'suffix' => null,
            ],
            [
                'label' => 'Real-time Enrolments',
                'value' => (int) ($enrolmentSnapshot->total ?? 0),
                'suffix' => null,
            ],
            [
                'label' => 'Active Momentum',
                'value' => (int) ($enrolmentSnapshot->active ?? 0),
                'suffix' => null,
            ],
            [
                'label' => 'Avg Progress',
                'value' => round((float) ($enrolmentSnapshot->avg_progress ?? 0), 1),
                'suffix' => '%',
            ],
        ];

        $statusDistribution = [
            'Active' => (int) ($enrolmentSnapshot->active ?? 0),
            'Completed' => (int) ($enrolmentSnapshot->completed ?? 0),
            'Paused' => (int) ($enrolmentSnapshot->dropped ?? 0),
        ];

        $progressTrend = LearningPathEnrolment::query()
            ->selectRaw('DATE(updated_at) as day')
            ->selectRaw('ROUND(AVG(progress_percent), 1) as avg_progress')
            ->where('updated_at', '>=', now()->subDays(14))
            ->whereNotNull('updated_at')
            ->groupBy('day')
            ->orderBy('day')
            ->get()
            ->map(fn ($row) => [
                'day' => $row->day,
                'avg_progress' => (float) $row->avg_progress,
            ])
            ->values();

        return view('women.learn.index', [
            'paths' => $paths,
            'enrolments' => $enrolments,
            'pathInsights' => $pathInsights,
            'dashboardStats' => $dashboardStats,
            'statusDistribution' => $statusDistribution,
            'progressTrend' => $progressTrend,
        ]);
    }

    public function enrol(Request $request, RealEstateLearningPath $path): RedirectResponse
    {
        $validated = $request->validate([
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $user = $request->user();

        LearningPathEnrolment::query()->updateOrCreate(
            [
                'real_estate_learning_path_id' => $path->id,
                'user_id' => $user->id,
            ],
            [
                'enrolment_status' => 'active',
                'notes' => $validated['notes'] ?? null,
                'last_ai_check_in_at' => now(),
            ]
        );

        return redirect()
            ->route('women.learn.index')
            ->with('status', 'You are enrolled. We will surface new modules as they unlock.');
    }

    public function withdraw(Request $request, RealEstateLearningPath $path): RedirectResponse
    {
        $user = $request->user();

        $enrolment = $user->realEstateLearningPathEnrolments()
            ->where('real_estate_learning_path_id', $path->id)
            ->first();

        if ($enrolment) {
            $enrolment->delete();
        }

        return redirect()
            ->route('women.learn.index')
            ->with('status', 'You have been withdrawn from this path.');
    }

    public function update(Request $request, RealEstateLearningPath $path): RedirectResponse
    {
        $user = $request->user();

        $enrolment = $user->realEstateLearningPathEnrolments()
            ->where('real_estate_learning_path_id', $path->id)
            ->first();

        if (! $enrolment) {
            return redirect()
                ->route('women.learn.index')
                ->withErrors(['enrolment' => 'Join the path before updating your progress.']);
        }

        $validated = $request->validate([
            'progress_percent' => ['required', 'integer', 'min:0', 'max:100'],
            'enrolment_status' => ['required', 'in:active,completed,dropped'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $enrolment->update([
            'progress_percent' => $validated['progress_percent'],
            'enrolment_status' => $validated['enrolment_status'],
            'notes' => $validated['notes'] ?? null,
            'last_ai_check_in_at' => now(),
        ]);

        return redirect()
            ->route('women.learn.index')
            ->with('status', 'Progress saved. We refreshed your mentor signals.');
    }
}

