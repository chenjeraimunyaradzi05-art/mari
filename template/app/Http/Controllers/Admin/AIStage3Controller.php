<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CandidateMilestone;
use App\Models\SkillDemandData;
use App\Models\SkillGapAnalysis;
use Illuminate\Support\Str;
use Illuminate\View\View;

final class AIStage3Controller extends Controller
{
	public function index(): View
	{
		$personalisationTracks = $this->buildPersonalisationTracks();
		$guardrails = $this->buildGuardrails();
		$milestones = $this->buildMilestones();

		return view('admin.ai-stage3.index', compact('personalisationTracks', 'guardrails', 'milestones'));
	}

	/**
	 * Build data-backed personalisation tracks from demand signals.
	 */
	private function buildPersonalisationTracks(): array
	{
		$skills = SkillDemandData::query()
			->with('skill')
			->recent(60)
			->orderByDesc('growth_rate')
			->take(6)
			->get();

		if ($skills->isEmpty()) {
			$skills = SkillDemandData::query()
				->with('skill')
				->latest('data_date')
				->take(6)
				->get();
		}

		return $skills->map(function (SkillDemandData $record) {
			$demandLevel = $record->demand_level ? Str::title(str_replace('_', ' ', $record->demand_level)) : 'Unknown';
			$growth = number_format((float) ($record->growth_rate ?? 0), 1);
			$salary = $record->formatted_salary ?? 'N/A';
			$skillName = $record->skill?->name ?? 'Unnamed Skill';

			return [
				'title' => $skillName,
				'description' => sprintf('Demand %s · Growth %s%% · Avg salary %s', $demandLevel, $growth, $salary),
				'status' => $demandLevel,
				'confidence' => $this->confidenceFromGrowth($record->growth_rate),
			];
		})->toArray();
	}

	/**
	 * Surface responsible AI guardrails from recent analyses.
	 */
	private function buildGuardrails(): array
	{
		$analyses = SkillGapAnalysis::query()
			->recent(30)
			->orderByDesc('analysis_date')
			->take(5)
			->get();

		$guardrails = $analyses->flatMap(function (SkillGapAnalysis $analysis) {
			$insights = collect($analysis->market_insights ?? []);
			if ($insights->isEmpty()) {
				$insights = collect($analysis->ai_recommendations ?? []);
			}

			return $insights->take(2);
		})
			->filter()
			->map(fn($value) => is_string($value) ? Str::finish($value, '.') : (string) $value)
			->unique()
			->values()
			->toArray();

		if (empty($guardrails)) {
			return ['No recent guardrails logged. Keep monitoring weekly review notes.'];
		}

		return $guardrails;
	}

	/**
	 * Highlight the most recent milestones achieved.
	 */
	private function buildMilestones(): array
	{
		$milestones = CandidateMilestone::query()
			->with(['candidate', 'milestone'])
			->recentlyAchieved(45)
			->orderByDesc('achieved_at')
			->take(5)
			->get()
			->map(function (CandidateMilestone $entry) {
				$milestoneName = $entry->milestone?->name ?? 'Milestone';
				$candidateName = $entry->candidate?->full_name ?? 'Candidate';

				return [
					'label' => sprintf('%s · %s', $milestoneName, $candidateName),
					'target' => optional($entry->achieved_at)->format('d M Y') ?? '—',
				];
			})
			->toArray();

		if (!empty($milestones)) {
			return $milestones;
		}

		return SkillGapAnalysis::query()
			->orderByDesc('analysis_date')
			->take(3)
			->get()
			->flatMap(function (SkillGapAnalysis $analysis) {
				return collect($analysis->learning_paths ?? [])->take(1)->map(function ($path) {
					$title = data_get($path, 'title', 'Learning Path');
					$target = data_get($path, 'target_date');
					return [
						'label' => $title,
						'target' => $target ? (string) $target : 'Planned',
					];
				});
			})
			->values()
			->toArray();
	}

	/**
	 * Convert growth rate into a qualitative confidence score.
	 *
	 * @param numeric $growthRate
	 *
	 * @psalm-return 'Emerging'|'High'|'Medium'
	 */
	private function confidenceFromGrowth($growthRate): string
	{
		$rate = (float) ($growthRate ?? 0);

		if ($rate >= 8) {
			return 'High';
		}

		if ($rate >= 4) {
			return 'Medium';
		}

		return 'Emerging';
	}
}


