@extends('frontend.company-dashboard.dashboard')

@section('company_content')
<div class="space-y-6">
	<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold text-slate-900">Campaign performance log</h1>
			<p class="text-sm text-slate-500">Capture daily delivery metrics to power the performance dashboard.</p>
		</div>
		<div class="flex items-center gap-2">
			<a href="{{ route('company.advertising.campaigns.show', $campaign) }}" class="text-sm text-slate-500 hover:text-slate-700">Back to campaign</a>
			<a href="{{ route('company.advertising.campaigns.metrics.create', $campaign) }}" class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-brand-600 rounded hover:bg-brand-700">Log new day</a>
		</div>
	</div>

	@if (session('status'))
		<div class="px-4 py-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded">
			{{ session('status') }}
		</div>
	@endif

	<div class="bg-white shadow rounded">
		@if ($metrics->isEmpty())
			<p class="px-6 py-8 text-sm text-slate-500">No entries recorded yet. Log your first day above.</p>
		@else
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-slate-200 text-sm">
					<thead class="bg-slate-50">
						<tr class="text-left text-slate-500 uppercase tracking-wide text-xs">
							<th class="px-4 py-3">Date</th>
							<th class="px-4 py-3">Impressions</th>
							<th class="px-4 py-3">Clicks</th>
							<th class="px-4 py-3">Conversions</th>
							<th class="px-4 py-3">Qualified leads</th>
							<th class="px-4 py-3">Spend</th>
							<th class="px-4 py-3">CTR</th>
							<th class="px-4 py-3">CPA</th>
							<th class="px-4 py-3"></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100 text-slate-700">
						@foreach ($metrics as $metric)
							<tr>
								<td class="px-4 py-3 whitespace-nowrap">{{ optional($metric->recorded_at)->format('M j, Y') }}</td>
								<td class="px-4 py-3">{{ number_format($metric->impressions) }}</td>
								<td class="px-4 py-3">{{ number_format($metric->clicks) }}</td>
								<td class="px-4 py-3">{{ number_format($metric->conversions) }}</td>
								<td class="px-4 py-3">{{ number_format($metric->qualified_leads) }}</td>
								<td class="px-4 py-3">${{ number_format($metric->spend, 2) }}</td>
								<td class="px-4 py-3">{{ number_format($metric->ctr, 2) }}%</td>
								<td class="px-4 py-3">${{ number_format($metric->cpa, 2) }}</td>
								<td class="px-4 py-3 text-right">
									<a href="{{ route('company.advertising.campaigns.metrics.edit', [$campaign, $metric]) }}" class="text-xs font-medium text-brand-600 hover:text-brand-700 mr-3">Edit</a>
									<form action="{{ route('company.advertising.campaigns.metrics.destroy', [$campaign, $metric]) }}" method="POST" class="inline" onsubmit="return confirm('Delete this entry?');">
										@csrf
										@method('DELETE')
										<button type="submit" class="text-xs font-medium text-rose-600 hover:text-rose-700">Delete</button>
									</form>
								</td>
							</tr>
						@endforeach
					</tbody>
				</table>
			</div>

			<div class="px-4 py-3 border-t border-slate-200">
				{{ $metrics->links() }}
			</div>
		@endif
	</div>
</div>
@endsection
