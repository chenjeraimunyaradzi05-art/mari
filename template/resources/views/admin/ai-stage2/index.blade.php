@extends('admin.layouts.master')

@section('contents')
	@include('admin.ai-shared.styles')

	@php
		$primaryMetric = $stabilityMetrics[0] ?? null;
		$metricPalettes = ['ai-theme-pink', 'ai-theme-teal', 'ai-theme-amber'];
		$metricIcons = [
			'Successful AI calls (24h)' => 'fa-signal',
			'Average response time (ms)' => 'fa-stopwatch',
			'Fallback rate' => 'fa-life-ring',
		];
	@endphp

	<section class="section">
		<div class="section-header">
			<h1>AI Stage 2 · Stabilisation & Signals</h1>
			<div class="section-header-breadcrumb">
				<div class="breadcrumb-item"><a href="{{ route('admin.dashboard') }}">Dashboard</a></div>
				<div class="breadcrumb-item active">AI Stage 2</div>
			</div>
		</div>

		<div class="section-body">
			<div class="ai-hero-card ai-theme-pink mb-4">
				<div class="pe-lg-5">
					<span class="ai-hero-badge"><i class="fas fa-layer-group"></i> Stage 2</span>
					<h2 class="mt-3 mb-2">Stabilisation &amp; Signal Integrity</h2>
					<p class="mb-0 text-white-75" style="max-width: 460px;">Tighten resiliency before we scale personalisation. Live telemetry keeps warmup pipelines healthy and surfaces regression signals early.</p>
					@if ($primaryMetric)
						<div class="ai-hero-stat text-white mt-4">
							<span>{{ data_get($primaryMetric, 'value', '—') }}</span>
							<small>{{ data_get($primaryMetric, 'label', 'Primary metric') }}</small>
						</div>
					@endif
				</div>
				<div class="d-flex align-items-center">
					<div class="ai-hero-icon text-white"><i class="fas fa-wave-square"></i></div>
				</div>
				<span class="ai-orbit"></span>
			</div>

			<div class="row g-3 mb-4">
				@forelse ($stabilityMetrics as $index => $metric)
					<div class="col-xl-4 col-md-6">
						<div class="ai-metric-card {{ $metricPalettes[$index % count($metricPalettes)] }}">
							<div class="d-flex justify-content-between align-items-start">
								<div>
									<span class="ai-chip ai-chip-light text-uppercase">{{ data_get($metric, 'label', 'Metric') }}</span>
									<h2 class="mt-3 mb-2">{{ data_get($metric, 'value', '—') }}</h2>
									<span class="ai-metric-trend text-white-75"><i class="fas fa-chart-line"></i> {{ data_get($metric, 'trend', 'Trend unavailable') }}</span>
								</div>
								<div class="ai-metric-icon text-white">
									<i class="fas {{ $metricIcons[data_get($metric, 'label')] ?? 'fa-chart-bar' }}"></i>
								</div>
							</div>
						</div>
					</div>
				@empty
					<div class="col-12">
						<div class="alert alert-light border shadow-sm mb-0">No telemetry captured yet. Check warmup metric ingestion.</div>
					</div>
				@endforelse
			</div>

			<div class="card ai-card-soft mb-4">
				<div class="card-header d-flex flex-wrap justify-content-between align-items-center bg-transparent border-0 pb-0">
					<h4 class="mb-0"><i class="fas fa-project-diagram text-primary mr-2"></i>Key Initiatives</h4>
					<span class="ai-chip"><i class="fas fa-clock"></i> Stage 2 Focus Window</span>
				</div>
				<div class="card-body pt-3">
					<div class="table-responsive">
						<table class="table table-hover ai-table mb-0">
							<thead>
								<tr>
									<th>Initiative</th>
									<th>Summary</th>
									<th>Status</th>
									<th>Owner</th>
									<th>ETA</th>
								</tr>
							</thead>
							<tbody>
								@forelse ($initiatives as $initiative)
									<tr>
										<td class="font-weight-semibold align-middle">
											<div class="d-flex align-items-center">
												<span class="ai-list-icon"><i class="fas fa-bolt"></i></span>
												<span>{{ data_get($initiative, 'name', '—') }}</span>
											</div>
										</td>
										<td class="align-middle">{{ data_get($initiative, 'summary', 'No summary available') }}</td>
										<td class="align-middle"><span class="ai-status-badge"><i class="fas fa-circle"></i> {{ data_get($initiative, 'status', 'Pending') }}</span></td>
										<td class="align-middle">{{ data_get($initiative, 'owner', 'Unassigned') }}</td>
										<td class="align-middle">{{ data_get($initiative, 'eta', 'TBA') }}</td>
									</tr>
								@empty
									<tr>
										<td colspan="5" class="text-center text-muted">No initiatives recorded this fortnight.</td>
									</tr>
								@endforelse
							</tbody>
						</table>
					</div>
				</div>
			</div>

			<div class="row g-3">
				<div class="col-lg-6">
					<div class="card ai-card-soft h-100">
						<div class="card-header bg-transparent border-0 pb-0">
							<h4 class="mb-0"><i class="fas fa-forward text-success mr-2"></i>Next Actions</h4>
						</div>
						<div class="card-body">
							<ol class="pl-3 mb-0">
								@forelse ($nextActions as $action)
									<li class="mb-3 d-flex align-items-start">
										<span class="ai-list-icon mt-0"><i class="fas fa-play"></i></span>
										<span>{{ $action }}</span>
									</li>
								@empty
									<li class="text-muted">No queued actions. Continue monitoring pipelines.</li>
								@endforelse
							</ol>
						</div>
					</div>
				</div>
				<div class="col-lg-6">
					<div class="card ai-card-soft h-100">
						<div class="card-header bg-transparent border-0 pb-0">
							<h4 class="mb-0"><i class="fas fa-shield-alt text-warning mr-2"></i>What This Unlocks</h4>
						</div>
						<div class="card-body">
							<ul class="list-unstyled mb-0">
								<li class="media mb-3">
									<span class="ai-list-icon"><i class="fas fa-check"></i></span>
									<div class="media-body">Reliable AI services ready for scaled rollout to Stage 3 experiences.</div>
								</li>
								<li class="media mb-3">
									<span class="ai-list-icon"><i class="fas fa-shield-virus"></i></span>
									<div class="media-body">Granular fraud telemetry to protect marketplace trust.</div>
								</li>
								<li class="media">
									<span class="ai-list-icon"><i class="fas fa-database"></i></span>
									<div class="media-body">Verified data backbone for personalised AI interactions.</div>
								</li>
							</ul>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>
@endsection
