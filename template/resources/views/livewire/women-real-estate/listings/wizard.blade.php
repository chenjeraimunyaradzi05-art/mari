<div class="space-y-6" wire:key="women-listing-wizard">
    @if ($statusMessage)
        <div class="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <span class="mt-0.5 text-emerald-500">
                <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.172 7.707 8.879a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
            </span>
            <div>
                <p class="font-semibold">Update saved</p>
                <p>{{ $statusMessage }}</p>
            </div>
        </div>
    @endif

    @error('basics')
        <div class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {{ $message }}
        </div>
    @enderror

    <div class="rounded-2xl bg-white shadow">
        <header class="border-b border-slate-100 px-6 py-4">
            <nav class="flex flex-wrap items-center gap-3">
                @foreach ($steps as $index => $stepKey)
                    @php
                        $isActive = $step === $stepKey;
                        $isComplete = array_search($step, $steps, true) > $index;
                        $label = $stepLabels[$stepKey] ?? ucfirst($stepKey);
                    @endphp
                    <button
                        type="button"
                        wire:click="goToStep('{{ $stepKey }}')"
                        class="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-400 {{ $isActive ? 'bg-indigo-50 text-indigo-600' : ($isComplete ? 'text-emerald-600 hover:text-emerald-700' : 'text-slate-500 hover:text-slate-600') }}"
                    >
                        <span class="flex h-7 w-7 items-center justify-center rounded-full border {{ $isActive ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : ($isComplete ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-slate-200 text-slate-500') }}">
                            {{ $index + 1 }}
                        </span>
                        <span>{{ $label }}</span>
                    </button>
                @endforeach
            </nav>
        </header>

        <div class="px-6 py-6">
            @if ($step === 'basics')
                <form wire:submit.prevent="saveBasics" class="space-y-6">
                    <section class="space-y-4">
                        <header>
                            <h2 class="text-lg font-semibold text-slate-900">Core listing details</h2>
                            <p class="text-sm text-slate-500">We use these details to shape audience targeting, AI insights, and social previews.</p>
                        </header>

                        <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <div class="md:col-span-2">
                                <label for="listing_title" class="block text-sm font-medium text-slate-700">Title<span class="text-rose-500">*</span></label>
                                <input id="listing_title" type="text" class="form-input mt-1 w-full" wire:model.defer="basics.title" autocomplete="off" />
                                @error('basics.title')
                                    <p class="mt-1 text-sm text-rose-600">{{ $message }}</p>
                                @enderror
                            </div>
                            <div class="md:col-span-2">
                                <label for="listing_summary" class="block text-sm font-medium text-slate-700">Summary<span class="text-rose-500">*</span></label>
                                <textarea id="listing_summary" rows="3" class="form-textarea mt-1 w-full" wire:model.defer="basics.summary" placeholder="Position the opportunity in a few compelling sentences."></textarea>
                                @error('basics.summary')
                                    <p class="mt-1 text-sm text-rose-600">{{ $message }}</p>
                                @enderror
                            </div>
                            <div class="md:col-span-2">
                                <label for="listing_description" class="block text-sm font-medium text-slate-700">Full description</label>
                                <textarea id="listing_description" rows="6" class="form-textarea mt-1 w-full" wire:model.defer="basics.description" placeholder="Highlight safety, amenities, nearby women-first services, and partnership possibilities."></textarea>
                                @error('basics.description')
                                    <p class="mt-1 text-sm text-rose-600">{{ $message }}</p>
                                @enderror
                            </div>
                        </div>

                        <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <div>
                                <label class="block text-sm font-medium text-slate-700">Listing intent<span class="text-rose-500">*</span></label>
                                <select class="form-select mt-1 w-full" wire:model.defer="basics.intent">
                                    <option value="">Select intent</option>
                                    @foreach ($intentOptions as $intentValue)
                                        <option value="{{ $intentValue }}">{{ str($intentValue)->replace('_', ' ')->title() }}</option>
                                    @endforeach
                                </select>
                                @error('basics.intent')
                                    <p class="mt-1 text-sm text-rose-600">{{ $message }}</p>
                                @enderror
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-slate-700">Primary audience<span class="text-rose-500">*</span></label>
                                <select class="form-select mt-1 w-full" wire:model.defer="basics.primary_audience">
                                    <option value="">Select audience</option>
                                    @foreach ($audienceOptions as $audienceValue)
                                        <option value="{{ $audienceValue }}">{{ str($audienceValue)->replace('_', ' ')->title() }}</option>
                                    @endforeach
                                </select>
                                @error('basics.primary_audience')
                                    <p class="mt-1 text-sm text-rose-600">{{ $message }}</p>
                                @enderror
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-slate-700">Additional audiences</label>
                            <div class="mt-2 flex flex-wrap gap-3">
                                @foreach ($audienceOptions as $audienceValue)
                                    <label class="inline-flex items-center gap-2 text-sm text-slate-600">
                                        <input type="checkbox" value="{{ $audienceValue }}" wire:model.defer="basics.audience_overrides" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                        <span>{{ str($audienceValue)->replace('_', ' ')->title() }}</span>
                                    </label>
                                @endforeach
                            </div>
                            @error('basics.audience_overrides')
                                <p class="mt-1 text-sm text-rose-600">{{ $message }}</p>
                            @enderror
                        </div>

                        <div>
                            <label for="listing_features" class="block text-sm font-medium text-slate-700">Feature highlights</label>
                            <textarea id="listing_features" rows="4" class="form-textarea mt-1 w-full" wire:model.defer="basics.features_input" placeholder="Safe entry points\nLighting upgrades\nCommunity amenities"></textarea>
                            <p class="mt-1 text-xs text-slate-500">One per line — we feed this into AI insights and partner matching.</p>
                            @error('basics.features_input')
                                <p class="mt-1 text-sm text-rose-600">{{ $message }}</p>
                            @enderror
                        </div>

                        <div class="grid grid-cols-1 gap-5 md:grid-cols-4">
                            <div>
                                <label class="block text-sm font-medium text-slate-700">Bedrooms</label>
                                <input type="number" min="0" max="12" class="form-input mt-1 w-full" wire:model.defer="basics.bedrooms" />
                                @error('basics.bedrooms')
                                    <p class="mt-1 text-sm text-rose-600">{{ $message }}</p>
                                @enderror
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-slate-700">Bathrooms</label>
                                <input type="number" min="0" max="12" class="form-input mt-1 w-full" wire:model.defer="basics.bathrooms" />
                                @error('basics.bathrooms')
                                    <p class="mt-1 text-sm text-rose-600">{{ $message }}</p>
                                @enderror
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-slate-700">Car spaces</label>
                                <input type="number" min="0" max="10" class="form-input mt-1 w-full" wire:model.defer="basics.car_spaces" />
                                @error('basics.car_spaces')
                                    <p class="mt-1 text-sm text-rose-600">{{ $message }}</p>
                                @enderror
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-slate-700">AI safety cleared?</label>
                                <select class="form-select mt-1 w-full" wire:model.defer="basics.ai_safe">
                                    <option value="1">Yes</option>
                                    <option value="0">Flagged for review</option>
                                </select>
                                @error('basics.ai_safe')
                                    <p class="mt-1 text-sm text-rose-600">{{ $message }}</p>
                                @enderror
                            </div>
                        </div>

                        <div class="grid grid-cols-1 gap-5 md:grid-cols-4">
                            <div class="md:col-span-2">
                                <label class="block text-sm font-medium text-slate-700">Price</label>
                                <input type="number" min="0" step="0.01" class="form-input mt-1 w-full" wire:model.defer="basics.price" placeholder="0.00" />
                                @error('basics.price')
                                    <p class="mt-1 text-sm text-rose-600">{{ $message }}</p>
                                @enderror
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-slate-700">Frequency</label>
                                <select class="form-select mt-1 w-full" wire:model.defer="basics.price_frequency">
                                    <option value="">Select</option>
                                    @foreach ($priceFrequencyOptions as $frequency)
                                        <option value="{{ $frequency }}">{{ str($frequency)->replace('_', ' ')->title() }}</option>
                                    @endforeach
                                </select>
                                @error('basics.price_frequency')
                                    <p class="mt-1 text-sm text-rose-600">{{ $message }}</p>
                                @enderror
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-slate-700">Currency</label>
                                <select class="form-select mt-1 w-full" wire:model.defer="basics.currency">
                                    <option value="">Select</option>
                                    @foreach ($currencyOptions as $currency)
                                        <option value="{{ $currency }}">{{ $currency }}</option>
                                    @endforeach
                                </select>
                                @error('basics.currency')
                                    <p class="mt-1 text-sm text-rose-600">{{ $message }}</p>
                                @enderror
                            </div>
                        </div>

                        <div class="grid grid-cols-1 gap-5 md:grid-cols-3">
                            <div>
                                <label class="block text-sm font-medium text-slate-700">Agent ID</label>
                                <input type="number" class="form-input mt-1 w-full" wire:model.defer="basics.agent_id" />
                                <p class="mt-1 text-xs text-slate-500">Attach your verified agent (required to publish).</p>
                                @error('basics.agent_id')
                                    <p class="mt-1 text-sm text-rose-600">{{ $message }}</p>
                                @enderror
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-slate-700">Category ID</label>
                                <input type="number" class="form-input mt-1 w-full" wire:model.defer="basics.category_id" />
                                @error('basics.category_id')
                                    <p class="mt-1 text-sm text-rose-600">{{ $message }}</p>
                                @enderror
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-slate-700">Location ID</label>
                                <input type="number" class="form-input mt-1 w-full" wire:model.defer="basics.location_id" />
                                @error('basics.location_id')
                                    <p class="mt-1 text-sm text-rose-600">{{ $message }}</p>
                                @enderror
                            </div>
                        </div>

                        <div class="md:w-1/3">
                            <label class="block text-sm font-medium text-slate-700">Expires at</label>
                            <input type="date" class="form-input mt-1 w-full" wire:model.defer="basics.expires_at" />
                            @error('basics.expires_at')
                                <p class="mt-1 text-sm text-rose-600">{{ $message }}</p>
                            @enderror
                        </div>
                    </section>

                    <div class="flex flex-wrap items-center justify-between gap-3 pt-4">
                        <button type="button" wire:click="previous" class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300">
                            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 19l-7-7 7-7" />
                            </svg>
                            Back
                        </button>
                        <div class="flex flex-wrap items-center gap-3">
                            <button type="submit" class="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400" wire:loading.attr="disabled" wire:target="saveBasics">
                                <svg wire:loading wire:target="saveBasics" class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                                </svg>
                                Save basics
                            </button>
                            <button type="button" wire:click="next" class="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500">
                                Continue
                                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </form>
            @endif

            @if ($step === 'media')
                <div class="space-y-6">
                    <section class="space-y-4">
                        <header>
                            <h2 class="text-lg font-semibold text-slate-900">Media gallery</h2>
                            <p class="text-sm text-slate-500">Upload up to {{ config('women_real_estate.media.max_files_per_listing', 12) }} assets. The first item becomes the primary hero.</p>
                        </header>

                        <form wire:submit.prevent="uploadMedia" class="space-y-3">
                            <input type="file" multiple wire:model="mediaUploads" class="block w-full text-sm text-slate-600" />
                            @error('media_uploads')
                                <p class="text-sm text-rose-600">{{ $message }}</p>
                            @enderror
                            @error('mediaUploads.*')
                                <p class="text-sm text-rose-600">{{ $message }}</p>
                            @enderror

                            <div class="flex flex-wrap items-center gap-3">
                                <button type="submit" class="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300" wire:loading.attr="disabled" wire:target="uploadMedia,mediaUploads">
                                    <svg wire:loading wire:target="uploadMedia" class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                                    </svg>
                                    Upload media
                                </button>
                                <button type="button" wire:click="next" class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300">
                                    Skip for now
                                    <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </form>
                    </section>

                    @if ($media === [])
                        <div class="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
                            No media yet — upload imagery, floor plans, or investor briefs.
                        </div>
                    @else
                        <div class="grid gap-4 md:grid-cols-2">
                            @foreach ($media as $item)
                                <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                                    <div class="flex items-start justify-between gap-3">
                                        <div>
                                            <h3 class="text-sm font-semibold text-slate-700">#{{ $item['position'] }} · {{ str($item['type'])->title() }}</h3>
                                            <p class="text-xs text-slate-500">Media ID {{ $item['id'] }}</p>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <button type="button" wire:click="moveMedia({{ $item['id'] }}, 'up')" class="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-700" title="Move up">
                                                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 15l7-7 7 7" />
                                                </svg>
                                            </button>
                                            <button type="button" wire:click="moveMedia({{ $item['id'] }}, 'down')" class="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-700" title="Move down">
                                                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                            <button type="button" wire:click="removeMedia({{ $item['id'] }})" class="rounded-full border border-rose-200 p-2 text-rose-500 hover:bg-rose-50" title="Remove">
                                                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    <div class="mt-3 space-y-3">
                                        <label class="block text-xs font-medium text-slate-600">Caption</label>
                                        <textarea rows="2" class="form-textarea w-full" wire:model.defer="media.{{ $loop->index }}.caption" wire:change="updateMedia({{ $item['id'] }}, $event.target.value)"></textarea>
                                    </div>

                                    <p class="mt-3 text-xs text-slate-500">Path: <span class="font-mono">{{ $item['path'] }}</span></p>
                                </div>
                            @endforeach
                        </div>
                    @endif

                    <div class="flex items-center justify-between pt-4">
                        <button type="button" wire:click="previous" class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300">
                            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to basics
                        </button>
                        <button type="button" wire:click="next" class="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500">
                            Continue
                            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            @endif

            @if ($step === 'partnerships')
                <div class="space-y-6">
                    <section class="space-y-4">
                        <header>
                            <h2 class="text-lg font-semibold text-slate-900">Invite partner intents</h2>
                            <p class="text-sm text-slate-500">Bring co-buyers, developers, or investors into the flow. We track responses and escalate accepted intents into partner workspace journeys.</p>
                        </header>

                        <form wire:submit.prevent="createPartnerIntent" class="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <label class="block text-sm font-medium text-slate-700">Intent type<span class="text-rose-500">*</span></label>
                                    <select class="form-select mt-1 w-full" wire:model.defer="partnerForm.intent">
                                        @foreach ($partnerIntentOptions as $option)
                                            <option value="{{ $option }}">{{ str($option)->replace('_', ' ')->title() }}</option>
                                        @endforeach
                                    </select>
                                    @error('partnerForm.intent')
                                        <p class="mt-1 text-sm text-rose-600">{{ $message }}</p>
                                    @enderror
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-slate-700">Invitee user ID</label>
                                    <input type="number" class="form-input mt-1 w-full" wire:model.defer="partnerForm.invitee_id" placeholder="Optional" />
                                    <p class="mt-1 text-xs text-slate-500">We support direct user invites or open intents without an invitee.</p>
                                    @error('partnerForm.invitee_id')
                                        <p class="mt-1 text-sm text-rose-600">{{ $message }}</p>
                                    @enderror
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-slate-700">Message</label>
                                <textarea rows="3" class="form-textarea mt-1 w-full" wire:model.defer="partnerForm.message" placeholder="Share expectations, timelines, or due diligence notes."></textarea>
                                @error('partnerForm.message')
                                    <p class="mt-1 text-sm text-rose-600">{{ $message }}</p>
                                @enderror
                            </div>
                            <div class="md:w-1/3">
                                <label class="block text-sm font-medium text-slate-700">Expires at</label>
                                <input type="datetime-local" class="form-input mt-1 w-full" wire:model.defer="partnerForm.expires_at" />
                                @error('partnerForm.expires_at')
                                    <p class="mt-1 text-sm text-rose-600">{{ $message }}</p>
                                @enderror
                            </div>

                            <div class="flex items-center justify-end gap-3">
                                <button type="submit" class="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500">
                                    Send invite
                                </button>
                            </div>
                        </form>
                    </section>

                    <section class="space-y-3">
                        <header class="flex items-center justify-between">
                            <h3 class="text-sm font-semibold text-slate-700">Active partner intents</h3>
                            <span class="text-xs uppercase tracking-wide text-slate-400">{{ count($partnerIntents) }} total</span>
                        </header>

                        @if ($partnerIntents === [])
                            <div class="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
                                No partner intents yet. Invite collaborators to unlock shared projects and due diligence workflows.
                            </div>
                        @else
                            <div class="space-y-3">
                                @foreach ($partnerIntents as $intent)
                                    <article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                        <div class="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <p class="text-sm font-semibold text-slate-800">{{ str($intent['intent'])->replace('_', ' ')->title() }}</p>
                                                <p class="text-xs text-slate-500">Status: <span class="font-medium text-slate-700">{{ str($intent['status'])->replace('_', ' ')->title() }}</span></p>
                                            </div>
                                            <div class="flex flex-wrap items-center gap-2">
                                                @if (in_array($intent['status'], ['pending', 'draft'], true))
                                                    <button type="button" wire:click="respondToIntent({{ $intent['id'] }}, 'accepted')" class="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500">Accept</button>
                                                    <button type="button" wire:click="respondToIntent({{ $intent['id'] }}, 'declined')" class="rounded-full bg-rose-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-400">Decline</button>
                                                @endif
                                                @if (! in_array($intent['status'], ['withdrawn', 'declined'], true))
                                                    <button type="button" wire:click="cancelIntent({{ $intent['id'] }})" class="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300">Withdraw</button>
                                                @endif
                                            </div>
                                        </div>
                                        @if ($intent['message'])
                                            <p class="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{{ $intent['message'] }}</p>
                                        @endif
                                        <div class="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                                            <div>Initiator: {{ $intent['initiator']['name'] ?? 'N/A' }}</div>
                                            <div>Invitee: {{ $intent['invitee']['name'] ?? 'Open intent' }}</div>
                                            <div>Expires: {{ $intent['expires_at'] ?? 'No expiry' }}</div>
                                            <div>Created: {{ $intent['created_at'] ?? '—' }}</div>
                                        </div>
                                    </article>
                                @endforeach
                            </div>
                        @endif
                    </section>

                    <div class="flex items-center justify-between pt-4">
                        <button type="button" wire:click="previous" class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300">
                            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to media
                        </button>
                        <button type="button" wire:click="next" class="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500">
                            Review & publish
                            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            @endif

            @if ($step === 'review')
                <div class="space-y-6">
                    <section class="space-y-4">
                        <header>
                            <h2 class="text-lg font-semibold text-slate-900">Review before publishing</h2>
                            <p class="text-sm text-slate-500">Ensure intent, media, and partner flows are in place. Publishing requires a verified agent and AI-safe status.</p>
                        </header>

                        <div class="grid gap-4 md:grid-cols-2">
                            <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <h3 class="text-sm font-semibold text-slate-700">Listing readiness</h3>
                                <ul class="mt-3 space-y-2 text-sm text-slate-600">
                                    <li class="flex items-center gap-2">
                                        <span class="inline-flex h-2.5 w-2.5 rounded-full {{ $basics['agent_id'] ? 'bg-emerald-500' : 'bg-rose-400' }}"></span>
                                        Agent connected
                                    </li>
                                    <li class="flex items-center gap-2">
                                        <span class="inline-flex h-2.5 w-2.5 rounded-full {{ $basics['ai_safe'] ? 'bg-emerald-500' : 'bg-amber-400' }}"></span>
                                        AI safety cleared
                                    </li>
                                    <li class="flex items-center gap-2">
                                        <span class="inline-flex h-2.5 w-2.5 rounded-full {{ count($media) > 0 ? 'bg-emerald-500' : 'bg-slate-300' }}"></span>
                                        Media assets ({{ count($media) }})
                                    </li>
                                    <li class="flex items-center gap-2">
                                        <span class="inline-flex h-2.5 w-2.5 rounded-full {{ count($partnerIntents) > 0 ? 'bg-indigo-500' : 'bg-slate-300' }}"></span>
                                        Partner intents ({{ count($partnerIntents) }})
                                    </li>
                                </ul>
                            </div>
                            <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                <h3 class="text-sm font-semibold text-slate-700">Publish controls</h3>
                                <div class="mt-3 space-y-3 text-sm text-slate-600">
                                    <button type="button" wire:click="publishListing" class="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 font-semibold text-white transition hover:bg-emerald-500">
                                        Publish now
                                    </button>
                                    <button type="button" wire:click="unpublishListing" class="inline-flex items-center gap-2 rounded-full border border-slate-300 px-5 py-2 font-semibold text-slate-600 transition hover:border-slate-400">
                                        Set back to draft
                                    </button>
                                    @error('publish')
                                        <p class="text-sm text-rose-600">{{ $message }}</p>
                                    @enderror
                                </div>
                            </div>
                        </div>
                    </section>

                    <section class="space-y-4">
                        <header>
                            <h3 class="text-sm font-semibold text-slate-700">Log a manual social share</h3>
                            <p class="text-xs text-slate-500">Recording social boosts keeps analytics in sync with partner telemetry.</p>
                        </header>
                        <form wire:submit.prevent="recordSocialShare" class="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                            <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div>
                                    <label class="block text-xs font-medium text-slate-600">Platform<span class="text-rose-500">*</span></label>
                                    <input type="text" class="form-input mt-1 w-full" wire:model.defer="socialForm.platform" placeholder="Instagram" />
                                    @error('socialForm.platform')
                                        <p class="mt-1 text-xs text-rose-600">{{ $message }}</p>
                                    @enderror
                                </div>
                                <div class="md:col-span-2">
                                    <label class="block text-xs font-medium text-slate-600">Share URL<span class="text-rose-500">*</span></label>
                                    <input type="url" class="form-input mt-1 w-full" wire:model.defer="socialForm.share_url" placeholder="https://" />
                                    @error('socialForm.share_url')
                                        <p class="mt-1 text-xs text-rose-600">{{ $message }}</p>
                                    @enderror
                                </div>
                            </div>
                            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <label class="block text-xs font-medium text-slate-600">Shared at</label>
                                    <input type="datetime-local" class="form-input mt-1 w-full" wire:model.defer="socialForm.shared_at" />
                                    @error('socialForm.shared_at')
                                        <p class="mt-1 text-xs text-rose-600">{{ $message }}</p>
                                    @enderror
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-slate-600">Meta (optional)</label>
                                    <textarea rows="2" class="form-textarea mt-1 w-full" wire:model.defer="socialForm.meta" placeholder="caption: sunset launch\nhashtags: womenrise"></textarea>
                                    @error('socialForm.meta')
                                        <p class="mt-1 text-xs text-rose-600">{{ $message }}</p>
                                    @enderror
                                </div>
                            </div>
                            <button type="submit" class="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500">
                                Record share
                            </button>
                        </form>

                        @if ($socialShares !== [])
                            <div class="space-y-2">
                                <h4 class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Recent shares</h4>
                                <div class="space-y-2">
                                    @foreach ($socialShares as $share)
                                        <div class="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                                            <div class="flex flex-wrap items-center justify-between gap-3">
                                                <span class="font-medium text-slate-800">{{ str($share['platform'])->title() }}</span>
                                                <span class="text-xs text-slate-400">{{ $share['shared_at'] ? \Illuminate\Support\Carbon::parse($share['shared_at'])->diffForHumans() : 'Logged just now' }}</span>
                                            </div>
                                            <div class="mt-1 truncate text-xs text-slate-500">{{ $share['share_url'] }}</div>
                                        </div>
                                    @endforeach
                                </div>
                            </div>
                        @endif
                    </section>

                    <div class="flex items-center justify-between pt-4">
                        <button type="button" wire:click="previous" class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300">
                            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to partners
                        </button>
                        <div class="text-right">
                            <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Need a second look?</p>
                            <p class="text-sm text-slate-600">Keep the listing as draft until moderation completes.</p>
                        </div>
                    </div>
                </div>
            @endif
        </div>
    </div>
</div>
