@extends('frontend.company-dashboard.dashboard')

@php use Illuminate\Support\Str; @endphp

@section('company_content')
<div class="space-y-6">
	<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold text-slate-900">Lead Inbox</h1>
			<p class="text-sm text-slate-500">Review recent enquiries, prioritise follow up, and track qualification insights.</p>
		</div>
		<a href="{{ route('company.advertising.campaigns.index') }}" class="inline-flex items-center px-4 py-2 text-sm font-medium text-brand-600 bg-brand-50 rounded hover:bg-brand-100">
			<span class="mr-2">&#128202;</span> View campaign performance
		</a>
	</div>

	@if (session('status'))
		<div class="px-4 py-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded">
			{{ session('status') }}
		</div>
	@endif

	<div class="grid gap-4 md:grid-cols-4">
		<div class="bg-white rounded shadow-sm p-4">
			<div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total leads</div>
			<div class="mt-2 text-2xl font-semibold text-slate-900">{{ number_format($insights['total'] ?? 0) }}</div>
			<div class="text-xs text-slate-400 mt-1">Lifetime captured across your published pages.</div>
		</div>
		<div class="bg-white rounded shadow-sm p-4">
			<div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">New this week</div>
			<div class="mt-2 text-2xl font-semibold text-slate-900">{{ number_format($insights['new_this_week'] ?? 0) }}</div>
			<div class="text-xs text-slate-400 mt-1">Leads received in the last 7 days.</div>
		</div>
		<div class="bg-white rounded shadow-sm p-4">
			<div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg qualification score</div>
			<div class="mt-2 text-2xl font-semibold text-slate-900">{{ number_format($insights['avg_score'] ?? 0, 1) }}</div>
			<div class="text-xs text-slate-400 mt-1">Based on recent AI-assessed leads.</div>
		</div>
		<div class="bg-white rounded shadow-sm p-4">
			<div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">High priority</div>
			<div class="mt-2 text-2xl font-semibold text-slate-900">{{ number_format($insights['high_priority'] ?? 0) }}</div>
			<div class="text-xs text-slate-400 mt-1">Urgent or high intent leads awaiting action.</div>
		</div>
	</div>

	<div class="bg-white rounded shadow-sm border border-slate-200">
		<form method="GET" class="p-4 space-y-4">
			<div class="grid gap-4 md:grid-cols-5">
				<div>
					<label for="status" class="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</label>
					<select id="status" name="status" class="mt-1 w-full border-slate-300 rounded text-sm">
						<option value="">All statuses</option>
						@foreach ($availableStatuses as $value => $label)
							<option value="{{ $value }}" @selected(($filters['status'] ?? null) === $value)>{{ $label }}</option>
						@endforeach
					</select>
				</div>
				<div>
					<label for="priority" class="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Priority</label>
					<select id="priority" name="priority" class="mt-1 w-full border-slate-300 rounded text-sm">
						<option value="">All priorities</option>
						@foreach ($availablePriorities as $value => $label)
							<option value="{{ $value }}" @selected(($filters['priority'] ?? null) === $value)>{{ $label }}</option>
						@endforeach
					</select>
				</div>
				<div>
					<label for="type" class="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Lead type</label>
					<select id="type" name="type" class="mt-1 w-full border-slate-300 rounded text-sm">
						<option value="">All intents</option>
						@foreach ($availableTypes as $value => $label)
							<option value="{{ $value }}" @selected(($filters['type'] ?? null) === $value)>{{ $label }}</option>
						@endforeach
					</select>
				</div>
				<div>
					<label for="window" class="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Timeframe</label>
					<select id="window" name="window" class="mt-1 w-full border-slate-300 rounded text-sm">
						@foreach ($availableWindows as $value => $label)
							<option value="{{ $value }}" @selected(($filters['window'] ?? '30d') === $value)>{{ $label }}</option>
						@endforeach
					</select>
				</div>
				<div>
					<label for="search" class="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Search</label>
					<input id="search" name="search" type="text" value="{{ $filters['search'] ?? '' }}" placeholder="Name or email" class="mt-1 w-full border-slate-300 rounded text-sm" />
				</div>
			</div>
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
				<div class="text-xs text-slate-400">Filters run on submit. Combine multiple dimensions to focus on the most actionable leads.</div>
				<div class="flex items-center gap-3">
					<a href="{{ route('company.leads.index') }}" class="text-sm text-slate-500 hover:text-slate-700">Reset</a>
					<button type="submit" class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded hover:bg-brand-700">Apply filters</button>
				</div>
			</div>
		</form>
	</div>

	<div class="bg-white rounded shadow-sm">
		<div class="overflow-x-auto">
			<table class="min-w-full divide-y divide-slate-200">
				<thead class="bg-slate-50">
					<tr>
						<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Lead</th>
						<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
						<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Score</th>
						<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Priority</th>
						<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
						<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Submitted</th>
						<th class="px-4 py-3"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-200">
					@forelse ($leads as $lead)
						<tr>
							<td class="px-4 py-4 align-top text-sm text-slate-700">
								<div class="font-medium text-slate-900">{{ $lead->contact_name ?? 'Anonymous prospect' }}</div>
								<div class="text-xs text-slate-500">{{ $lead->contact_email ?? 'Email not provided' }}</div>
								@if ($lead->assignedUser)
									<div class="text-xs text-slate-400 mt-1">Assigned to {{ $lead->assignedUser->name }}</div>
								@endif
							</td>
							<td class="px-4 py-4 align-top text-sm text-slate-700">{{ Str::headline($lead->type) }}</td>
							<td class="px-4 py-4 align-top text-sm text-slate-700">
								@if ($lead->qualification_score)
									<div class="font-semibold text-slate-900">{{ $lead->qualification_score }}</div>
									<div class="text-xs text-slate-500">Grade {{ $lead->qualification_grade }}</div>
								@else
									<span class="text-xs text-slate-400">Pending evaluation</span>
								@endif
							</td>
							<td class="px-4 py-4 align-top">
								@if ($lead->qualification_priority)
									<span class="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full @class([
										'bg-rose-100 text-rose-700' => $lead->qualification_priority === 'urgent',
										'bg-amber-100 text-amber-700' => $lead->qualification_priority === 'high',
										'bg-emerald-100 text-emerald-700' => $lead->qualification_priority === 'standard',
										'bg-slate-100 text-slate-600' => $lead->qualification_priority === 'low',
									])">
										{{ Str::headline($lead->qualification_priority) }}
									</span>
								@else
									<span class="text-xs text-slate-400">Not set</span>
								@endif
							</td>
							<td class="px-4 py-4 align-top">
								<span class="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full @class([
									'bg-slate-100 text-slate-700' => $lead->status === 'new',
									'bg-emerald-100 text-emerald-700' => $lead->status === 'qualified',
									'bg-sky-100 text-sky-700' => $lead->status === 'contacted',
									'bg-indigo-100 text-indigo-700' => $lead->status === 'nurturing',
									'bg-slate-200 text-slate-600' => $lead->status === 'disqualified',
								])">
									{{ Str::headline($lead->status) }}
								</span>
							</td>
							<td class="px-4 py-4 align-top text-sm text-slate-700">
								<div>{{ optional($lead->submitted_at)->format('M j, Y g:i a') ?? '--' }}</div>
								<div class="text-xs text-slate-500">{{ $lead->submitted_at?->diffForHumans() ?? 'No timestamp' }}</div>
							</td>
							<td class="px-4 py-4 align-top text-right">
								<a href="{{ route('company.leads.show', $lead) }}" class="text-sm text-brand-600 hover:text-brand-700">View lead</a>
							</td>
						</tr>
					@empty
						<tr>
							<td colspan="7" class="px-4 py-10 text-center text-sm text-slate-500">No leads match your filters yet. Adjust filters or drive more traffic from your active campaigns.</td>
						</tr>
					@endforelse
				</tbody>
			</table>
		</div>
		<div class="px-4 py-3 border-t border-slate-200">
			{{ $leads->links() }}
		</div>
	</div>
</div>
@endsection
