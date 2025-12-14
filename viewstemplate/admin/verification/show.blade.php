@extends('admin.layouts.master')

@section('contents')
	<section class="section">
		<div class="section-header">
			<h1>Verification #{{ $verification->id }}</h1>
			<div class="section-header-breadcrumb">
				<div class="breadcrumb-item"><a href="{{ route('admin.dashboard') }}">Dashboard</a></div>
				<div class="breadcrumb-item"><a href="{{ route('admin.verifications.index') }}">Company Verifications</a></div>
				<div class="breadcrumb-item active">Details</div>
			</div>
		</div>

		<div class="section-body">
			<div class="row">
				<div class="col-lg-8">
					<div class="card">
						<div class="card-header">
							<h4>Submission Overview</h4>
						</div>
						<div class="card-body">
							<dl class="row">
								<dt class="col-sm-4">Company</dt>
								<dd class="col-sm-8">
									<strong>{{ $verification->company?->name ?? 'Unknown company' }}</strong>
									<br>
									<span class="text-muted">{{ $verification->company?->email }}</span>
								</dd>

								<dt class="col-sm-4">Status</dt>
								<dd class="col-sm-8">
									@php
										$statusLabel = \Illuminate\Support\Str::title(str_replace('_', ' ', optional($verification->status)->value ?? (string) $verification->status));
									@endphp
									<span class="badge badge-info">{{ $statusLabel }}</span>
								</dd>

								<dt class="col-sm-4">Submitted At</dt>
								<dd class="col-sm-8">{{ optional($verification->submitted_at)->format('M d, Y H:i') ?? '—' }}</dd>

								<dt class="col-sm-4">Reviewed At</dt>
								<dd class="col-sm-8">{{ optional($verification->reviewed_at)->format('M d, Y H:i') ?? '—' }}</dd>

								<dt class="col-sm-4">Reviewer</dt>
								<dd class="col-sm-8">{{ $verification->reviewer?->name ?? '—' }}</dd>

								@if ($verification->notes)
									<dt class="col-sm-4">Notes</dt>
									<dd class="col-sm-8">{!! nl2br(e($verification->notes)) !!}</dd>
								@endif
							</dl>
						</div>
					</div>

					<div class="card">
						<div class="card-header">
							<h4>Documents</h4>
						</div>
						<div class="card-body">
							@php
								$documents = is_array($verification->documents) ? $verification->documents : [];
							@endphp
							@if (count($documents))
								<ul class="list-unstyled mb-0">
									@foreach ($documents as $document)
										<li class="mb-2">
											<i class="fas fa-paperclip"></i>
											@if (is_array($document) && isset($document['url']))
												<a href="{{ $document['url'] }}" target="_blank" rel="noopener">
													{{ $document['name'] ?? basename($document['url']) }}
												</a>
											@elseif (is_string($document))
												<a href="{{ $document }}" target="_blank" rel="noopener">
													{{ basename($document) }}
												</a>
											@else
												<span class="text-muted">Unrecognised document format</span>
											@endif
										</li>
									@endforeach
								</ul>
							@else
								<p class="text-muted mb-0">No documents were attached to this submission.</p>
							@endif

							@if ($verification->evidence_path)
								<div class="mt-3">
									<i class="fas fa-folder-open"></i>
									<a href="{{ $verification->evidence_path }}" target="_blank" rel="noopener">Evidence folder</a>
								</div>
							@endif
						</div>
					</div>
				</div>

				<div class="col-lg-4">
					<div class="card">
						<div class="card-header">
							<h4>Metadata</h4>
						</div>
						<div class="card-body">
							@php
								$metadata = is_array($verification->metadata) ? $verification->metadata : [];
							@endphp
							@if (count($metadata))
								<ul class="list-group list-group-flush">
									@foreach ($metadata as $key => $value)
										<li class="list-group-item d-flex justify-content-between align-items-start">
											<span class="font-weight-bold mr-2">{{ \Illuminate\Support\Str::title(str_replace('_', ' ', $key)) }}</span>
											<span class="text-muted">{{ is_scalar($value) ? $value : json_encode($value) }}</span>
										</li>
									@endforeach
								</ul>
							@else
								<p class="text-muted mb-0">No metadata available.</p>
							@endif
						</div>
					</div>

					<div class="card">
						<div class="card-body">
							<a href="{{ route('admin.verifications.index') }}" class="btn btn-outline-secondary btn-block">
								<i class="fas fa-arrow-left"></i>
								Back to list
							</a>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>
@endsection
