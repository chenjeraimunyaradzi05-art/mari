@extends('admin.layouts.master')

@section('contents')
	<section class="section">
		<div class="section-header">
			<h1>Omega AI Control Center</h1>
			<div class="section-header-breadcrumb">
				<div class="breadcrumb-item"><a href="{{ route('admin.dashboard') }}">Dashboard</a></div>
				<div class="breadcrumb-item active">Omega AI</div>
			</div>
		</div>

		<div class="section-body">
			<div class="row mb-4">
				@forelse ($capabilities as $capability)
					<div class="col-lg-4 col-md-6 mb-3">
						<div class="card h-100 shadow-sm border-0">
							<div class="card-body">
								<h4 class="card-title" style="color: #E91E8C;">{{ data_get($capability, 'title', 'Capability') }}</h4>
								<p class="text-muted mb-0">{{ data_get($capability, 'description', 'No data available.') }}</p>
							</div>
						</div>
					</div>
				@empty
					<div class="col-12">
						<div class="alert alert-light border shadow-sm">No Omega AI telemetry recorded this month.</div>
					</div>
				@endforelse
			</div>

			<div class="card mb-4 shadow-sm border-0">
				<div class="card-header">
					<h4 class="mb-0"><i class="fas fa-network-wired text-primary mr-2"></i>Integration Status</h4>
				</div>
				<div class="card-body p-0">
					<div class="table-responsive">
						<table class="table table-striped mb-0">
							<thead>
								<tr>
									<th>Service</th>
									<th>Status</th>
									<th>Coverage</th>
								</tr>
							</thead>
							<tbody>
								@forelse ($integrationStatus as $integration)
									<tr>
										<td>{{ data_get($integration, 'name', 'Service') }}</td>
										<td><span class="badge badge-info">{{ data_get($integration, 'state', 'Unknown') }}</span></td>
										<td>{{ data_get($integration, 'coverage', '—') }}</td>
									</tr>
								@empty
									<tr>
										<td colspan="3" class="text-center text-muted">No integration metrics available right now.</td>
									</tr>
								@endforelse
							</tbody>
						</table>
					</div>
				</div>
			</div>

			<div class="card shadow-sm border-0">
				<div class="card-header">
					<h4 class="mb-0"><i class="fas fa-compass text-success mr-2"></i>Next Areas of Focus</h4>
				</div>
				<div class="card-body">
					<ul class="list-unstyled mb-0">
						@forelse ($nextFocus as $item)
							<li class="media mb-3">
								<span class="mr-3"><i class="fas fa-check-circle text-success"></i></span>
								<div class="media-body">{{ $item }}</div>
							</li>
						@empty
							<li class="media text-muted">
								<span class="mr-3"><i class="fas fa-info-circle"></i></span>
								<div class="media-body">No follow-up items logged.</div>
							</li>
						@endforelse
					</ul>
				</div>
			</div>
		</div>
	</section>
@endsection
