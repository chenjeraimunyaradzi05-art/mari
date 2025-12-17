<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\Job;
use App\Services\SmartJobPostingService;
use App\Services\AICacheService;
use App\Services\AIErrorHandler;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\View\View;

final class SmartJobPostingController extends Controller
{
    public function __construct(
        protected SmartJobPostingService $smartJobService,
        protected AICacheService $cacheService,
        protected AIErrorHandler $errorHandler
    ) {}

    /**
     * Show smart job posting dashboard
     */
    public function index(): View
    {
        try {
            $startTime = microtime(true);

            // Get user's recent jobs
            $recentJobs = Job::where('company_id', auth()->user()->company?->id)
                ->latest()
                ->take(5)
                ->with(['skills', 'benefits', 'tags'])
                ->get();

            // Calculate average quality score
            $avgQualityScore = 0;
            if ($recentJobs->count() > 0) {
                $totalScore = 0;
                foreach ($recentJobs as $job) {
                    $analysis = $this->smartJobService->analyzeJobQuality($job);
                    $totalScore += $analysis['quality_score'];
                }
                $avgQualityScore = round($totalScore / $recentJobs->count(), 1);
            }

            // Get market insights
            $marketInsights = $this->smartJobService->getMarketInsights();

            $this->errorHandler->trackPerformance(
                'smart_job_posting_dashboard',
                microtime(true) - $startTime
            );

            return view('frontend.company-dashboard.smart-posting.index', compact(
                'recentJobs',
                'avgQualityScore',
                'marketInsights'
            ));
        } catch (\Exception $e) {
            $this->errorHandler->handleAIError($e, 'smart_job_posting_dashboard', [
                'company_id' => auth()->user()->company?->id,
            ]);

            return view('frontend.company-dashboard.smart-posting.index')
                ->with('error', 'Unable to load AI insights. Please try again.');
        }
    }

    /**
     * Generate AI job description
     */
    public function generateDescription(Request $request): JsonResponse
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'category' => 'nullable|string',
            'experience' => 'nullable|string',
        ]);

        try {
            $startTime = microtime(true);

            $result = $this->smartJobService->generateJobDescription([
                'title' => $request->title,
                'category' => $request->category,
                'experience' => $request->experience ?? 'mid-level',
                'company_name' => auth()->user()->company?->name ?? 'our company',
            ]);

            $this->errorHandler->logUsage('generate_job_description', [
                'company_id' => auth()->user()->company?->id,
                'title' => $request->title,
            ]);

            $this->errorHandler->trackPerformance(
                'generate_job_description',
                microtime(true) - $startTime
            );

            return response()->json($result);
        } catch (\Exception $e) {
            $this->errorHandler->handleAIError($e, 'generate_job_description', [
                'title' => $request->title,
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to generate job description',
            ], 500);
        }
    }

    /**
     * Suggest salary range
     */
    public function suggestSalary(Request $request): JsonResponse
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'category_id' => 'nullable|integer',
        ]);

        try {
            $result = $this->smartJobService->suggestSalaryRange(
                $request->title,
                $request->category_id
            );

            $this->errorHandler->logUsage('suggest_salary', [
                'company_id' => auth()->user()->company?->id,
                'title' => $request->title,
            ]);

            return response()->json($result);
        } catch (\Exception $e) {
            $this->errorHandler->handleAIError($e, 'suggest_salary', [
                'title' => $request->title,
            ]);

            return response()->json([
                'error' => 'Failed to suggest salary range',
            ], 500);
        }
    }

    /**
     * Suggest relevant skills
     */
    public function suggestSkills(Request $request): JsonResponse
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'category_id' => 'nullable|integer',
        ]);

        try {
            $result = $this->smartJobService->suggestSkills(
                $request->title,
                $request->category_id
            );

            $this->errorHandler->logUsage('suggest_skills', [
                'company_id' => auth()->user()->company?->id,
                'title' => $request->title,
            ]);

            return response()->json($result);
        } catch (\Exception $e) {
            $this->errorHandler->handleAIError($e, 'suggest_skills', [
                'title' => $request->title,
            ]);

            return response()->json([
                'error' => 'Failed to suggest skills',
            ], 500);
        }
    }

    /**
     * Optimize job for SEO
     */
    public function optimizeSEO(Request $request): JsonResponse
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'required|string',
        ]);

        try {
            $result = $this->smartJobService->optimizeForSEO([
                'title' => $request->title,
                'description' => $request->description,
            ]);

            $this->errorHandler->logUsage('optimize_seo', [
                'company_id' => auth()->user()->company?->id,
                'title' => $request->title,
            ]);

            return response()->json($result);
        } catch (\Exception $e) {
            $this->errorHandler->handleAIError($e, 'optimize_seo', [
                'title' => $request->title,
            ]);

            return response()->json([
                'error' => 'Failed to optimize SEO',
            ], 500);
        }
    }

    /**
     * Get market insights
     */
    public function getMarketInsights(Request $request): JsonResponse
    {
        try {
            $result = $this->smartJobService->getMarketInsights(
                $request->category_id,
                $request->location
            );

            return response()->json($result);
        } catch (\Exception $e) {
            $this->errorHandler->handleAIError($e, 'market_insights');

            return response()->json([
                'error' => 'Failed to fetch market insights',
            ], 500);
        }
    }

    /**
     * Analyze job quality
     */
    public function analyzeQuality(Request $request): JsonResponse
    {
        $request->validate([
            'job_id' => 'required|integer|exists:jobs,id',
        ]);

        try {
            $job = Job::with(['skills', 'benefits', 'tags'])
                ->where('company_id', auth()->user()->company?->id)
                ->findOrFail($request->job_id);

            $result = $this->smartJobService->analyzeJobQuality($job);

            $this->errorHandler->logUsage('analyze_job_quality', [
                'company_id' => auth()->user()->company?->id,
                'job_id' => $job->id,
            ]);

            return response()->json($result);
        } catch (\Exception $e) {
            $this->errorHandler->handleAIError($e, 'analyze_job_quality', [
                'job_id' => $request->job_id,
            ]);

            return response()->json([
                'error' => 'Failed to analyze job quality',
            ], 500);
        }
    }
}

