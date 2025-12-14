<div class="space-y-4">
    <div class="rounded-2xl border border-dashed border-rose-200 bg-rose-50/60 p-4">
        <label for="realEstateMediaUploads" class="flex flex-col items-center gap-2 text-center cursor-pointer">
            <input id="realEstateMediaUploads" type="file" class="sr-only" wire:model="uploads" multiple accept="image/*,video/mp4,video/quicktime">
            <span class="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-rose-500">
                <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4" />
                </svg>
            </span>
            <span class="text-sm font-semibold text-rose-700">Drag & drop or click to upload</span>
            <span class="text-xs text-rose-500">Images (JPG, PNG, WebP) or videos (MP4, MOV) up to 50 MB.</span>
        </label>
    </div>

    <div class="flex flex-wrap items-center gap-3 text-xs">
        <span class="font-semibold text-slate-500">Default visibility</span>
        @foreach ($visibilityOptions as $value => $label)
            <button
                type="button"
                wire:click="$set('visibility','{{ $value }}')"
                @class([
                    'rounded-full border px-3 py-1 transition',
                    'border-rose-500 bg-rose-50 text-rose-600 shadow-sm' => $visibility === $value,
                    'border-slate-200 text-slate-600 hover:border-rose-300' => $visibility !== $value,
                ])
            >
                {{ $label }}
            </button>
        @endforeach
    </div>

    @error('uploads.*')
        <p class="text-xs font-semibold text-rose-600">{{ $message }}</p>
    @enderror

    @error('visibility')
        <p class="text-xs font-semibold text-rose-600">{{ $message }}</p>
    @enderror

    @if (session()->has('mediaUploaded'))
        <p class="text-xs font-semibold text-emerald-600">{{ session('mediaUploaded') }}</p>
    @endif
    @if (session()->has('mediaDeleted'))
        <p class="text-xs font-semibold text-emerald-600">{{ session('mediaDeleted') }}</p>
    @endif

    <p class="text-xs text-slate-500" wire:loading wire:target="uploads">Uploading media…</p>

    <div class="grid gap-4 sm:grid-cols-2">
        @forelse ($media as $item)
            <div class="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div class="relative overflow-hidden rounded-xl">
                    @if ($item['media_type'] === 'video')
                        <video class="h-40 w-full rounded-xl object-cover" controls>
                            <source src="{{ $item['url'] }}" type="video/mp4">
                        </video>
                    @else
                        <img src="{{ $item['url'] }}" alt="Uploaded media" class="h-40 w-full rounded-xl object-cover">
                    @endif
                    <button
                        type="button"
                        wire:click="deleteMedia({{ $item['id'] }})"
                        class="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-rose-600 shadow"
                    >
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div class="mt-3 text-xs text-slate-600">
                    <p class="font-semibold text-slate-900 capitalize">{{ $item['media_type'] }}</p>
                    <p>{{ $item['created_at'] }}</p>
                    <p class="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-500">{{ $item['visibility'] }}</p>
                </div>
            </div>
        @empty
            <p class="text-sm text-slate-500">No media yet. Add a few visuals to power your listings and social posts.</p>
        @endforelse
    </div>
</div>
