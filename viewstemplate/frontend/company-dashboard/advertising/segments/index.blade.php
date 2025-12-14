@extends('frontend.company-dashboard.dashboard')

@section('company_content')
<div class="space-y-6">
	<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold text-slate-900">Audience segments</h1>
			<p class="text-sm text-slate-500">Define groups of members to reuse across campaigns.</p>
		</div>
		<a href="{{ route('company.advertising.segments.create') }}" class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded hover:bg-brand-700">
			<span class="mr-2">&#43;</span> New segment
		</a>
	</div>

	@if (session('status'))
		<div class="px-4 py-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded">
			{{ session('status') }}
		</div>
	@endif

	@if ($segments->isEmpty())
		<div class="bg-white shadow rounded p-8 text-center text-sm text-slate-500">
			<p>No audience segments yet. Create your first segment to start targeting campaigns.</p>
		</div>
	@else
		<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
			@foreach ($segments as $segment)
				<div class="bg-white shadow rounded p-5 space-y-4">
					<div class="flex items-start justify-between gap-3">
						<div class="space-y-1">
							<h2 class="text-lg font-semibold text-slate-900">
								{{ $segment->name }}
							</h2>
							@if ($segment->description)
								<p class="text-sm text-slate-500">{{ $segment->description }}</p>
							@endif
						</div>
						<span class="text-xs font-medium text-slate-500">{{ $segment->campaigns_count }} campaign(s)</span>
					</div>

					<div class="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
						Estimated audience size: <span class="font-semibold text-slate-700">{{ number_format($segment->estimateSize()) }}</span>
					</div>

					@if (! empty($segment->filters))
						<dl class="space-y-2 text-xs text-slate-600">
							@foreach ($segment->filters as $key => $value)
								<div>
									<dt class="font-semibold uppercase tracking-wide text-[11px] text-slate-500">{{ str_replace('_', ' ', ucfirst($key)) }}</dt>
									<dd>
										@if (is_array($value))
											@php
												$display = collect($value)
													->map(static function ($item, $itemKey) {
														if ($item === null || $item === '') {
															return null;
														}

														if (is_array($item)) {
															$nested = collect($item)
																->filter(static fn ($nestedItem) => $nestedItem !== null && $nestedItem !== '')
																->map(static fn ($nestedItem, $nestedKey) => is_numeric($nestedKey) ? (string) $nestedItem : $nestedKey . ': ' . $nestedItem)
																->implode(', ');

															return $nested ? ($itemKey . ': ' . $nested) : null;
														}

														return is_numeric($itemKey)
															? (string) $item
															: $itemKey . ': ' . $item;
													})
													->filter()
													->implode(', ');
											@endphp
											{{ $display ?: '—' }}
										@else
											{{ $value !== '' ? (string) $value : '—' }}
										@endif
									</dd>
								</div>
							@endforeach
						</dl>
					@else
						<p class="text-xs text-slate-500">No filter criteria captured.</p>
					@endif

					<div class="flex items-center justify-between gap-3 text-sm">
						<a href="{{ route('company.advertising.segments.edit', $segment) }}" class="text-brand-600 hover:text-brand-700">Edit</a>
						<form action="{{ route('company.advertising.segments.destroy', $segment) }}" method="POST" onsubmit="return confirm('Delete this segment? Campaigns using it will lose the targeting association.');">
							@csrf
							@method('DELETE')
							<button type="submit" class="text-red-600 hover:text-red-700">Delete</button>
						</form>
					</div>
				</div>
			@endforeach
		</div>

		<div>
			{{ $segments->withQueryString()->links() }}
		</div>
	@endif
</div>
@endsection
