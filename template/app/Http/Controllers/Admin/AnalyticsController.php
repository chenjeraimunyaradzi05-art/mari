<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AnalyticsService;
use Illuminate\Http\Request;

final class AnalyticsController extends Controller
{
    protected $analyticsService;

    public function __construct(AnalyticsService $analyticsService)
    {
        $this->analyticsService = $analyticsService;
    }

    /**
     * Display analytics dashboard
     *
     * @return \Illuminate\View\View
     */
    public function index()
    {
        $overview = $this->analyticsService->getOverviewStats();
        $topCategories = $this->analyticsService->getTopJobCategories(8);
        $applicationStatus = $this->analyticsService->getApplicationStatusDistribution();
        $topCompanies = $this->analyticsService->getTopCompaniesByJobs(5);
        $recentApplications = $this->analyticsService->getRecentApplications(10);
        $recentTransactions = $this->analyticsService->getRecentTransactions(10);
        $conversionMetrics = $this->analyticsService->getConversionMetrics();
        $monthlyRevenue = $this->analyticsService->getMonthlyRevenueComparison();
        $jobTypeDistribution = $this->analyticsService->getJobTypeDistribution();
        $geographicDistribution = $this->analyticsService->getGeographicDistribution();

        return view('admin.analytics.index', compact(
            'overview',
            'topCategories',
            'applicationStatus',
            'topCompanies',
            'recentApplications',
            'recentTransactions',
            'conversionMetrics',
            'monthlyRevenue',
            'jobTypeDistribution',
            'geographicDistribution'
        ));
    }

    /**
     * Get chart data via AJAX
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getChartData(Request $request)
    {
        $type = $request->input('type');
        $period = $request->input('period', '30days');

        $data = match($type) {
            'jobs_over_time' => $this->analyticsService->getJobsOverTime($period),
            'applications_over_time' => $this->analyticsService->getApplicationsOverTime($period),
            'revenue_over_time' => $this->analyticsService->getRevenueOverTime($period),
            'user_registrations' => $this->analyticsService->getUserRegistrationsOverTime($period),
            default => ['error' => 'Invalid chart type'],
        };

        return response()->json($data);
    }

    /**
     * Refresh analytics cache
     *
     * @return \Illuminate\Http\RedirectResponse
     */
    public function refreshCache(): \Illuminate\Http\RedirectResponse
    {
        $this->analyticsService->clearCache();

        return redirect()->route('admin.analytics')
            ->with('success', 'Analytics cache refreshed successfully!');
    }

    /**
     * Export analytics data
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse|\Illuminate\Http\Response
     */
    public function export(Request $request): \Illuminate\Http\Response|\Illuminate\Http\JsonResponse
    {
        $format = $request->input('format', 'csv');

        $overview = $this->analyticsService->getOverviewStats();
        $recentApplications = $this->analyticsService->getRecentApplications(100);
        $recentTransactions = $this->analyticsService->getRecentTransactions(100);

        if ($format === 'json') {
            return response()->json([
                'overview' => $overview,
                'applications' => $recentApplications,
                'transactions' => $recentTransactions,
                'exported_at' => now()->toIso8601String(),
            ]);
        }

        // CSV export
        $csv = "Analytics Export - " . now()->format('Y-m-d H:i:s') . "\n\n";
        $csv .= "Overview Statistics\n";
        $csv .= "-------------------\n";
        foreach ($overview as $key => $value) {
            $csv .= ucwords(str_replace('_', ' ', $key)) . "," . $value . "\n";
        }

        return response($csv)
            ->header('Content-Type', 'text/csv')
            ->header('Content-Disposition', 'attachment; filename="analytics-' . now()->format('Y-m-d') . '.csv"');
    }
}

