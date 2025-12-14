<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
    <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
            <p class="text-xs font-semibold tracking-[0.35em] text-pink-500 uppercase">Legal document lab</p>
            <h1 class="text-3xl font-bold text-slate-900">Craft governance packs with Athena</h1>
            <p class="text-sm text-slate-500">Wizarded steps, grant-funded packs, and auditable AI previews held in secure storage.</p>
        </div>
        <div class="text-sm text-slate-500">
            <p class="font-semibold text-slate-900">{{ count($savedDocuments) }} saved drafts</p>
            <p>{{ $disclaimer }}</p>
        </div>
    </header>

    <section class="grid gap-8 lg:grid-cols-4">
        <div class="space-y-4 rounded-3xl border border-slate-100 bg-white/90 p-5 shadow-sm lg:col-span-1">
            <h2 class="text-xs uppercase tracking-[0.35em] text-slate-500 font-semibold">Select document</h2>
            <div class="space-y-3">
                @foreach($documents as $key => $document)
                    <button type="button"
                        wire:click="selectDocument('{{ $key }}')"
                        class="w-full text-left rounded-2xl border p-4 transition"
                        @class([
                            'border-emerald-200 bg-emerald-50/70 shadow-inner' => $selectedDocument === $key,
                            'border-slate-100 hover:border-emerald-200' => $selectedDocument !== $key,
                        ])>
                        <p class="text-xs uppercase tracking-[0.35em] text-slate-500 font-semibold">{{ $document['label'] }}</p>
                        <p class="mt-1 text-sm text-slate-500">{{ $document['description'] }}</p>
                        <p class="mt-2 text-[0.65rem] uppercase tracking-[0.4em] text-slate-400">{{ implode(', ', $document['export_formats']) }}</p>
                    </button>
                @endforeach
            </div>

            <div class="pt-4 space-y-2">
                <div class="flex items-center justify-between gap-2">
                    <h3 class="text-xs uppercase tracking-[0.35em] text-slate-500 font-semibold">Grant packs</h3>
                    <button type="button"
                        wire:click="refreshGrantPacks"
                        class="rounded-full border border-slate-200 px-3 py-1 text-[0.65rem] font-semibold text-slate-500 hover:border-emerald-200 hover:text-emerald-600">
                        Sync now
                    </button>
                </div>
                @if($grantPackAutoUpdateEnabled)
                    <p class="text-[0.65rem] uppercase tracking-[0.35em] text-slate-400">
                        Auto-updates hourly @ {{ $grantPackSyncMeta['synced_at'] ? \Illuminate\Support\Carbon::parse($grantPackSyncMeta['synced_at'])->diffForHumans() : 'pending' }}
                    </p>
                @endif
                <div class="space-y-2">
                    @foreach($grantPacks as $slug => $pack)
                        <button type="button"
                            wire:click="selectGrantPack('{{ $slug }}')"
                            class="w-full rounded-2xl border p-3 text-left text-sm"
                            @class([
                                'border-indigo-200 bg-indigo-50/80 shadow-inner' => $selectedGrantPack === $slug,
                                'border-slate-100 hover:border-indigo-200' => $selectedGrantPack !== $slug,
                            ])>
                            <p class="font-semibold text-slate-900">{{ $pack['name'] }}</p>
                            <p class="text-xs text-slate-500">{{ $pack['summary'] }}</p>
                            <p class="mt-1 text-[0.65rem] uppercase tracking-[0.4em] text-indigo-500">{{ count($pack['documents']) }} docs</p>
                        </button>
                    @endforeach
                </div>
                @if($selectedGrantPack && count($grantPackAssets))
                    <div class="rounded-2xl border border-indigo-50 bg-indigo-50/60 p-3 space-y-3">
                        <p class="text-[0.65rem] uppercase tracking-[0.35em] text-indigo-500 font-semibold">Included assets</p>
                        <div class="space-y-3">
                            @foreach($grantPackAssets as $asset)
                                <details class="rounded-xl border border-indigo-100 bg-white/80 p-3" @if($loop->first) open @endif>
                                    <summary class="flex items-center justify-between text-sm font-semibold text-slate-800 cursor-pointer">
                                        <span>{{ $asset['label'] }}</span>
                                        <span class="text-[0.65rem] uppercase tracking-[0.35em] text-slate-400">{{ strtoupper($asset['type']) }}</span>
                                    </summary>
                                    <div class="mt-3 space-y-2 text-xs text-slate-600">
                                        @if(!empty($asset['description']))
                                            <p>{{ $asset['description'] }}</p>
                                        @endif
                                        <div class="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
                                            @php($markdown = \Illuminate\Support\Str::markdown($asset['content'] ?? ''))
                                            {!! $markdown !!}
                                        </div>
                                        <p class="text-[0.6rem] uppercase tracking-[0.35em] text-slate-400">
                                            {{ $asset['filename'] }} · {{ $asset['updated_at'] ? \Illuminate\Support\Carbon::parse($asset['updated_at'])->diffForHumans() : 'draft' }}
                                        </p>
                                    </div>
                                </details>
                            @endforeach
                        </div>
                    </div>
                @elseif($selectedGrantPack)
                    <p class="text-[0.65rem] text-slate-400">No local assets found for this pack yet.</p>
                @endif
            </div>

            <div class="pt-4">
                <h3 class="text-xs uppercase tracking-[0.35em] text-slate-500 font-semibold">Saved drafts</h3>
                <div class="mt-3 space-y-2 max-h-60 overflow-y-auto pr-1">
                    @forelse($savedDocuments as $draft)
                        <div class="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-600">
                            <p class="font-semibold text-slate-900 uppercase tracking-[0.3em]">{{ str_replace('_', ' ', $draft['document_type']) }}</p>
                            <p>Version {{ $draft['version'] }} · {{ \Illuminate\Support\Carbon::parse($draft['updated_at'])->diffForHumans() }}</p>
                            <div class="mt-2 flex flex-wrap gap-2">
                                <button type="button" wire:click="hydrateExisting({{ $draft['id'] }})" class="rounded-full border border-slate-200 px-3 py-1 text-[0.7rem] font-semibold text-slate-600">Load</button>
                                <a href="{{ route('business.legal-documents.download', [$draft['id'], 'pdf']) }}" class="rounded-full border border-emerald-200 px-3 py-1 text-[0.7rem] font-semibold text-emerald-600">PDF</a>
                                <a href="{{ route('business.legal-documents.download', [$draft['id'], 'docx']) }}" class="rounded-full border border-indigo-200 px-3 py-1 text-[0.7rem] font-semibold text-indigo-600">DOCX</a>
                            </div>
                        </div>
                    @empty
                        <p class="text-xs text-slate-400">No drafts yet.</p>
                    @endforelse
                </div>
            </div>
        </div>

        <div class="lg:col-span-3 space-y-6">
            <section class="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm space-y-5">
                <header class="flex flex-col gap-2">
                    <p class="text-xs uppercase tracking-[0.35em] text-indigo-500 font-semibold">Wizard</p>
                    <h2 class="text-xl font-semibold text-slate-900">{{ $documents[$selectedDocument]['label'] ?? 'Document' }}</h2>
                    <p class="text-sm text-slate-500">Complete the steps below. Fields adapt based on grant pack overlays.</p>
                </header>

                <div class="flex flex-wrap gap-2">
                    @foreach($wizardSteps as $step)
                        <button type="button" wire:click="goToStep('{{ $step['key'] }}')"
                            class="rounded-full border px-3 py-1 text-xs font-semibold"
                            @class([
                                'border-emerald-300 bg-emerald-50/80 text-emerald-700' => $currentStep === $step['key'],
                                'border-slate-200 text-slate-500 hover:border-emerald-200' => $currentStep !== $step['key'],
                            ])>
                            {{ $step['label'] }}
                        </button>
                    @endforeach
                </div>

                @foreach($wizardSteps as $step)
                    <div @class(['space-y-4', 'hidden' => $currentStep !== $step['key']])>
                        <div>
                            <p class="text-xs uppercase tracking-[0.35em] text-slate-400 font-semibold">{{ $step['label'] }}</p>
                            <p class="text-sm text-slate-500">{{ $step['caption'] ?? '' }}</p>
                        </div>
                        <div class="grid gap-4 md:grid-cols-2">
                            @foreach($step['fields'] as $field)
                                <div class="flex flex-col gap-2">
                                    <label class="text-sm font-semibold text-slate-700">{{ $field['label'] }}</label>
                                    @php($model = 'formData.'.$field['key'])
                                    @switch($field['type'])
                                        @case('textarea')
                                            <textarea wire:model.defer="{{ $model }}" rows="3" class="rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-pink-400 focus:ring-pink-200" placeholder="{{ $field['placeholder'] ?? '' }}"></textarea>
                                            @break
                                        @case('select')
                                            <select wire:model="{{ $model }}" class="rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-pink-400 focus:ring-pink-200">
                                                <option value="">Select</option>
                                                @foreach($field['options'] ?? [] as $option)
                                                    <option value="{{ $option }}">{{ $option }}</option>
                                                @endforeach
                                            </select>
                                            @break
                                        @default
                                            <input type="{{ $field['type'] === 'number' ? 'number' : 'text' }}"
                                                wire:model.defer="{{ $model }}"
                                                class="rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-pink-400 focus:ring-pink-200"
                                                placeholder="{{ $field['placeholder'] ?? '' }}">
                                    @endswitch
                                    @error($model)
                                        <p class="text-xs text-rose-600">{{ $message }}</p>
                                    @enderror
                                </div>
                            @endforeach
                        </div>
                    </div>
                @endforeach

                <div class="flex flex-wrap gap-3 pt-4">
                    <button type="button" wire:click="generatePreview" class="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500">
                        Refresh preview
                    </button>
                    <button type="button" wire:click="saveDraft" class="inline-flex items-center gap-2 rounded-full border border-emerald-300 px-5 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
                        Save draft to vault
                    </button>
                    @if($aiEntryUrl)
                        <a href="{{ $aiEntryUrl }}" class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Launch Athena AI</a>
                    @endif
                    @if($statusMessage)
                        <p class="text-xs text-slate-400">{{ $statusMessage }}</p>
                    @endif
                </div>
            </section>

            <section class="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm space-y-4">
                <header class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p class="text-xs uppercase tracking-[0.35em] text-emerald-500 font-semibold">Preview</p>
                        <h2 class="text-xl font-semibold text-slate-900">Live document render</h2>
                    </div>
                    @if($activeDocumentId)
                        <div class="flex gap-2 text-xs">
                            <a href="{{ route('business.legal-documents.download', [$activeDocumentId, 'pdf']) }}" class="rounded-full border border-emerald-200 px-3 py-1 font-semibold text-emerald-600">Download PDF</a>
                            <a href="{{ route('business.legal-documents.download', [$activeDocumentId, 'docx']) }}" class="rounded-full border border-indigo-200 px-3 py-1 font-semibold text-indigo-600">Download DOCX</a>
                        </div>
                    @endif
                </header>
                <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4 max-h-[600px] overflow-y-auto">
                    @if($previewHtml)
                        {!! $previewHtml !!}
                    @else
                        <p class="text-sm text-slate-500">Generate a preview to see the constitution, memorandum, AoA, or shareholder agreement appear here.</p>
                    @endif
                </div>
                <div class="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs text-amber-700">
                    <p class="font-semibold">Compliance notice</p>
                    <p>{{ $disclaimer }}</p>
                </div>
            </section>
        </div>
    </section>
</div>
