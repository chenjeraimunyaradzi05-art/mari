@extends('admin.layouts.master')

@section('contents')
	<section class="section">
		<div class="section-header">
			<h1>AI Stage 3 · Personalised Experiences</h1>
			<div class="section-header-breadcrumb">
				<div class="breadcrumb-item"><a href="{{ route('admin.dashboard') }}">Dashboard</a></div>
				<div class="breadcrumb-item"><a href="{{ route('admin.ai-stage2.index') }}">Stage 2</a></div>
				<div class="breadcrumb-item active">Stage 3</div>
			</div>
		</div>

		<div class="section-body">
			<div class="row">
				@forelse ($personalisationTracks as $track)
					<div class="col-lg-4 col-md-6 mb-4">
						<div class="card h-100 shadow-sm border-0">
							<div class="card-body">
								<h4 class="card-title" style="color: #8B5CF6;">{{ data_get($track, 'title', 'Experience Track') }}</h4>
								<p class="text-muted">{{ data_get($track, 'description', 'No description available yet.') }}</p>
							</div>
							<div class="card-footer bg-white d-flex justify-content-between align-items-center">
								<span class="badge badge-info text-uppercase">{{ data_get($track, 'status', 'Pending') }}</span>
								<small class="text-muted">Confidence: {{ data_get($track, 'confidence', 'N/A') }}</small>
							</div>
						</div>
					</div>
				@empty
					<div class="col-12">
						<div class="alert alert-light border shadow-sm">No personalisation tracks available. Sync demand data to unlock insights.</div>
					</div>
				@endforelse
			</div>

			<div class="row">
				<div class="col-lg-7 mb-4">
					<div class="card shadow-sm border-0 h-100">
						<div class="card-header">
							<h4 class="mb-0"><i class="fas fa-user-shield text-primary mr-2"></i>Guardrails</h4>
						</div>
						<div class="card-body">
							<ul class="list-group list-group-flush">
								@forelse ($guardrails as $guardrail)
									<li class="list-group-item">{{ $guardrail }}</li>
								@empty
									<li class="list-group-item text-muted">No guardrails documented for this period.</li>
								@endforelse
							</ul>
						</div>
					</div>
				</div>
				<div class="col-lg-5 mb-4">
					<div class="card shadow-sm border-0 h-100">
						<div class="card-header">
							<h4 class="mb-0"><i class="fas fa-flag-checkered text-success mr-2"></i>Milestones</h4>
						</div>
						<div class="card-body">
							<div class="timeline">
								@forelse ($milestones as $milestone)
									<div class="mb-3">
										<h6 class="mb-1">{{ data_get($milestone, 'label', 'Milestone') }}</h6>
										<span class="badge badge-light">Target: {{ data_get($milestone, 'target', 'TBA') }}</span>
									</div>
								@empty
									<p class="text-muted mb-0">No milestones achieved recently.</p>
								@endforelse
							</div>
						</div>
					</div>
				</div>
			</div>

			<div class="alert alert-light border shadow-sm">
				<h5 class="mb-2"><i class="fas fa-lightbulb text-warning mr-2"></i>Stage Outcome</h5>
				<p class="mb-0">Stage 3 unlocks adaptive experiences across the platform, delivering smarter recommendations, proactive insights, and conversational assistance while staying aligned with responsible AI commitments.</p>
			</div>
		</div>
	</section>
@endsection
