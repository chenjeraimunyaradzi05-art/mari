<?php

namespace App\Services;

use App\Models\Lead;
use Carbon\CarbonInterface;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

final class LeadQualificationService
{
	/**
	 * @return (array|int|string)[]
	 *
	 * @psalm-return array{score: int, grade: string, priority: string, factors: array, summary: string, recommendations: string}
	 */
	public function evaluate(Lead $lead): array
	{
		[$score, $factors] = $this->calculateScore($lead);
		$grade = $this->gradeFromScore($score);
		$priority = $this->priorityFromScore($score, $lead);

		$summary = $this->buildSummary($lead, $score, $grade, $priority);
		$recommendations = $this->buildRecommendations($lead, $score, $priority, $factors);

		$lead->fill([
			'qualification_score' => $score,
			'qualification_grade' => $grade,
			'qualification_priority' => $priority,
			'qualification_factors' => $factors,
			'ai_summary' => $summary,
			'ai_recommendations' => $recommendations,
		]);

		$lead->save();

		return [
			'score' => $score,
			'grade' => $grade,
			'priority' => $priority,
			'factors' => $factors,
			'summary' => $summary,
			'recommendations' => $recommendations,
		];
	}

	/**
	 * @return (array|int)[]
	 *
	 * @psalm-return list{int<0, 100>, array}
	 */
	private function calculateScore(Lead $lead): array
	{
		$score = 42;
		$factors = [];

		if ($lead->contact_email) {
			$score += 12;
			$factors[] = $this->factor('Verified email contact', 12, 'Lead supplied a valid email address for follow up.');
		} else {
			$score -= 8;
			$factors[] = $this->factor('Missing email', -8, 'No email was provided; response requires an alternate channel.');
		}

		if ($lead->contact_phone) {
			$score += 8;
			$factors[] = $this->factor('Phone number available', 8, 'Direct call channel supplied.');
		} else {
			$factors[] = $this->factor('No phone number', -4, 'Calling the lead will require scheduling by email.');
		}

		if (!empty($lead->contact_name)) {
			$score += 4;
			$factors[] = $this->factor('Named contact', 4, 'Lead introduced themselves with a name, suggesting higher intent.');
		}

		$typeWeight = match ($lead->type) {
			'job' => 12,
			'apprenticeship' => 10,
			'course' => 8,
			default => 6,
		};
		$score += $typeWeight;
		$factors[] = $this->factor(Str::title($lead->type).' interest', $typeWeight, 'Lead selected '.$lead->type.' from the form.');

		$message = trim((string) data_get($lead->payload, 'message'));
		$messageLength = strlen($message);

		if ($messageLength > 0) {
			if ($messageLength >= 300) {
				$score += 14;
				$factors[] = $this->factor('Detailed enquiry', 14, 'Long-form message indicates researched intent.');
			} elseif ($messageLength >= 120) {
				$score += 10;
				$factors[] = $this->factor('Structured enquiry', 10, 'Message contained specific context and questions.');
			} elseif ($messageLength >= 60) {
				$score += 6;
				$factors[] = $this->factor('Focused enquiry', 6, 'Message provided a concise reason for reaching out.');
			} else {
				$score += 3;
				$factors[] = $this->factor('Short enquiry', 3, 'Lead left a brief message.');
			}
		} else {
			$score -= 6;
			$factors[] = $this->factor('No message context', -6, 'Lead did not include additional context in the form.');
		}

		$keywordBoost = $this->keywordBoost($message, $factors);
		$score += $keywordBoost;

		$utm = $lead->utm ?? [];
		if (!empty(Arr::get($utm, 'utm_campaign'))) {
			$score += 8;
			$factors[] = $this->factor('Campaign attributed', 8, 'Lead arrived from campaign: '.Arr::get($utm, 'utm_campaign'));
		}
		if (!empty(Arr::get($utm, 'utm_medium'))) {
			$score += 4;
			$factors[] = $this->factor('Marketing medium tracked', 4, 'UTM medium tagged as '.Arr::get($utm, 'utm_medium'));
		}

		$landingUrl = (string) Arr::get($lead->payload ?? [], 'landing_url');
		if ($landingUrl) {
			$score += 3;
			$factors[] = $this->factor('Landing page captured', 3, 'Landing URL stored for context.');
		}

		$submittedAt = $this->resolveSubmittedAt($lead);
		if ($submittedAt) {
			$hoursAgo = $submittedAt->diffInHours(now());
			if ($hoursAgo <= 6) {
				$score += 12;
				$factors[] = $this->factor('Fresh lead (<6h)', 12, 'Lead submitted within the last six hours.');
			} elseif ($hoursAgo <= 24) {
				$score += 8;
				$factors[] = $this->factor('Recent lead (<24h)', 8, 'Lead submitted in the last day.');
			} elseif ($hoursAgo <= 72) {
				$score += 4;
				$factors[] = $this->factor('Warm lead (<72h)', 4, 'Lead arrived in the last three days.');
			} else {
				$factors[] = $this->factor('Older lead', -4, 'Lead is more than three days old.');
				$score -= 4;
			}
		}

		if ($lead->status === 'qualified' || $lead->status === 'contacted') {
			$score += 4;
			$factors[] = $this->factor('Pipeline progression', 4, 'Lead already moved forward in your workflow.');
		}

		$score = max(0, min(100, (int) round($score)));

		return [$score, $factors];
	}

	/**
	 * @psalm-return int<0, max>
	 */
	private function keywordBoost(string $message, array &$factors): int
	{
		if ($message === '') {
			return 0;
		}

		$lowerMessage = Str::lower($message);
		$boost = 0;

		$keywordMap = [
			'interview' => ['impact' => 6, 'reason' => 'Lead is ready to interview.'],
			'hire' => ['impact' => 5, 'reason' => 'Language suggests an active hiring plan.'],
			'timeline' => ['impact' => 4, 'reason' => 'Lead shared a go-live timeline.'],
			'budget' => ['impact' => 4, 'reason' => 'Budget discussion signals purchase intent.'],
			'urgent' => ['impact' => 5, 'reason' => 'Lead marked the request as urgent.'],
			'immediately' => ['impact' => 5, 'reason' => 'Lead is ready to start immediately.'],
			'pilot' => ['impact' => 3, 'reason' => 'Lead is interested in a pilot or trial.'],
		];

		foreach ($keywordMap as $keyword => $definition) {
			if (Str::contains($lowerMessage, $keyword)) {
				$boost += $definition['impact'];
				$factors[] = $this->factor('Intent keyword: '.$keyword, $definition['impact'], $definition['reason']);
			}
		}

		return $boost;
	}

	private function gradeFromScore(int $score): string
	{
		return match (true) {
			$score >= 90 => 'A',
			$score >= 80 => 'B',
			$score >= 65 => 'C',
			$score >= 50 => 'D',
			default => 'E',
		};
	}

	private function priorityFromScore(int $score, Lead $lead): string
	{
		$submittedAt = $this->resolveSubmittedAt($lead);
		$isFresh = $submittedAt ? $submittedAt->greaterThanOrEqualTo(now()->subHours(24)) : false;

		if ($score >= 88 && $isFresh) {
			return 'urgent';
		}

		if ($score >= 78) {
			return 'high';
		}

		if ($score >= 60) {
			return 'standard';
		}

		return 'low';
	}

	private function buildSummary(Lead $lead, int $score, string $grade, string $priority): string
	{
		$submittedAt = $this->resolveSubmittedAt($lead);
		$submittedDescriptor = $submittedAt ? $submittedAt->diffForHumans() : 'recently';
		$contact = $lead->contact_name ? $lead->contact_name : 'Anonymous prospect';
		$type = $lead->type ? Str::headline($lead->type) : 'General';
		$company = optional($lead->page)->name;

		$parts = [];
		$parts[] = sprintf('%s from %s submitted a %s lead %s.', $contact, $company ?? 'your page', $type, $submittedDescriptor);
		$parts[] = sprintf('Current qualification score is %d (%s grade) and the priority is %s.', $score, $grade, Str::headline($priority));

		if ($lead->contact_email) {
			$parts[] = 'Email is available for follow up.';
		}
		if ($lead->contact_phone) {
			$parts[] = 'A phone number was provided for faster outreach.';
		}
		if ($message = trim((string) data_get($lead->payload, 'message'))) {
			$parts[] = 'Lead message summary: '.Str::limit($message, 180);
		}

		return implode(' ', array_filter($parts));
	}

	private function buildRecommendations(Lead $lead, int $score, string $priority, array $factors): string
	{
		$lines = [];

		switch ($priority) {
			case 'urgent':
				$lines[] = 'Call the lead within the next two hours and follow up with a recap email.';
				break;
			case 'high':
				$lines[] = 'Schedule a discovery call within one business day to maintain momentum.';
				break;
			case 'standard':
				$lines[] = 'Send a personalised email response and prepare relevant collateral.';
				break;
			default:
				$lines[] = 'Add the lead to a nurture sequence and monitor for future engagement signals.';
		}

		if ($score < 60) {
			$lines[] = 'Review the message for qualification gaps and consider asking clarifying questions.';
		}

		if (!$lead->contact_phone) {
			$lines[] = 'Request a direct phone number during your next conversation to speed up the cycle.';
		}

		if ($this->containsNegativeImpact($factors)) {
			$lines[] = 'Address blockers highlighted in the qualification insights before handing off to delivery teams.';
		}

		return implode("\n", array_unique(array_filter($lines)));
	}

	private function containsNegativeImpact(array $factors): bool
	{
		foreach ($factors as $factor) {
			if (($factor['impact'] ?? 0) < 0) {
				return true;
			}
		}

		return false;
	}

	private function resolveSubmittedAt(Lead $lead): \Illuminate\Support\Carbon|null
	{
		if ($lead->submitted_at instanceof CarbonInterface) {
			return $lead->submitted_at;
		}

		return $lead->created_at instanceof CarbonInterface ? $lead->created_at : null;
	}

	/**
	 * @return (int|string)[]
	 *
	 * @psalm-return array{label: string, impact: int, reason: string}
	 */
	private function factor(string $label, int $impact, string $reason): array
	{
		return [
			'label' => $label,
			'impact' => $impact,
			'reason' => $reason,
		];
	}
}

