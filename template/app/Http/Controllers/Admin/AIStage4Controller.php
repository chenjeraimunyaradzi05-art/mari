<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BillingCharge;
use App\Models\BillingMeter;
use App\Models\WarmupMetricEvent;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\View\View;

final class AIStage4Controller extends Controller
{
	public function index(): View
	{
		$autonomyPillars = $this->buildAutonomyPillars();
		$readinessChecklist = $this->buildReadinessChecklist();
		$pilotCandidates = $this->buildPilotCandidates();

		return view('admin.ai-stage4.index', compact('autonomyPillars', 'readinessChecklist', 'pilotCandidates'));
	}

	/**
	 * Use billing meter telemetry to summarise autonomy pillars.
	 *
	 * @psalm-return array<int, mixed>
	 */
	private function buildAutonomyPillars(): array
	{
		$rows = BillingMeter::query()
			->select([
				'event_type',
				DB::raw('COUNT(*) as total_events'),
				DB::raw('SUM(CASE WHEN eligible THEN 1 ELSE 0 END) as eligible_events'),
				DB::raw('MIN(occurred_at) as first_seen'),
				DB::raw('MAX(occurred_at) as last_seen'),
			])
			->whereNotNull('event_type')
			->where('occurred_at', '>=', now()->subDays(60))
			->groupBy('event_type')
			->orderByDesc('total_events')
			->take(3)
			->get();

		return $rows->map(function ($row) {
			$eligible = (int) ($row->eligible_events ?? 0);
			$total = max((int) ($row->total_events ?? 0), 1);
			$ratio = $eligible / $total;

			return [
				'name' => Str::headline($row->event_type ?? 'Pipeline'),
				'detail' => $this->formatAutonomyDetail($row, $ratio, $total),
				'owner' => $this->ownerForEventType($row->event_type),
				'status' => $this->statusForAutonomy($ratio),
			];
		})->toArray();
	}

	/**
	 * Create readiness checklist items from operations data.
	 *
	 * @return string[]
	 *
	 * @psalm-return list{string, string, string, 'Sanity-check fallbacks and observability before greenlighting autonomous rollouts.'}
	 */
	private function buildReadinessChecklist(): array
	{
		$pendingCharges = BillingCharge::query()->where('status', BillingCharge::STATUS_PENDING)->count();
		$readyCharges = BillingCharge::query()->where('status', BillingCharge::STATUS_READY)->count();
		$failedWarmups = WarmupMetricEvent::query()->recent(14)->where('status', 'failed')->count();
		$totalWarmups = WarmupMetricEvent::query()->recent(14)->count();
		$successRate = $totalWarmups > 0 ? ($totalWarmups - $failedWarmups) / $totalWarmups : 0;

		return [
			sprintf('%d pending AI usage charges awaiting validation.', $pendingCharges),
			sprintf('%d ready charges queued for invoicing.', $readyCharges),
			sprintf('%d warmup failures in the last 14 days; success rate %s%%.', $failedWarmups, number_format($successRate * 100, 1)),
			'Sanity-check fallbacks and observability before greenlighting autonomous rollouts.',
		];
	}

	/**
	 * Identify pilot companies with active AI billing.
	 *
	 * @psalm-return array<int, mixed>
	 */
	private function buildPilotCandidates(): array
	{
		$companies = BillingCharge::query()
			->select([
				'company_id',
				DB::raw('SUM(amount_cents) as total_amount'),
				DB::raw('MAX(billed_at) as latest_invoice'),
			])
			->whereNotNull('company_id')
			->groupBy('company_id')
			->orderByDesc('total_amount')
			->with(['company.companyCountry'])
			->take(5)
			->get();

		return $companies->map(function (BillingCharge $charge) {
			$company = $charge->company;
			$region = $company?->companyCountry?->name ?? '—';
			$latestInvoice = $charge->latest_invoice ? Carbon::parse($charge->latest_invoice)->format('M Y') : 'Pipeline';

			return [
				'name' => $company?->name ?? ('Company #' . $charge->company_id),
				'region' => $region,
				'timeline' => $latestInvoice,
			];
		})->toArray();
	}

	private function formatAutonomyDetail(BillingMeter $row, float $ratio, int $total): string
	{
		$eligiblePercent = number_format($ratio * 100, 1);
		$lastSeen = $row->last_seen ? Carbon::parse($row->last_seen)->diffForHumans() : 'no recent activity';

		return sprintf('%s%% eligible across %d events · last activity %s', $eligiblePercent, $total, $lastSeen);
	}

	private function statusForAutonomy(float $ratio): string
	{
		if ($ratio >= 0.9) {
			return 'Stable';
		}

		if ($ratio >= 0.75) {
			return 'Monitoring';
		}

		return 'Needs Attention';
	}

	private function ownerForEventType(?string $eventType): string
	{
		return match ($eventType) {
			BillingMeter::EVENT_APPLICATION_SUBMITTED => 'Revenue Ops',
			'ai_job_match_generated' => 'Matching Platform',
			'ai_screening_completed' => 'Talent Intelligence',
			default => 'Platform Governance',
		};
	}
}


