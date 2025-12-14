<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Services\CareerInsightsService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\View\View;

final class CandidateCareerInsightsController extends Controller
{
	public function __construct(private CareerInsightsService $careerInsightsService)
	{
	}

	public function index(): View
	{
		$user = Auth::user();

		abort_unless($user && $user->candidateProfile, 403, 'Candidate profile not found.');

		$candidate = $user->candidateProfile->loadMissing([
			'skills.skill',
			'experiences',
			'educations',
			'profession',
		]);

		try {
			$insights = $this->careerInsightsService->generateInsights($candidate);
		} catch (\Throwable $throwable) {
			Log::error('Career insights failed', [
				'candidate_id' => $candidate->id,
				'message' => $throwable->getMessage(),
			]);
			$insights = [
				'snapshot' => [],
				'growth_opportunities' => [],
				'skill_recommendations' => [],
				'market_trends' => [],
			];
		}

		return view('frontend.candidates.career-insights', [
			'candidate' => $candidate,
			'insights' => $insights,
		]);
	}
}


