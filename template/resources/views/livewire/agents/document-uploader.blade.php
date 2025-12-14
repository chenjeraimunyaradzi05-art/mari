<div class="space-y-3" wire:key="document-uploader-{{ $field }}">
    <div class="flex items-start justify-between gap-3">
        <div>
            <p class="text-sm font-medium text-gray-800">{{ $label }}</p>
            @if ($description)
                <p class="text-xs text-gray-500 mt-1">{{ $description }}</p>
            @endif
            <p class="text-xs text-gray-400 mt-1">Accepted: {{ empty($accepted) ? 'PDF, JPG, PNG' : strtoupper(implode(', ', $accepted)) }} · Max 10MB</p>
        </div>
        @if ($document)
            <button type="button" class="text-sm text-rose-600 hover:text-rose-700" wire:click="removeExisting" wire:loading.attr="disabled">
                Remove
            </button>
        @endif
    </div>

    @if ($document)
        <div class="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <div class="flex items-center gap-3">
                <span class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-emerald-500">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 13.5l3 3m0 0l3-3m-3 3V6m-3 3h-.75A2.25 2.25 0 016 6.75v-0A2.25 2.25 0 018.25 4.5h7.5A2.25 2.25 0 0118 6.75v10.5A2.25 2.25 0 0115.75 19.5h-7.5A2.25 2.25 0 016 17.25V9" />
                    </svg>
                </span>
                <div>
                    <p class="font-medium">{{ $document['original_name'] ?? 'Uploaded document' }}</p>
                    @php
                        $uploadedAt = \Illuminate\Support\Carbon::make($document['uploaded_at'] ?? null);
                    @endphp
                    @if ($uploadedAt)
                        <p class="text-xs text-emerald-600">Uploaded {{ $uploadedAt->diffForHumans() }}</p>
                    @endif
                </div>
            </div>
        </div>
    @endif

    @php
        $acceptAttribute = null;
        if (! empty($accepted)) {
            $acceptAttribute = collect($accepted)
                ->map(static function ($type) {
                    return match (strtolower($type)) {
                        'pdf' => 'application/pdf',
                        'jpg', 'jpeg' => 'image/jpeg',
                        'png' => 'image/png',
                        default => $type,
                    };
                })
                ->unique()
                ->implode(',');
        }
    @endphp

    <div>
        <input type="file" wire:model="file" @if ($acceptAttribute) accept="{{ $acceptAttribute }}" @endif class="block w-full text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-rose-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-rose-600 hover:file:bg-rose-200" />
        @error('file')
            <p class="mt-2 text-sm text-rose-600">{{ $message }}</p>
        @enderror
        @if ($errorMessage)
            <p class="mt-2 text-sm text-rose-600">{{ $errorMessage }}</p>
        @endif
        <p class="mt-2 text-xs text-gray-400" wire:loading wire:target="file">Uploading…</p>
    </div>
</div>
