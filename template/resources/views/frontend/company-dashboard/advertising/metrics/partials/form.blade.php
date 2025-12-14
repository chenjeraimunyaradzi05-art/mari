<div class="space-y-6">
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
		<div>
			<label for="recorded_at" class="block text-sm font-medium text-slate-700">Date</label>
			<input
				type="date"
				id="recorded_at"
				name="recorded_at"
				value="{{ old('recorded_at', optional($metric->recorded_at)->format('Y-m-d')) }}"
				class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
				required
			/>
			@error('recorded_at')
				<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
			@enderror
		</div>

		<div>
			<label for="impressions" class="block text-sm font-medium text-slate-700">Impressions</label>
			<input
				type="number"
				id="impressions"
				name="impressions"
				value="{{ old('impressions', $metric->impressions) }}"
				min="0"
				class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
				required
			/>
			@error('impressions')
				<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
			@enderror
		</div>

		<div>
			<label for="clicks" class="block text-sm font-medium text-slate-700">Clicks</label>
			<input
				type="number"
				id="clicks"
				name="clicks"
				value="{{ old('clicks', $metric->clicks) }}"
				min="0"
				class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
				required
			/>
			@error('clicks')
				<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
			@enderror
		</div>

		<div>
			<label for="conversions" class="block text-sm font-medium text-slate-700">Conversions</label>
			<input
				type="number"
				id="conversions"
				name="conversions"
				value="{{ old('conversions', $metric->conversions) }}"
				min="0"
				class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
			/>
			@error('conversions')
				<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
			@enderror
		</div>

		<div>
			<label for="qualified_leads" class="block text-sm font-medium text-slate-700">Qualified leads</label>
			<input
				type="number"
				id="qualified_leads"
				name="qualified_leads"
				value="{{ old('qualified_leads', $metric->qualified_leads) }}"
				min="0"
				class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
			/>
			@error('qualified_leads')
				<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
			@enderror
		</div>

		<div>
			<label for="spend" class="block text-sm font-medium text-slate-700">Spend ($)</label>
			<input
				type="number"
				step="0.01"
				min="0"
				id="spend"
				name="spend"
				value="{{ old('spend', $metric->spend ?? null) }}"
				class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
			/>
			@error('spend')
				<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
			@enderror
		</div>

		<div>
			<label for="pipeline_value" class="block text-sm font-medium text-slate-700">Pipeline value ($)</label>
			<input
				type="number"
				step="0.01"
				min="0"
				id="pipeline_value"
				name="pipeline_value"
				value="{{ old('pipeline_value', $metric->pipeline_value) }}"
				class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
			/>
			@error('pipeline_value')
				<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
			@enderror
		</div>
	</div>

	<div>
		<label for="notes" class="block text-sm font-medium text-slate-700">Internal notes</label>
		<textarea
			id="notes"
			name="notes"
			rows="3"
			class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
		>{{ old('notes', is_array($metric->notes) ? ($metric->notes['summary'] ?? null) : $metric->notes) }}</textarea>
		@error('notes')
			<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
		@enderror
	</div>

	<div class="flex items-center justify-end gap-3">
		<a href="{{ route('company.advertising.campaigns.metrics.index', $campaign) }}" class="inline-flex items-center px-3 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded hover:bg-slate-50">Cancel</a>
		<button type="submit" class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-brand-600 rounded hover:bg-brand-700">{{ $submitLabel }}</button>
	</div>
</div>
