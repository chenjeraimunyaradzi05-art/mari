@extends('admin.layouts.master')

@section('contents')
	<section class="section">
		<div class="section-header">
			<h1>AI Stage 4 · Autonomous Platform</h1>
			<div class="section-header-breadcrumb">
				<div class="breadcrumb-item"><a href="{{ route('admin.dashboard') }}">Dashboard</a></div>
				<div class="breadcrumb-item"><a href="{{ route('admin.ai-stage3.index') }}">Stage 3</a></div>
				<div class="breadcrumb-item active">Stage 4</div>
			</div>
		</div>

		<div class="section-body">
			<div class="row mb-4">
				@forelse ($autonomyPillars as $pillar)
					<div class="col-lg-4 col-md-6 mb-3">
						<div class="card h-100 shadow-sm border-0">
							<div class="card-body">
								<h4 class="card-title" style="color: #10B981;">{{ data_get($pillar, 'name', 'Capability') }}</h4>
								<p class="text-muted">{{ data_get($pillar, 'detail', 'No telemetry captured.') }}</p>
							</div>
							<div class="card-footer bg-white d-flex justify-content-between align-items-center">
								<span class="badge badge-info">{{ data_get($pillar, 'status', 'Pending') }}</span>
								<small class="text-muted">Owner: {{ data_get($pillar, 'owner', 'Unassigned') }}</small>
							</div>
						</div>
					</div>
				@empty
					<div class="col-12">
						<div class="alert alert-light border shadow-sm">No autonomy data in the last 60 days.</div>
					</div>
				@endforelse
			</div>

			<div class="row">
				<div class="col-lg-6 mb-4">
					<div class="card shadow-sm border-0 h-100">
						<div class="card-header">
							<h4 class="mb-0"><i class="fas fa-clipboard-check text-primary mr-2"></i>Readiness Checklist</h4>
						</div>
						<div class="card-body">
							<ul class="list-group list-group-flush">
								@forelse ($readinessChecklist as $item)
									<li class="list-group-item">{{ $item }}</li>
								@empty
									<li class="list-group-item text-muted">No readiness notes available.</li>
								@endforelse
							</ul>
						</div>
					</div>
				</div>
				<div class="col-lg-6 mb-4">
					<div class="card shadow-sm border-0 h-100">
						<div class="card-header">
							<h4 class="mb-0"><i class="fas fa-rocket text-warning mr-2"></i>Pilot Members</h4>
						</div>
						<div class="card-body p-0">
							<div class="table-responsive">
								<table class="table table-striped mb-0">
									<thead>
										<tr>
											<th>Programme</th>
											<th>Region</th>
											<th>Timeline</th>
										</tr>
									</thead>
									<tbody>
										@forelse ($pilotCandidates as $candidate)
											<tr>
												<td>{{ data_get($candidate, 'name', '—') }}</td>
												<td>{{ data_get($candidate, 'region', '—') }}</td>
												<td>{{ data_get($candidate, 'timeline', 'TBA') }}</td>
											</tr>
										@empty
											<tr>
												<td colspan="3" class="text-center text-muted">No pilot accounts identified.</td>
											</tr>
										@endforelse
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div class="alert alert-success border-0 shadow-sm">
				<h5 class="mb-2"><i class="fas fa-check-circle mr-2"></i>Stage Outlook</h5>
				<p class="mb-0">Stage 4 is the capstone of the AI roadmap, delivering trusted autonomy. Every launch must demonstrate measurable impact, complete transparency, and resilient fallbacks. The readiness gate keeps customer value and governance aligned.</p>
			</div>
		</div>
	</section>
@endsection
