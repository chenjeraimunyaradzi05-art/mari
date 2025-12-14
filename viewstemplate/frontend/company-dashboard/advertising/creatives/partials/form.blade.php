<div class="space-y-8">
	<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
		<div>
			<label for="name" class="block text-sm font-medium text-slate-700">Creative name</label>
			<input
				type="text"
				id="name"
				name="name"
				value="{{ old('name', $creative->name) }}"
				class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
				required
			/>
			@error('name')
				<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
			@enderror
		</div>

		<div>
			<label for="format" class="block text-sm font-medium text-slate-700">Format</label>
			<select
				id="format"
				name="format"
				class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
				required
			>
				@foreach ($formats as $value => $label)
					<option value="{{ $value }}" @selected(old('format', $creative->format) === $value)>{{ $label }}</option>
				@endforeach
			</select>
			@error('format')
				<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
			@enderror
		</div>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
		<div>
			<label for="status" class="block text-sm font-medium text-slate-700">Delivery status</label>
			<select
				id="status"
				name="status"
				class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
				required
			>
				@foreach ($statuses as $status)
					<option value="{{ $status }}" @selected(old('status', $creative->status) === $status)>{{ ucfirst(str_replace('_', ' ', $status)) }}</option>
				@endforeach
			</select>
			@error('status')
				<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
			@enderror
		</div>

		<div>
			<label for="review_status" class="block text-sm font-medium text-slate-700">Review status</label>
			<select
				id="review_status"
				name="review_status"
				class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
			>
				@foreach ($reviewStatuses as $status)
					<option value="{{ $status }}" @selected(old('review_status', $creative->review_status) === $status)>{{ ucfirst(str_replace('_', ' ', $status)) }}</option>
				@endforeach
			</select>
			@error('review_status')
				<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
			@enderror
		</div>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
		<div>
			<label for="headline" class="block text-sm font-medium text-slate-700">Headline</label>
			<input
				type="text"
				id="headline"
				name="headline"
				value="{{ old('headline', $creative->headline) }}"
				class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
			/>
			@error('headline')
				<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
			@enderror
		</div>

		<div>
			<label for="cta_label" class="block text-sm font-medium text-slate-700">Call to action label</label>
			<input
				type="text"
				id="cta_label"
				name="cta_label"
				value="{{ old('cta_label', $creative->cta_label) }}"
				class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
			/>
			@error('cta_label')
				<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
			@enderror
		</div>
	</div>

	<div>
		<label for="primary_text" class="block text-sm font-medium text-slate-700">Primary message</label>
		<textarea
			id="primary_text"
			name="primary_text"
			rows="4"
			class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
		>{{ old('primary_text', $creative->primary_text) }}</textarea>
		@error('primary_text')
			<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
		@enderror
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
		<div>
			<label for="destination_url" class="block text-sm font-medium text-slate-700">Destination URL</label>
			<input
				type="url"
				id="destination_url"
				name="destination_url"
				value="{{ old('destination_url', $creative->destination_url) }}"
				class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
			/>
			@error('destination_url')
				<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
			@enderror
		</div>

		<div>
			<label for="preview_image_url" class="block text-sm font-medium text-slate-700">Preview image URL</label>
			<input
				type="url"
				id="preview_image_url"
				name="preview_image_url"
				value="{{ old('preview_image_url', $creative->preview_image_url) }}"
				class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
			/>
			@error('preview_image_url')
				<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
			@enderror
		</div>
	</div>

	<div>
		<label for="preview_video_url" class="block text-sm font-medium text-slate-700">Preview video URL</label>
		<input
			type="url"
			id="preview_video_url"
			name="preview_video_url"
			value="{{ old('preview_video_url', $creative->preview_video_url) }}"
			class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
		/>
		@error('preview_video_url')
			<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
		@enderror
	</div>

	<div>
		<label for="notes" class="block text-sm font-medium text-slate-700">Internal notes</label>
		<textarea
			id="notes"
			name="notes"
			rows="3"
			class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
		>{{ old('notes', $creative->notes) }}</textarea>
		@error('notes')
			<p class="mt-1 text-xs text-red-600">{{ $message }}</p>
		@enderror
	</div>

	<div class="flex items-center justify-end gap-3">
		<a href="{{ route('company.advertising.campaigns.show', $campaign) }}" class="inline-flex items-center px-3 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded hover:bg-slate-50">Cancel</a>
		<button type="submit" class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-brand-600 rounded hover:bg-brand-700">{{ $submitLabel }}</button>
	</div>
</div>
