@php
	$selectedSegments = collect(old('audience_segments', $campaign->audienceSegments->pluck('id')->all() ?? []))->map(fn ($id) => (int) $id)->all();
	$startsAt = old('starts_at', optional($campaign->starts_at)->format('Y-m-d'));
	$endsAt = old('ends_at', optional($campaign->ends_at)->format('Y-m-d'));
	$targeting = old('targeting', $campaign->targeting ?? []);
	if (is_array($targeting)) {
		$targeting = collect($targeting)
			->map(static function ($value) {
				if (is_array($value)) {
					return implode(', ', array_filter(array_map('strval', $value)));
				}

				return $value;
			})
			->all();
	}
	$tracking = old('tracking_parameters', $campaign->tracking_parameters ?? []);
@endphp

<div class="space-y-6">
	<div>
		<label for="name" class="block text-sm font-medium text-slate-700">Campaign name</label>
		<input
			type="text"
			name="name"
			id="name"
			value="{{ old('name', $campaign->name) }}"
			class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
			required
		>
		@error('name')
			<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
		@enderror
	</div>

	<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
		<div>
			<label for="objective" class="block text-sm font-medium text-slate-700">Objective</label>
			<select
				name="objective"
				id="objective"
				class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
				required
			>
				@foreach($objectives as $value => $label)
					<option value="{{ $value }}" @selected(old('objective', $campaign->objective) === $value)>{{ $label }}</option>
				@endforeach
			</select>
			@error('objective')
				<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
			@enderror
		</div>

		@if ($campaign->exists)
			<div>
				<label for="status" class="block text-sm font-medium text-slate-700">Status</label>
				<select
					name="status"
					id="status"
					class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
				>
					@foreach(\App\Models\AdvertisingCampaign::STATUSES as $status)
						<option value="{{ $status }}" @selected(old('status', $campaign->status) === $status)>
							{{ ucfirst(str_replace('_', ' ', $status)) }}
						</option>
					@endforeach
				</select>
				@error('status')
					<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
				@enderror
			</div>
		@endif

		<div>
			<label for="daily_budget" class="block text-sm font-medium text-slate-700">Daily budget</label>
			<input
				type="number"
				step="0.01"
				name="daily_budget"
				id="daily_budget"
				value="{{ old('daily_budget', $campaign->daily_budget) }}"
				class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
			>
			@error('daily_budget')
				<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
			@enderror
		</div>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
		<div>
			<label for="lifetime_budget" class="block text-sm font-medium text-slate-700">Lifetime budget</label>
			<input
				type="number"
				step="0.01"
				name="lifetime_budget"
				id="lifetime_budget"
				value="{{ old('lifetime_budget', $campaign->lifetime_budget) }}"
				class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
			>
			@error('lifetime_budget')
				<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
			@enderror
		</div>
		<div>
			<label for="starts_at" class="block text-sm font-medium text-slate-700">Start date</label>
			<input
				type="date"
				name="starts_at"
				id="starts_at"
				value="{{ $startsAt }}"
				class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
			>
			@error('starts_at')
				<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
			@enderror
		</div>
		<div>
			<label for="ends_at" class="block text-sm font-medium text-slate-700">End date</label>
			<input
				type="date"
				name="ends_at"
				id="ends_at"
				value="{{ $endsAt }}"
				class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
			>
			@error('ends_at')
				<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
			@enderror
		</div>
	</div>

	<div>
		<label for="creative_brief" class="block text-sm font-medium text-slate-700">Creative brief</label>
		<textarea
			name="creative_brief"
			id="creative_brief"
			rows="4"
			class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
			placeholder="Key messaging, positioning, and creative notes"
		>{{ old('creative_brief', $campaign->creative_brief) }}</textarea>
		@error('creative_brief')
			<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
		@enderror
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<div class="space-y-4">
			<div>
				<h2 class="text-sm font-semibold text-slate-700">Targeting</h2>
				<p class="text-xs text-slate-500">Comma or line separated values will be stored as structured filters.</p>
			</div>
			<div>
				<label for="targeting_locations" class="block text-sm font-medium text-slate-700">Locations</label>
				<textarea
					name="targeting[locations]"
					id="targeting_locations"
					rows="2"
					class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
				>{{ $targeting['locations'] ?? '' }}</textarea>
				@error('targeting.locations')
					<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
				@enderror
			</div>
			<div>
				<label for="targeting_keywords" class="block text-sm font-medium text-slate-700">Keywords</label>
				<textarea
					name="targeting[keywords]"
					id="targeting_keywords"
					rows="2"
					class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
				>{{ $targeting['keywords'] ?? '' }}</textarea>
				@error('targeting.keywords')
					<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
				@enderror
			</div>
			<div>
				<label for="targeting_seniority" class="block text-sm font-medium text-slate-700">Seniority levels</label>
				<textarea
					name="targeting[seniority_levels]"
					id="targeting_seniority"
					rows="2"
					class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
				>{{ $targeting['seniority_levels'] ?? '' }}</textarea>
				@error('targeting.seniority_levels')
					<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
				@enderror
			</div>
			<div>
				<label for="targeting_notes" class="block text-sm font-medium text-slate-700">Notes</label>
				<textarea
					name="targeting[notes]"
					id="targeting_notes"
					rows="3"
					class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
				>{{ $targeting['notes'] ?? '' }}</textarea>
				@error('targeting.notes')
					<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
				@enderror
			</div>
		</div>

		<div class="space-y-4">
			<div>
				<h2 class="text-sm font-semibold text-slate-700">Tracking parameters</h2>
				<p class="text-xs text-slate-500">Optional UTM values for downstream analytics.</p>
			</div>
			<div class="grid grid-cols-1 gap-4">
				<div>
					<label for="utm_source" class="block text-sm font-medium text-slate-700">UTM source</label>
					<input
						type="text"
						name="tracking_parameters[utm_source]"
						id="utm_source"
						value="{{ $tracking['utm_source'] ?? '' }}"
						class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
					>
					@error('tracking_parameters.utm_source')
						<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
					@enderror
				</div>
				<div>
					<label for="utm_medium" class="block text-sm font-medium text-slate-700">UTM medium</label>
					<input
						type="text"
						name="tracking_parameters[utm_medium]"
						id="utm_medium"
						value="{{ $tracking['utm_medium'] ?? '' }}"
						class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
					>
					@error('tracking_parameters.utm_medium')
						<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
					@enderror
				</div>
				<div>
					<label for="utm_campaign" class="block text-sm font-medium text-slate-700">UTM campaign</label>
					<input
						type="text"
						name="tracking_parameters[utm_campaign]"
						id="utm_campaign"
						value="{{ $tracking['utm_campaign'] ?? '' }}"
						class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
					>
					@error('tracking_parameters.utm_campaign')
						<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
					@enderror
				</div>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label for="utm_term" class="block text-sm font-medium text-slate-700">UTM term</label>
						<input
							type="text"
							name="tracking_parameters[utm_term]"
							id="utm_term"
							value="{{ $tracking['utm_term'] ?? '' }}"
							class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
						>
						@error('tracking_parameters.utm_term')
							<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
						@enderror
					</div>
					<div>
						<label for="utm_content" class="block text-sm font-medium text-slate-700">UTM content</label>
						<input
							type="text"
							name="tracking_parameters[utm_content]"
							id="utm_content"
							value="{{ $tracking['utm_content'] ?? '' }}"
							class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
						>
						@error('tracking_parameters.utm_content')
							<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
						@enderror
					</div>
				</div>
			</div>

			<div>
				<label for="audience_segments" class="block text-sm font-medium text-slate-700">Audience segments</label>
				<select
					name="audience_segments[]"
					id="audience_segments"
					multiple
					class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm h-40 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
				>
					@foreach($segments as $segment)
						<option value="{{ $segment->id }}" @selected(in_array($segment->id, $selectedSegments, true))>
							{{ $segment->name }}
						</option>
					@endforeach
				</select>
				<p class="mt-1 text-xs text-slate-500">Hold Ctrl/Cmd to select multiple segments. Segments determine who sees this campaign.</p>
				@error('audience_segments')
					<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
				@enderror
			</div>
		</div>
	</div>

	<div class="flex items-center justify-end gap-3">
		<a href="{{ route('company.advertising.campaigns.index') }}" class="text-sm text-slate-500 hover:text-slate-700">Cancel</a>
		<button type="submit" class="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded hover:bg-brand-700">
			{{ $submitLabel ?? ($campaign->exists ? 'Save changes' : 'Create campaign') }}
		</button>
	</div>
</div>
