@extends('admin.layouts.master')

@section('contents')
	<section class="section">
		<div class="section-header">
			<h1>Quantum AI · Research Lab</h1>
			<div class="section-header-breadcrumb">
				<div class="breadcrumb-item"><a href="{{ route('admin.dashboard') }}">Dashboard</a></div>
				<div class="breadcrumb-item active">Quantum AI</div>
			</div>
		</div>

		<div class="section-body">
			<div class="row mb-4">
				@forelse ($experiments as $experiment)
					<div class="col-lg-4 col-md-6 mb-3">
						<div class="card h-100 shadow-sm border-0">
							<div class="card-body">
								<h4 class="card-title" style="color: #6366F1;">{{ data_get($experiment, 'name', 'Exploration') }}</h4>
								<p class="text-muted">{{ data_get($experiment, 'focus', 'No insight captured.') }}</p>
							</div>
							<div class="card-footer bg-white">
								<span class="badge badge-warning text-uppercase">{{ data_get($experiment, 'stage', 'Discovery') }}</span>
							</div>
						</div>
					</div>
				@empty
					<div class="col-12">
						<div class="alert alert-light border shadow-sm">No experimental signals logged in the last quarter.</div>
					</div>
				@endforelse
			</div>

			<div class="card mb-4 shadow-sm border-0">
				<div class="card-header">
					<h4 class="mb-0"><i class="fas fa-flask text-primary mr-2"></i>Research Principles</h4>
				</div>
				<div class="card-body">
					<ul class="list-unstyled mb-0">
						@forelse ($researchNotes as $note)
							<li class="mb-2">
								<i class="fas fa-star text-warning mr-2"></i>{{ $note }}</li>
						@empty
							<li class="text-muted">No research notes available.</li>
						@endforelse
					</ul>
				</div>
			</div>

			<div class="card shadow-sm border-0">
				<div class="card-header">
					<h4 class="mb-0"><i class="fas fa-handshake text-success mr-2"></i>Collaboration Channels</h4>
				</div>
				<div class="card-body p-0">
					<div class="table-responsive">
						<table class="table table-striped mb-0">
							<thead>
								<tr>
									<th>Channel</th>
									<th>Audience</th>
									<th>Next Session</th>
								</tr>
							</thead>
							<tbody>
								@forelse ($collaborationChannels as $channel)
									<tr>
										<td>{{ data_get($channel, 'name', 'Channel') }}</td>
										<td>{{ data_get($channel, 'audience', '—') }}</td>
										<td>{{ data_get($channel, 'next_session', 'TBA') }}</td>
									</tr>
								@empty
									<tr>
										<td colspan="3" class="text-center text-muted">No collaboration forums scheduled.</td>
									</tr>
								@endforelse
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	</section>
@endsection
