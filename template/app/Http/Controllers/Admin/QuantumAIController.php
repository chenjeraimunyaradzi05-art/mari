<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Group;
use App\Models\SkillDemandData;
use App\Models\SkillGapAnalysis;
use Illuminate\Support\Str;
use Illuminate\View\View;

final class QuantumAIController extends Controller
{
	public function index(): View
	{
		$experiments = $this->buildExperiments();
		$researchNotes = $this->buildResearchNotes();
		$collaborationChannels = $this->buildCollaborationChannels();

		return view('admin.quantum-ai.index', compact('experiments', 'researchNotes', 'collaborationChannels'));
	}

	private function buildExperiments(): array
	{
		$records = SkillDemandData::query()
			->with('skill')
			->recent(90)
			->orderByDesc('growth_rate')
			->take(5)
			->get();

		if ($records->isEmpty()) {
			$records = SkillDemandData::query()->with('skill')->latest('data_date')->take(5)->get();
		}

		return $records->map(function (SkillDemandData $record) {
			$growth = (float) ($record->growth_rate ?? 0);
			$stage = $this->stageFromGrowth($growth);
			$topIndustries = collect($record->top_industries ?? [])->take(2)->implode(', ');
			$focus = sprintf(
				'Demand %s · Growth %s%%%s',
				Str::title(str_replace('_', ' ', $record->demand_level ?? 'unknown')),
				number_format($growth, 1),
				$topIndustries ? ' · Key industries: ' . $topIndustries : ''
			);

			return [
				'name' => $record->skill?->name ?? 'Emerging Capability',
				'focus' => $focus,
				'stage' => $stage,
			];
		})->toArray();
	}

	private function buildResearchNotes(): array
	{
		$notes = SkillGapAnalysis::query()
			->recent(60)
			->orderByDesc('analysis_date')
			->get()
			->flatMap(function (SkillGapAnalysis $analysis) {
				return collect($analysis->ai_recommendations ?? [])
					->merge($analysis->market_insights ?? [])
					->take(3);
			})
			->filter()
			->map(fn($value) => is_string($value) ? Str::finish($value, '.') : (string) $value)
			->unique()
			->take(6)
			->values()
			->toArray();

		if (empty($notes)) {
			return ['No research digests captured yet—run analyses to unlock insights.'];
		}

		return $notes;
	}

	/**
	 * @psalm-return array<int, mixed>
	 */
	private function buildCollaborationChannels(): array
	{
		$groups = Group::query()
			->withCount('members')
			->orderByDesc('created_at')
			->take(5)
			->get();

		return $groups->map(function (Group $group) {
			$audience = sprintf('%s · %d members', Str::title($group->visibility ?? 'Public'), $group->members_count ?? 0);
			$nextSession = optional($group->created_at)->addWeeks(4);

			return [
				'name' => $group->name,
				'audience' => $audience,
				'next_session' => $nextSession ? $nextSession->format('d M Y') : 'TBA',
			];
		})->toArray();
	}

	private function stageFromGrowth(float $growth): string
	{
		if ($growth >= 10) {
			return 'Scaling';
		}

		if ($growth >= 5) {
			return 'Validation';
		}

		if ($growth > 0) {
			return 'Lab Validation';
		}

		return 'Discovery';
	}
}


