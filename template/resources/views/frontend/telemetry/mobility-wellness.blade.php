@extends('frontend.layouts.master')

@section('page_title', 'Mobility & Wellness Telemetry')

@section('content')
    <section class="section-box-2 mt-80">
        <div class="container">
            <style>
                .telemetry-card {
                    border-radius: 28px;
                    border: 1px solid #e5e7eb;
                    background: #fff;
                }
                .telemetry-metric {
                    border-radius: 16px;
                    background: #f8fafc;
                    padding: 1rem;
                }
                .telemetry-timeline {
                    border-radius: 18px;
                    border: 1px solid #e5e7eb;
                    background: #fdfdfd;
                    padding: 1rem;
                }
                .telemetry-timeline__point {
                    border-radius: 12px;
                    background: #eef2ff;
                    padding: 0.75rem 1rem;
                    min-width: 110px;
                }
                .telemetry-table th {
                    font-size: 0.85rem;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                }
            </style>

            @php
                $formatNumber = fn ($value, $decimals = 0) => $value === null ? '—' : number_format($value, $decimals);
                $formatPercent = fn ($value) => $value === null ? '—' : number_format($value, 1) . '%';
                $rangeFrom = $range['from']->format('M j, Y');
                $rangeTo = $range['to']->format('M j, Y');
                $timelineSlice = fn ($summary) => collect($summary['timeline'] ?? [])->take(-10);
            @endphp

            <div class="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
                <div>
                    <p class="text-uppercase text-muted mb-1" style="letter-spacing: 0.2em;">Athena telemetry</p>
                    <h1 class="h3 mb-1">Mobility &amp; Wellness Adoption Signals</h1>
                    <p class="text-muted mb-0">Window: {{ $rangeFrom }} – {{ $rangeTo }} (last {{ $days }} days)</p>
                </div>
                <form method="get" class="d-flex align-items-center gap-2">
                    <label class="text-muted small mb-0" for="telemetry-days">Window</label>
                    <select id="telemetry-days" name="days" class="form-select" style="min-width: 120px;" onchange="this.form.submit()">
                        @foreach ([7, 14, 30, 90] as $option)
                            <option value="{{ $option }}" {{ $option === $days ? 'selected' : '' }}>{{ $option }} days</option>
                        @endforeach
                    </select>
                </form>
            </div>

            <div class="row g-4">
                <div class="col-lg-6">
                    <div class="telemetry-card shadow-sm p-4 h-100">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <div>
                                <p class="text-uppercase text-muted mb-1" style="letter-spacing: 0.2em;">Home hub</p>
                                <h2 class="h4 mb-0">Mobility Suite renders</h2>
                                <p class="text-muted small mb-0">Last seen {{ optional($mobilitySummary['last_seen'])->diffForHumans() ?? '—' }}</p>
                            </div>
                            <div class="text-end">
                                <p class="display-6 fw-bold mb-0">{{ $formatNumber($mobilitySummary['total']) }}</p>
                                <p class="text-muted small mb-0">Total renders</p>
                            </div>
                        </div>
                        <div class="row g-3">
                            <div class="col-6">
                                <div class="telemetry-metric">
                                    <p class="text-muted small mb-1">Unique members</p>
                                    <p class="h5 mb-0">{{ $formatNumber($mobilitySummary['unique_users']) }}</p>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="telemetry-metric">
                                    <p class="text-muted small mb-1">Signed-in rate</p>
                                    <p class="h5 mb-0">{{ $formatPercent($mobilitySummary['auth_rate']) }}</p>
                                </div>
                            </div>
                            @foreach ($mobilitySummary['averages'] as $average)
                                <div class="col-6">
                                    <div class="telemetry-metric">
                                        <p class="text-muted small mb-1">{{ $average['label'] }}</p>
                                        <p class="h5 mb-0">{{ $formatNumber($average['value'], 2) }}</p>
                                    </div>
                                </div>
                            @endforeach
                        </div>
                        <div class="mt-4">
                            <p class="text-uppercase text-muted small mb-2" style="letter-spacing: 0.2em;">Daily signals</p>
                            <div class="telemetry-timeline d-flex flex-wrap gap-2">
                                @forelse ($timelineSlice($mobilitySummary) as $point)
                                    <div class="telemetry-timeline__point">
                                        <p class="fw-semibold mb-0">{{ $point['total'] }}</p>
                                        <p class="text-muted small mb-0">{{ $point['date'] }}</p>
                                    </div>
                                @empty
                                    <p class="text-muted mb-0">No renders in this window.</p>
                                @endforelse
                            </div>
                        </div>
                        @if (!empty($mobilitySummary['latest_properties']['metrics']))
                            <div class="mt-4">
                                <p class="text-uppercase text-muted small mb-2" style="letter-spacing: 0.2em;">Latest metric snapshot</p>
                                <div class="row g-3">
                                    @foreach ($mobilitySummary['latest_properties']['metrics'] as $label => $value)
                                        <div class="col-6">
                                            <div class="telemetry-metric">
                                                <p class="text-muted small mb-1">{{ $label }}</p>
                                                <p class="h5 mb-0">{{ $value }}</p>
                                            </div>
                                        </div>
                                    @endforeach
                                </div>
                            </div>
                        @endif
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="telemetry-card shadow-sm p-4 h-100">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <div>
                                <p class="text-uppercase text-muted mb-1" style="letter-spacing: 0.2em;">Wellness hub</p>
                                <h2 class="h4 mb-0">Finance + AI section loads</h2>
                                <p class="text-muted small mb-0">Last seen {{ optional($wellnessSummary['last_seen'])->diffForHumans() ?? '—' }}</p>
                            </div>
                            <div class="text-end">
                                <p class="display-6 fw-bold mb-0">{{ $formatNumber($wellnessSummary['total']) }}</p>
                                <p class="text-muted small mb-0">Total loads</p>
                            </div>
                        </div>
                        <div class="row g-3">
                            <div class="col-6">
                                <div class="telemetry-metric">
                                    <p class="text-muted small mb-1">Unique members</p>
                                    <p class="h5 mb-0">{{ $formatNumber($wellnessSummary['unique_users']) }}</p>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="telemetry-metric">
                                    <p class="text-muted small mb-1">Signed-in rate</p>
                                    <p class="h5 mb-0">{{ $formatPercent($wellnessSummary['auth_rate']) }}</p>
                                </div>
                            </div>
                            @foreach ($wellnessSummary['averages'] as $average)
                                <div class="col-6">
                                    <div class="telemetry-metric">
                                        <p class="text-muted small mb-1">{{ $average['label'] }}</p>
                                        <p class="h5 mb-0">{{ $formatNumber($average['value'], 2) }}</p>
                                    </div>
                                </div>
                            @endforeach
                        </div>
                        <div class="mt-4">
                            <p class="text-uppercase text-muted small mb-2" style="letter-spacing: 0.2em;">Daily signals</p>
                            <div class="telemetry-timeline d-flex flex-wrap gap-2">
                                @forelse ($timelineSlice($wellnessSummary) as $point)
                                    <div class="telemetry-timeline__point">
                                        <p class="fw-semibold mb-0">{{ $point['total'] }}</p>
                                        <p class="text-muted small mb-0">{{ $point['date'] }}</p>
                                    </div>
                                @empty
                                    <p class="text-muted mb-0">No activity in this window.</p>
                                @endforelse
                            </div>
                        </div>
                        @if (!empty($wellnessSummary['latest_properties']['signal_labels']))
                            <div class="mt-4">
                                <p class="text-uppercase text-muted small mb-2" style="letter-spacing: 0.2em;">Signals tracked</p>
                                <div class="d-flex flex-wrap gap-2">
                                    @foreach ($wellnessSummary['latest_properties']['signal_labels'] as $label)
                                        <span class="badge bg-light text-dark">{{ $label }}</span>
                                    @endforeach
                                </div>
                            </div>
                        @endif
                    </div>
                </div>
            </div>

            <div class="telemetry-card shadow-sm p-4 mt-4">
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <div>
                        <p class="text-uppercase text-muted mb-1" style="letter-spacing: 0.2em;">AI concierge</p>
                        <h2 class="h4 mb-0">Context usage across mobility &amp; wellness</h2>
                        <p class="text-muted small mb-0">Focuses on concierge contexts powering these hubs.</p>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="table telemetry-table align-middle">
                        <thead>
                            <tr>
                                <th scope="col">Context</th>
                                <th scope="col">Questions</th>
                                <th scope="col">Unique members</th>
                                <th scope="col">Avg prompt length</th>
                                <th scope="col">History reuse</th>
                                <th scope="col">Last seen</th>
                            </tr>
                        </thead>
                        <tbody>
                            @forelse ($aiContexts as $context)
                                <tr>
                                    <td>
                                        <strong>{{ \Illuminate\Support\Str::headline($context['context']) }}</strong>
                                        <div class="text-muted small">{{ $context['context'] }}</div>
                                    </td>
                                    <td>{{ $formatNumber($context['total']) }}</td>
                                    <td>{{ $formatNumber($context['unique_users']) }}</td>
                                    <td>{{ $formatNumber($context['avg_prompt_length'], 1) }} chars</td>
                                    <td>{{ $formatPercent($context['history_rate']) }}</td>
                                    <td>{{ optional($context['last_seen'])->diffForHumans() ?? '—' }}</td>
                                </tr>
                            @empty
                                <tr>
                                    <td colspan="6" class="text-muted">No concierge questions logged for these contexts yet.</td>
                                </tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </section>
@endsection
