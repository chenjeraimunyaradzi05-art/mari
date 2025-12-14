@extends('admin.layouts.master')

@section('contents')
	<section class="section">
		<div class="section-header">
			<h1>Company Verifications</h1>
			<div class="section-header-button">
				<a href="{{ route('admin.verifications.export', request()->only(['q', 'status'])) }}" class="btn btn-outline-primary">
					<i class="fas fa-file-export"></i>
					Export CSV
				</a>
			</div>
		</div>

		<div class="section-body">
			<div class="row">
				<div class="col-12">
					<div class="card">
						<div class="card-header">
							<h4>Verification Requests</h4>
							<div class="card-header-form">
								<form action="{{ route('admin.verifications.index') }}" method="GET" class="form-inline">
									<div class="form-group mr-2 mb-2">
										<label for="status" class="sr-only">Status</label>
										<select name="status" id="status" class="form-control">
											<option value="">All Statuses</option>
											@foreach ($statuses as $status)
												<option value="{{ $status->value }}" @selected(($filters['status'] ?? null) === $status->value)>
													{{ \Illuminate\Support\Str::title(str_replace('_', ' ', $status->value)) }}
												</option>
											@endforeach
										</select>
									</div>
									<div class="input-group mb-2">
										<input type="text" class="form-control" placeholder="Search company" name="q"
											value="{{ $filters['q'] ?? '' }}">
										<div class="input-group-append">
											<button class="btn btn-primary" type="submit">
												<i class="fas fa-search"></i>
											</button>
										</div>
									</div>
								</form>
							</div>
						</div>

						<div class="card-body p-0">
							<div class="table-responsive">
								<table class="table table-striped">
									<thead>
										<tr>
											<th>ID</th>
											<th>Company</th>
											<th>Status</th>
											<th>Submitted</th>
											<th>Reviewer</th>
											<th style="width: 12%">Action</th>
										</tr>
									</thead>
									<tbody>
										@forelse ($verifications as $verification)
											<tr>
												<td>#{{ $verification->id }}</td>
												<td>
													<strong>{{ $verification->company?->name ?? 'Unknown' }}</strong>
													<br>
													<small>{{ $verification->company?->email }}</small>
												</td>
												<td>
													@php
														$statusLabel = \Illuminate\Support\Str::title(str_replace('_', ' ', optional($verification->status)->value ?? (string) $verification->status));
													@endphp
													<span class="badge badge-info">{{ $statusLabel }}</span>
												</td>
												<td>
													{{ optional($verification->submitted_at)->format('M d, Y H:i') ?? '—' }}
												</td>
												<td>
													{{ $verification->reviewer?->name ?? '—' }}
												</td>
												<td>
													<a href="{{ route('admin.verifications.show', $verification) }}"
														class="btn btn-sm btn-outline-primary">View</a>
												</td>
											</tr>
										@empty
											<tr>
												<td colspan="6" class="text-center py-5">
													No verifications found.
												</td>
											</tr>
										@endforelse
									</tbody>
								</table>
							</div>
						</div>
						<div class="card-footer text-right">
							<nav class="d-inline-block">
								@if ($verifications->hasPages())
									{{ $verifications->links() }}
								@endif
							</nav>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>
@endsection
