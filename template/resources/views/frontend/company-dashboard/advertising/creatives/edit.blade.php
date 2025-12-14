@extends('frontend.company-dashboard.dashboard')

@section('company_content')
<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold text-slate-900">Edit creative</h1>
			<p class="text-sm text-slate-500">Update the messaging, destination, or review status for this creative.</p>
		</div>
		<a href="{{ route('company.advertising.campaigns.show', $campaign) }}" class="text-sm text-slate-500 hover:text-slate-700">Back to campaign</a>
	</div>

	@if ($errors->any())
		<div class="px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded">
			<p class="font-semibold">We found a few issues:</p>
			<ul class="mt-2 list-disc list-inside space-y-1">
				@foreach ($errors->all() as $error)
					<li>{{ $error }}</li>
				@endforeach
			</ul>
		</div>
	@endif

	<div class="bg-white shadow rounded p-6">
		<form method="POST" action="{{ route('company.advertising.campaigns.creatives.update', [$campaign, $creative]) }}" class="space-y-6">
			@csrf
			@method('PUT')
			@include('frontend.company-dashboard.advertising.creatives.partials.form', [
				'campaign' => $campaign,
				'creative' => $creative,
				'formats' => $formats,
				'statuses' => $statuses,
				'reviewStatuses' => $reviewStatuses,
				'submitLabel' => 'Update creative',
			])
		</form>
	</div>
</div>
@endsection
