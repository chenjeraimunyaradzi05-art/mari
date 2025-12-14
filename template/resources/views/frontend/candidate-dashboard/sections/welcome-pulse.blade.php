@php
    $pulseData = is_array($pulse) ? $pulse : (array) ($pulse ?? []);
    $trajectoryScore = \Illuminate\Support\Arr::get($pulseData, 'trajectory_score');
    $targetRole = \Illuminate\Support\Arr::get($pulseData, 'target_role');
    $summary = \Illuminate\Support\Arr::get($pulseData, 'summary');
    $metrics = collect(\Illuminate\Support\Arr::get($pulseData, 'metrics', []));
    $historyItems = collect($history ?? [])->take(6);
    $scorePercent = null;

    if (is_numeric($trajectoryScore)) {
        $numericScore = (float) $trajectoryScore;
        $scorePercent = $numericScore <= 1 ? round($numericScore * 100) : round($numericScore);
    }

    $payoutAmount = $latestPayout?->payout_amount;
    $payoutCurrency = $latestPayout?->currency;
    $payoutLabel = $payoutAmount === null ? '—' : number_format($payoutAmount, 2);
    $payoutPeriod = $latestPayout?->period_end?->format('M j, Y');
@endphp

<div class="dashboard-card mb-40 pulse-card">
    <div class="dashboard-card-header">
        <p class="dashboard-card-title mb-1">Career Intelligence Pulse</p>
        <span class="dashboard-card-subtitle">A quick read on your current trajectory and impact signals.</span>
    </div>
    <div class="dashboard-card-body">
        <div class="row g-4 align-items-start">
            <div class="col-lg-5">
                <div class="pulse-score-card">
                    <span class="pulse-score-label">Trajectory Score</span>
                    <span class="pulse-score-value">{{ $scorePercent !== null ? $scorePercent.'%' : '—' }}</span>
                    <span class="pulse-score-caption">{{ $targetRole ? 'Tracking toward '.$targetRole : 'Set a target role to personalise your forecast.' }}</span>
                </div>
                <p class="pulse-summary mt-3 mb-0">{{ $summary ?? 'We will surface a personalised summary once your first pulse arrives.' }}</p>

                <div class="pulse-payout-box mt-4">
                    <span class="pulse-payout-label">Latest creator payout</span>
                    <div class="pulse-payout-value">
                        {{ $payoutLabel }}
                        @if ($payoutCurrency)
                            <span class="text-muted">{{ $payoutCurrency }}</span>
                        @endif
                    </div>
                    <span class="pulse-payout-caption">{{ $payoutPeriod ? 'Period ending '.$payoutPeriod : 'Payout summary updates once monetisation begins.' }}</span>
                </div>
            </div>
            <div class="col-lg-7">
                <div class="pulse-metrics-grid">
                    @foreach ($metrics as $key => $value)
                        <div class="pulse-metric-card">
                            <span class="pulse-metric-label">{{ \Illuminate\Support\Str::headline((string) $key) }}</span>
                            <span class="pulse-metric-value">{{ $value !== null ? number_format((float) $value) : '—' }}</span>
                        </div>
                    @endforeach
                </div>

                @if ($historyItems->isNotEmpty())
                    <div class="pulse-history mt-4">
                        <span class="pulse-history-title">Recent snapshots</span>
                        <ul class="pulse-history-list">
                            @foreach ($historyItems as $item)
                                @php
                                    $historyScore = $item->trajectory_score;
                                    $historyPercent = $historyScore === null ? null : ($historyScore <= 1 ? round($historyScore * 100) : round($historyScore));
                                @endphp
                                <li class="pulse-history-item">
                                    <span class="pulse-history-date">{{ optional($item->captured_at)->format('M j') ?? '—' }}</span>
                                    <span class="pulse-history-score">{{ $historyPercent !== null ? $historyPercent.'%' : '—' }}</span>
                                </li>
                            @endforeach
                        </ul>
                    </div>
                @endif
            </div>
        </div>
    </div>
</div>
