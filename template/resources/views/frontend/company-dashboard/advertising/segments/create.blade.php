@extends('frontend.company-dashboard.dashboard')

@php
	$isEditing = isset($segment) && $segment->exists;
	$filters = $isEditing ? ($segment->filters ?? []) : [];
	$oldFilters = old('filters', []);

	$formatList = static function ($key) use ($filters, $oldFilters) {
		$value = $oldFilters[$key] ?? ($filters[$key] ?? '');

		if (is_array($value)) {
			return implode(", ", $value);
		}

		return $value;
	};

	$experienceMin = $oldFilters['experience_min'] ?? ($filters['experience']['min'] ?? null);
	$experienceMax = $oldFilters['experience_max'] ?? ($filters['experience']['max'] ?? null);
@endphp

@section('company_content')
<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold text-slate-900">{{ $isEditing ? 'Edit segment' : 'Create segment' }}</h1>
			<p class="text-sm text-slate-500">Capture who this segment targets so campaigns can reuse it.</p>
		</div>
		<a href="{{ route('company.advertising.segments.index') }}" class="text-sm text-slate-500 hover:text-slate-700">Back to segments</a>
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
		<form
			method="POST"
			action="{{ $isEditing ? route('company.advertising.segments.update', $segment) : route('company.advertising.segments.store') }}"
			class="space-y-6"
		>
			@csrf
			@if ($isEditing)
				@method('PUT')
			@endif

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label for="name" class="block text-sm font-medium text-slate-700">Segment name</label>
					<input
						type="text"
						name="name"
						id="name"
						value="{{ old('name', $segment->name ?? '') }}"
						class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
						required
					>
					@error('name')
						<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
					@enderror
				</div>
				<div>
					<label for="description" class="block text-sm font-medium text-slate-700">Short description</label>
					<input
						type="text"
						name="description"
						id="description"
						value="{{ old('description', $segment->description ?? '') }}"
						class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
						placeholder="e.g. Rising women leaders in fintech"
					>
					@error('description')
						<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
					@enderror
				</div>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label for="filters_locations" class="block text-sm font-medium text-slate-700">Locations</label>
					<textarea
						name="filters[locations]"
						id="filters_locations"
						rows="2"
						class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
						placeholder="London, Manchester, Remote"
					>{{ $formatList('locations') }}</textarea>
					@error('filters.locations')
						<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
					@enderror
				</div>
				<div>
					<label for="filters_industries" class="block text-sm font-medium text-slate-700">Industries</label>
					<textarea
						name="filters[industries]"
						id="filters_industries"
						rows="2"
						class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
						placeholder="Fintech, SaaS, Sustainability"
					>{{ $formatList('industries') }}</textarea>
					@error('filters.industries')
						<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
					@enderror
				</div>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label for="filters_skills" class="block text-sm font-medium text-slate-700">Skills</label>
					<textarea
						name="filters[skills]"
						id="filters_skills"
						rows="2"
						class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
						placeholder="AI safety, Stakeholder management, Product strategy"
					>{{ $formatList('skills') }}</textarea>
					@error('filters.skills')
						<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
					@enderror
				</div>
				<div>
					<label for="filters_keywords" class="block text-sm font-medium text-slate-700">Keywords</label>
					<textarea
						name="filters[keywords]"
						id="filters_keywords"
						rows="2"
						class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
						placeholder="Women in leadership, Diverse leadership programmes"
					>{{ $formatList('keywords') }}</textarea>
					@error('filters.keywords')
						<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
					@enderror
				</div>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label for="filters_experience_min" class="block text-sm font-medium text-slate-700">Experience (min years)</label>
					<input
						type="number"
						name="filters[experience_min]"
						id="filters_experience_min"
						value="{{ $experienceMin }}"
						min="0"
						max="60"
						class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
					>
					@error('filters.experience_min')
						<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
					@enderror
				</div>
				<div>
					<label for="filters_experience_max" class="block text-sm font-medium text-slate-700">Experience (max years)</label>
					<input
						type="number"
						name="filters[experience_max]"
						id="filters_experience_max"
						value="{{ $experienceMax }}"
						min="0"
						max="60"
						class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
					>
					@error('filters.experience_max')
						<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
					@enderror
				</div>
			</div>

			<div>
				<label for="filters_notes" class="block text-sm font-medium text-slate-700">Additional notes</label>
				<textarea
					name="filters[notes]"
					id="filters_notes"
					rows="3"
					class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
					placeholder="Context or extra constraints for the audience"
				>{{ $oldFilters['notes'] ?? ($filters['notes'] ?? '') }}</textarea>
				@error('filters.notes')
					<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
				@enderror
			</div>

			@if ($isEditing)
				<div class="rounded border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
					Estimated audience size: <span class="font-semibold text-slate-700">{{ number_format($segment->estimateSize()) }}</span>
				</div>
			@endif

			<div class="flex items-center justify-end gap-3">
				<a href="{{ route('company.advertising.segments.index') }}" class="text-sm text-slate-500 hover:text-slate-700">Cancel</a>
				<button type="submit" class="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded hover:bg-brand-700">
					{{ $isEditing ? 'Save changes' : 'Create segment' }}
				</button>
			</div>
		</form>
	</div>
</div>
@endsection
