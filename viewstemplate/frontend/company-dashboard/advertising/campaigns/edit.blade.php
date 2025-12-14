@extends('frontend.company-dashboard.dashboard')

@section('company_content')
<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold text-slate-900">Edit campaign</h1>
			<p class="text-sm text-slate-500">Update budget, targeting, and messaging before launching.</p>
		</div>
		<a href="{{ route('company.advertising.campaigns.show', $campaign) }}" class="text-sm text-slate-500 hover:text-slate-700">View campaign</a>
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
		<form method="POST" action="{{ route('company.advertising.campaigns.update', $campaign) }}" class="space-y-6">
			@csrf
			@method('PUT')
			@include('frontend.company-dashboard.advertising.campaigns.partials.form', [
				'campaign' => $campaign,
				'segments' => $segments,
				'objectives' => $objectives,
				'submitLabel' => 'Save changes',
			])
		</form>
	</div>
</div>
@endsection
