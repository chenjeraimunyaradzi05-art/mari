@extends('frontend.layouts.master')

@section('title', 'Resume Parser Preview')

@section('contents')
<div class="container py-5">
	<div class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
		<div>
			<h1 class="h2 fw-bold mb-1">
				<i class="fas fa-file-alt me-2 text-primary"></i>Parsed Resume Preview
			</h1>
			<p class="text-muted mb-0">Review extracted information before applying it to your profile.</p>
		</div>
		<a href="{{ route('member.resume-parser.index') }}" class="btn btn-outline-secondary">
			<i class="fas fa-upload me-2"></i>Upload Another Resume
		</a>
	</div>

	<div class="row g-4">
		<div class="col-lg-8">
			<div class="card border-0 shadow-sm mb-4">
				<div class="card-body">
					<h5 class="mb-3">Resume Summary</h5>
					@if(!empty($resume['parsed']['summary']))
						<p class="text-muted">{{ $resume['parsed']['summary'] }}</p>
					@else
						<p class="text-muted">No summary available for this file.</p>
					@endif
				</div>
			</div>

			<div class="card border-0 shadow-sm mb-4">
				<div class="card-body">
					<h5 class="mb-3">Experience Highlights</h5>
					@php $experienceHighlights = $resume['parsed']['experience'] ?? []; @endphp
					@forelse($experienceHighlights as $item)
						<div class="border-start ps-3 mb-3">
							<p class="mb-0 text-muted">{{ $item }}</p>
						</div>
					@empty
						<p class="text-muted mb-0">We could not detect experience details. You can add them manually in your profile.</p>
					@endforelse

					@if(!empty($resume['parsed']['experience_detailed']))
						<hr>
						<h6 class="fw-semibold text-muted">Detailed Roles</h6>
						@foreach($resume['parsed']['experience_detailed'] as $entry)
							<div class="mb-3">
								<div class="fw-semibold">{{ $entry['role'] ?? 'Role not detected' }}</div>
								@if(!empty($entry['company']) || !empty($entry['duration']))
									<small class="text-muted">{{ $entry['company'] ?? 'Company not detected' }} {{ !empty($entry['duration']) ? ' • '.$entry['duration'] : '' }}</small>
								@endif
								@if(!empty($entry['summary']))
									<p class="text-muted small mb-0">{{ $entry['summary'] }}</p>
								@endif
							</div>
						@endforeach
					@endif
				</div>
			</div>

			<div class="card border-0 shadow-sm">
				<div class="card-body">
					<h5 class="mb-3">Education Highlights</h5>
					@forelse($resume['parsed']['education'] ?? [] as $item)
						<div class="border-start ps-3 mb-3">
							<p class="mb-0 text-muted">{{ $item }}</p>
						</div>
					@empty
						<p class="text-muted mb-0">No education entries detected. You can update them later under your profile.</p>
					@endforelse

					@if(!empty($resume['parsed']['education_detailed']))
						<hr>
						<h6 class="fw-semibold text-muted">Academic Detail</h6>
						@foreach($resume['parsed']['education_detailed'] as $entry)
							<div class="mb-3">
								<div class="fw-semibold">{{ $entry['degree'] ?? 'Degree not detected' }}</div>
								@if(!empty($entry['institution']) || !empty($entry['duration']))
									<small class="text-muted">{{ $entry['institution'] ?? 'Institution not detected' }} {{ !empty($entry['duration']) ? ' • '.$entry['duration'] : '' }}</small>
								@endif
								@if(!empty($entry['notes']))
									<p class="text-muted small mb-0">{{ $entry['notes'] }}</p>
								@endif
							</div>
						@endforeach
					@endif
				</div>
			</div>
		</div>
		<div class="col-lg-4">
			<div class="card border-0 shadow-sm mb-4">
				<div class="card-body">
					<h5 class="mb-3">File Details</h5>
					<ul class="list-unstyled mb-0">
						<li class="mb-2"><strong>Name:</strong> {{ $resume['original_name'] ?? 'N/A' }}</li>
						<li class="mb-2"><strong>Size:</strong> {{ number_format(($resume['size'] ?? 0) / 1024, 2) }} KB</li>
						<li class="mb-2"><strong>Uploaded:</strong> {{ optional($resume['uploaded_at'])->diffForHumans() ?? 'Just now' }}</li>
						<li class="mb-0"><strong>Type:</strong> {{ $resume['mime_type'] ?? 'Unknown' }}</li>
					</ul>
					@if(isset($resume['confidence']))
						<div class="mt-3">
							<div class="d-flex justify-content-between align-items-center">
								<span class="text-muted">Parse confidence</span>
								<strong>{{ (int) $resume['confidence'] }}%</strong>
							</div>
							<div class="progress mt-2" style="height: 6px;">
								<div class="progress-bar bg-success" role="progressbar" style="width: {{ (int) $resume['confidence'] }}%"></div>
							</div>
						</div>
					@endif
				</div>
			</div>

			<div class="card border-0 shadow-sm">
				<div class="card-body">
					<h5 class="mb-3">Detected Contacts</h5>
					@php $contacts = $resume['parsed']['contacts'] ?? []; @endphp
					@if(empty($contacts))
						<p class="text-muted mb-0">Contact details were not detected. We recommend adding them manually to ensure recruiters can reach you.</p>
					@else
						<ul class="list-unstyled mb-0">
							@foreach($contacts as $label => $value)
								<li class="mb-2"><strong class="text-capitalize">{{ $label }}:</strong> {{ $value }}</li>
							@endforeach
						</ul>
					@endif
				</div>
			</div>

			<div class="card border-0 shadow-sm mt-4">
				<div class="card-body">
					<h5 class="mb-3">Skills Extracted</h5>
					<div class="d-flex flex-wrap gap-2">
						@forelse($resume['parsed']['skills'] ?? [] as $skill)
							<span class="badge bg-light text-secondary border">{{ $skill }}</span>
						@empty
							<p class="text-muted mb-0">No specific skills detected yet.</p>
						@endforelse
					</div>
				</div>
			</div>

			@if(!empty($resume['parsed']['certifications']) || !empty($resume['parsed']['languages']) || !empty($resume['parsed']['achievements']))
				<div class="card border-0 shadow-sm mt-4">
					<div class="card-body">
						<h5 class="mb-3">Additional Highlights</h5>
						@if(!empty($resume['parsed']['certifications']))
							<div class="mb-3">
								<h6 class="fw-semibold mb-2">Certifications & Training</h6>
								<ul class="list-unstyled small text-muted mb-0">
									@foreach($resume['parsed']['certifications'] as $item)
										<li class="mb-1">{{ $item }}</li>
									@endforeach
								</ul>
							</div>
						@endif
						@if(!empty($resume['parsed']['languages']))
							<div class="mb-3">
								<h6 class="fw-semibold mb-2">Languages</h6>
								<div class="d-flex flex-wrap gap-2">
									@foreach($resume['parsed']['languages'] as $language)
										<span class="badge bg-light text-secondary border">{{ $language }}</span>
									@endforeach
								</div>
							</div>
						@endif
						@if(!empty($resume['parsed']['achievements']))
							<div>
								<h6 class="fw-semibold mb-2">Achievements & Projects</h6>
								<ul class="list-unstyled small text-muted mb-0">
									@foreach($resume['parsed']['achievements'] as $item)
										<li class="mb-1">{{ $item }}</li>
									@endforeach
								</ul>
							</div>
						@endif
					</div>
				</div>
			@endif
		</div>
	</div>

	<div class="alert alert-info mt-4" role="alert">
		<div class="d-flex align-items-start">
			<i class="fas fa-circle-info me-2 mt-1"></i>
			<div>
				<strong>What happens next?</strong>
				<p class="mb-0">Use this preview to update your profile manually. Automated profile sync is coming soon.</p>
			</div>
		</div>
	</div>
</div>
@endsection
