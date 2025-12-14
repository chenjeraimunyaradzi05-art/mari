<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\JobRecommendationAudit;
use App\Models\SkillDemandData;
use App\Models\SkillGapAnalysis;
use App\Models\WarmupMetricEvent;
use App\Models\WarmupMetricSnapshot;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

final class OmegaAIController extends Controller
{
	public function index(): View
	{
		$capabilities = $this->buildCapabilities();
		$integrationStatus = $this->buildIntegrationStatus();
		$nextFocus = $this->buildNextFocus();

		return view('admin.omega-ai.index', compact('capabilities', 'integrationStatus', 'nextFocus'));
	}

	/**
	 * @return string[][]
	 *
	 * @psalm-return list{array{title: 'Job Recommendations Engine', description: string}, array{title: 'Skill Intelligence Graph', description: string}, array{title: 'Career Gap Insights', description: string}}
	 */
	private function buildCapabilities(): array
	{
		$recommendationStats = JobRecommendationAudit::query()
			->select([
				DB::raw('SUM(match_total) as matches'),
				DB::raw('AVG(average_score) as avg_score'),
				DB::raw('AVG(employer_diversity) as employer_diversity'),
			])
			->where('recorded_at', '>=', now()->subDays(30))
			->first();

		$skillSignals = SkillDemandData::query()->recent(30)->count();
		$gapAnalyses = SkillGapAnalysis::query()->recent(30)->count();

		return [
			[
				'title' => 'Job Recommendations Engine',
				'description' => sprintf(
					'%s matches scored (avg %s) with %s employer diversity over the last 30 days.',
					number_format($recommendationStats?->matches ?? 0),
					number_format($recommendationStats?->avg_score ?? 0, 2),
					number_format(($recommendationStats?->employer_diversity ?? 0) * 100, 1) . '%'
				),
			],
			[
				'title' => 'Skill Intelligence Graph',
				'description' => sprintf('%s skill demand snapshots refreshed in the past month.', number_format($skillSignals)),
			],
			[
				'title' => 'Career Gap Insights',
				'description' => sprintf('%s candidate gap analyses ingested for personalised coaching.', number_format($gapAnalyses)),
			],
		];
	}

	/**
	 * @return string[][]
	 *
	 * @psalm-return list{array{name: 'Warmup Pipeline', state: 'Live'|'Pending', coverage: string}, array{name: 'Recommendation Audits', state: 'Backlog'|'Operational', coverage: string}, array{name: 'Skill Demand Signals', state: 'Live'|'Refreshing', coverage: string}}
	 */
	private function buildIntegrationStatus(): array
	{
		$recentWarmup = WarmupMetricSnapshot::latestSnapshot()->first();
		$totalWarmup = ($recentWarmup?->success_count ?? 0) + ($recentWarmup?->failure_count ?? 0);
		$warmupSuccess = $recentWarmup?->success_count ?? 0;
		$warmupCoverage = $totalWarmup > 0 ? number_format(($warmupSuccess / $totalWarmup) * 100, 1) . '% success' : 'No data';

		$recentAudits = JobRecommendationAudit::query()->where('recorded_at', '>=', now()->subDays(7))->count();
		$recentSkills = SkillDemandData::query()->recent(14)->count();

		return [
			[
				'name' => 'Warmup Pipeline',
				'state' => $totalWarmup > 0 ? 'Live' : 'Pending',
				'coverage' => $warmupCoverage,
			],
			[
				'name' => 'Recommendation Audits',
				'state' => $recentAudits > 0 ? 'Operational' : 'Backlog',
				'coverage' => sprintf('%s audits last 7d', number_format($recentAudits)),
			],
			[
				'name' => 'Skill Demand Signals',
				'state' => $recentSkills > 0 ? 'Live' : 'Refreshing',
				'coverage' => sprintf('%s skills updated in 14d', number_format($recentSkills)),
			],
		];
	}

	/**
	 * @return string[]
	 *
	 * @psalm-return list{string, string, string}
	 */
	private function buildNextFocus(): array
	{
		$staleSkills = SkillDemandData::query()->where('data_date', '<', now()->subDays(90))->count();
		$lowDiversityAudits = JobRecommendationAudit::query()->where('employer_diversity', '<', 0.4)->count();
		$warmupFailures = WarmupMetricEvent::query()->recent(14)->where('status', 'failed')->count();

		return [
			sprintf('Refresh demand insights for %s skills older than 90 days.', number_format($staleSkills)),
			sprintf('Raise diversity signals for %s recommendation audits below threshold.', number_format($lowDiversityAudits)),
			sprintf('Close the loop on %s warmup failures captured in the last two weeks.', number_format($warmupFailures)),
		];
	}
}


