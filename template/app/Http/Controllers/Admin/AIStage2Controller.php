<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\WarmupMetricEvent;
use App\Models\WarmupMetricSnapshot;
use Carbon\Carbon;
use Illuminate\Support\Str;
use Illuminate\View\View;

final class AIStage2Controller extends Controller
{
	public function index(): View
	{
		$latestSnapshot = WarmupMetricSnapshot::latestSnapshot()->first();
		$previousSnapshot = null;

		if ($latestSnapshot) {
			$previousSnapshot = WarmupMetricSnapshot::latestSnapshot()
				->where('snapshot_date', '<', $latestSnapshot->snapshot_date)
				->first();
		}

		$stabilityMetrics = $this->buildStabilityMetrics($latestSnapshot, $previousSnapshot);
		$initiatives = $this->buildInitiatives();
		$nextActions = $this->buildNextActions();

		return view('admin.ai-stage2.index', compact('initiatives', 'stabilityMetrics', 'nextActions'));
	}

	/**
	 * Gather stability metrics from warmup snapshots.
	 *
	 * @return string[][]
	 *
	 * @psalm-return list{array{label: 'Successful AI calls (24h)', value: string, trend: string}, array{label: 'Average response time (ms)', value: string, trend: string}, array{label: 'Fallback rate', value: string, trend: string}}
	 */
	private function buildStabilityMetrics(?WarmupMetricSnapshot $latest, ?WarmupMetricSnapshot $previous): array
	{
		$successTrend = $this->formatTrend(
			optional($latest)->success_count,
			optional($previous)->success_count,
			'vs prior day'
		);

		$avgDurationTrend = $this->formatTrend(
			optional($latest)->avg_duration_ms,
			optional($previous)->avg_duration_ms,
			'vs prior day'
		);

		$currentFallback = $this->calculateFallbackRate($latest);
		$previousFallback = $this->calculateFallbackRate($previous);
		$fallbackTrend = $this->formatTrend(
			$currentFallback,
			$previousFallback,
			'pts vs prior day',
			type: 'percentage_points'
		);

		return [
			[
				'label' => 'Successful AI calls (24h)',
				'value' => number_format(optional($latest)->success_count ?? 0),
				'trend' => $successTrend,
			],
			[
				'label' => 'Average response time (ms)',
				'value' => number_format(optional($latest)->avg_duration_ms ?? 0) . ' ms',
				'trend' => $avgDurationTrend,
			],
			[
				'label' => 'Fallback rate',
				'value' => number_format(($currentFallback ?? 0) * 100, 2) . '%',
				'trend' => $fallbackTrend,
			],
		];
	}

	/**
	 * Build initiative feed from recent warmup events.
	 *
	 * @psalm-return array<int, mixed>
	 */
	private function buildInitiatives(): array
	{
		$events = WarmupMetricEvent::query()
			->where('created_at', '>=', now()->subDays(14))
			->orderByRaw("CASE WHEN status = 'failed' THEN 0 ELSE 1 END")
			->orderByDesc('created_at')
			->with(['job.company', 'member.user'])
			->take(6)
			->get();

		if ($events->isEmpty()) {
			return [];
		}

		return $events->map(function (WarmupMetricEvent $event) {
			$context = $event->context ?? [];
			$name = data_get($context, 'initiative') ?: Str::headline($event->action ?? 'AI task');

			return [
				'name' => $name,
				'summary' => $this->summariseEvent($event),
				'status' => Str::title($event->status ?? 'pending'),
				'owner' => $this->ownerForEvent($event),
				'eta' => $this->readableEta($event),
			];
		})->toArray();
	}

	/**
	 * Derive next best actions from fail/success mix.
	 *
	 * @psalm-return array<int, mixed>
	 */
	private function buildNextActions(): array
	{
		$actions = WarmupMetricEvent::query()
			->selectRaw('action, COUNT(*) as total_events, SUM(CASE WHEN status = "failed" THEN 1 ELSE 0 END) as failures, MAX(error_message) as latest_error')
			->where('created_at', '>=', now()->subDays(7))
			->groupBy('action')
			->orderByDesc('failures')
			->orderByDesc('total_events')
			->take(4)
			->get()
			->map(function ($row) {
				$actionName = Str::headline($row->action ?: 'core pipeline');
				$failures = (int) ($row->failures ?? 0);
				if ($failures > 0) {
					$errorSnippet = $row->latest_error ? ' (latest: ' . Str::limit($row->latest_error, 60) . ')' : '';
					return sprintf(
						'Mitigate %d %s failures recorded this week%s.',
						$failures,
						$actionName,
						$errorSnippet
					);
				}

				return sprintf(
					'Sustain throughput for %s (%d runs captured this week).',
					$actionName,
					(int) ($row->total_events ?? 0)
				);
			})
			->toArray();

		if (empty($actions)) {
			return ['No warmup pipeline activity captured in the last 7 days. Confirm telemetry ingestion.'];
		}

		return $actions;
	}

	/**
	 * Render a concise summary for an event.
	 */
	private function summariseEvent(WarmupMetricEvent $event): string
	{
		if ($event->error_message) {
			return Str::limit($event->error_message, 140);
		}

		$contextSummary = data_get($event->context, 'summary');
		if ($contextSummary) {
			return Str::limit($contextSummary, 140);
		}

		$duration = $event->duration_ms ? number_format($event->duration_ms) . ' ms' : 'n/a';
		$attempts = $event->attempts ?? 1;

		return sprintf('Completed in %s across %d attempt(s).', $duration, $attempts);
	}

	/**
	 * Determine owner name for an event.
	 */
	private function ownerForEvent(WarmupMetricEvent $event): string
	{
		$owner = data_get($event->context, 'owner')
			?: optional($event->job?->company)->name
			?: optional($event->candidate)->full_name
			?: optional($event->candidate?->user)->name;

		return $owner ?: 'Unassigned';
	}

	/**
	 * Resolve a readable ETA for the event.
	 */
	private function readableEta(WarmupMetricEvent $event): string
	{
		$etaFromContext = data_get($event->context, 'eta');
		if ($etaFromContext) {
			try {
				return Carbon::parse($etaFromContext)->format('d M Y');
			} catch (\Throwable $e) {
				return (string) $etaFromContext;
			}
		}

		if ($event->finished_at) {
			return $event->finished_at->format('d M Y H:i');
		}

		if ($event->started_at) {
			return 'Started ' . $event->started_at->diffForHumans();
		}

		return 'In progress';
	}

	/**
	 * Helper to compute fallback rate.
	 */
	private function calculateFallbackRate(?WarmupMetricSnapshot $snapshot): ?float
	{
		if (!$snapshot) {
			return null;
		}

		$total = ($snapshot->success_count ?? 0) + ($snapshot->failure_count ?? 0);
		if ($total === 0) {
			return 0.0;
		}

		return ($snapshot->failure_count ?? 0) / $total;
	}

	/**
	 * Format a comparison string for metrics.
	 */
	private function formatTrend(?float $current, ?float $previous, string $suffix = '', string $type = 'percentage_change'): string
	{
		if ($current === null || $previous === null) {
			return 'Trend unavailable';
		}

		if ($previous == 0.0) {
			return $current == 0.0 ? 'No change' : 'New baseline';
		}

		$change = $current - $previous;

		if ($type === 'percentage_points') {
			if (abs($change) < 0.0005) {
				return 'Flat vs prior';
			}
			$sign = $change > 0 ? '+' : '−';
			$value = number_format(abs($change) * 100, 2);
			$suffix = trim($suffix);
			$suffix = $suffix ? ' ' . $suffix : ' pts';
			return sprintf('%s%s%s', $sign, $value, $suffix);
		}

		$percentChange = ($change / $previous) * 100;
		if (abs($percentChange) < 0.05) {
			return 'Flat vs prior';
		}
		$sign = $percentChange > 0 ? '+' : '−';
		$formatted = number_format(abs($percentChange), 1);
		$suffix = trim($suffix);
		$suffix = $suffix ? ' ' . $suffix : '';

		return sprintf('%s%s%%%s', $sign, $formatted, $suffix);
	}
}


