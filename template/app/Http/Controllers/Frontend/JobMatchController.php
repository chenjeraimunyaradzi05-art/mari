<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Services\JobRecommendationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Session;
use Illuminate\View\View;

final class JobMatchController extends Controller
{
	public function __construct(private JobRecommendationService $jobRecommendationService)
	{
	}

	public function index(Request $request): View
	{
		$user = Auth::user();

		abort_unless($user && $user->candidateProfile, 403, 'Candidate profile not found.');

		$candidate = $user->candidateProfile->loadMissing(['skills.skill', 'experiences', 'profession']);

		$preferences = $request->only([
			'job_category_id',
			'job_type_id',
			'job_location',
			'salary_min',
			'salary_max',
		]);

		try {
			$recommendations = $this->jobRecommendationService
				->generateJobRecommendations($candidate->id, $preferences);
		} catch (\Throwable $throwable) {
			Log::error('Job recommendations failed', [
				'candidate_id' => $candidate->id,
				'message' => $throwable->getMessage(),
			]);
			Session::flash('error', 'We could not generate matches right now. Please try again later.');
			$recommendations = collect();
		}

	$metrics = $this->jobRecommendationService->getRecommendationMetrics($candidate->id, $recommendations);

		return view('frontend.candidates.job-recommendations', [
			'candidate' => $candidate,
			'recommendations' => $recommendations,
			'metrics' => $metrics,
			'filters' => $preferences,
		]);
	}
}

