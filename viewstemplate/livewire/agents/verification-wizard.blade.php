<div class="space-y-6" wire:key="verification-wizard">
    @if ($statusMessage && $submissionComplete)
        <div class="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
            <span class="mt-1 text-emerald-500">
                <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.172 7.707 8.879a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
            </span>
            <div>
                <p class="font-semibold">Submission received</p>
                <p class="text-sm">{{ $statusMessage }}</p>
            </div>
        </div>
    @endif

    <div class="bg-white shadow rounded-xl">
        <div class="border-b border-gray-100 px-6 py-4">
            <nav class="flex flex-wrap items-center gap-4">
                @foreach ($steps as $index => $stepKey)
                    @php
                        $isActive = $step === $stepKey;
                        $isComplete = array_search($step, $steps, true) > $index;
                        $label = $stepLabels[$stepKey] ?? \Illuminate\Support\Str::title($stepKey);
                    @endphp
                    <button type="button" wire:click="goToStep('{{ $stepKey }}')" class="flex items-center gap-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-rose-400 {{ $isActive ? 'text-rose-600' : ($isComplete ? 'text-emerald-600' : 'text-gray-500') }}">
                        <span class="flex h-7 w-7 items-center justify-center rounded-full border {{ $isActive ? 'border-rose-500 bg-rose-50 text-rose-600' : ($isComplete ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-gray-300 text-gray-500') }}">
                            {{ $index + 1 }}
                        </span>
                        <span>{{ $label }}</span>
                    </button>
                @endforeach
            </nav>
        </div>

        <form wire:submit.prevent="submit" class="px-6 py-6 space-y-6">
            @if ($step === 'profile')
                <section class="space-y-6">
                    <header>
                        <h2 class="text-lg font-semibold text-gray-900">Tell us about your practice</h2>
                        <p class="text-sm text-gray-500 mt-1">These details help us introduce you to women seeking trusted advocates.</p>
                    </header>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label for="legal_name" class="block text-sm font-medium text-gray-700">Legal name<span class="text-rose-500">*</span></label>
                            <input id="legal_name" type="text" wire:model.defer="form.profile.legal_name" class="form-input mt-1 block w-full" autocomplete="name" />
                            @error('form.profile.legal_name')
                                <p class="mt-2 text-sm text-rose-600">{{ $message }}</p>
                            @enderror
                        </div>
                        <div>
                            <label for="preferred_name" class="block text-sm font-medium text-gray-700">Preferred name</label>
                            <input id="preferred_name" type="text" wire:model.defer="form.profile.preferred_name" class="form-input mt-1 block w-full" />
                            @error('form.profile.preferred_name')
                                <p class="mt-2 text-sm text-rose-600">{{ $message }}</p>
                            @enderror
                        </div>
                        <div>
                            <label for="phone" class="block text-sm font-medium text-gray-700">Contact number<span class="text-rose-500">*</span></label>
                            <input id="phone" type="tel" wire:model.defer="form.profile.phone" class="form-input mt-1 block w-full" placeholder="e.g. +61 400 000 123" />
                            @error('form.profile.phone')
                                <p class="mt-2 text-sm text-rose-600">{{ $message }}</p>
                            @enderror
                        </div>
                        <div>
                            <label for="email" class="block text-sm font-medium text-gray-700">Contact email</label>
                            <input id="email" type="email" value="{{ $form['profile']['email'] }}" class="form-input mt-1 block w-full bg-gray-100" readonly />
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label for="agency_name" class="block text-sm font-medium text-gray-700">Agency or brokerage</label>
                            <input id="agency_name" type="text" wire:model.defer="form.profile.agency_name" class="form-input mt-1 block w-full" />
                            @error('form.profile.agency_name')
                                <p class="mt-2 text-sm text-rose-600">{{ $message }}</p>
                            @enderror
                        </div>
                        <div class="grid grid-cols-1 gap-4">
                            <div>
                                <label for="experience_years" class="block text-sm font-medium text-gray-700">Years of experience</label>
                                <input id="experience_years" type="number" min="0" max="60" wire:model.defer="form.profile.experience_years" class="form-input mt-1 block w-full" />
                                @error('form.profile.experience_years')
                                    <p class="mt-2 text-sm text-rose-600">{{ $message }}</p>
                                @enderror
                            </div>
                            <div>
                                <label for="website" class="block text-sm font-medium text-gray-700">Website</label>
                                <input id="website" type="url" wire:model.defer="form.profile.website" class="form-input mt-1 block w-full" placeholder="https://" />
                                @error('form.profile.website')
                                    <p class="mt-2 text-sm text-rose-600">{{ $message }}</p>
                                @enderror
                            </div>
                        </div>
                    </div>

                    <div>
                        <label for="professional_profile_url" class="block text-sm font-medium text-gray-700">Professional profile link</label>
                        <input id="professional_profile_url" type="url" wire:model.defer="form.profile.professional_profile_url" class="form-input mt-1 block w-full" placeholder="https://example.com/profile" />
                        @error('form.profile.professional_profile_url')
                            <p class="mt-2 text-sm text-rose-600">{{ $message }}</p>
                        @enderror
                    </div>
                </section>
            @endif

            @if ($step === 'license')
                <section class="space-y-6">
                    <header>
                        <h2 class="text-lg font-semibold text-gray-900">License & compliance</h2>
                        <p class="text-sm text-gray-500 mt-1">We verify every license with the relevant regulator to protect our community.</p>
                    </header>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label for="license_number" class="block text-sm font-medium text-gray-700">License number<span class="text-rose-500">*</span></label>
                            <input id="license_number" type="text" wire:model.defer="form.license.license_number" class="form-input mt-1 block w-full" />
                            @error('form.license.license_number')
                                <p class="mt-2 text-sm text-rose-600">{{ $message }}</p>
                            @enderror
                        </div>
                        <div>
                            <label for="license_type" class="block text-sm font-medium text-gray-700">License type</label>
                            <input id="license_type" type="text" wire:model.defer="form.license.license_type" class="form-input mt-1 block w-full" placeholder="Full agent, auctioneer, buyer advocate" />
                            @error('form.license.license_type')
                                <p class="mt-2 text-sm text-rose-600">{{ $message }}</p>
                            @enderror
                        </div>
                        <div>
                            <label for="regulator" class="block text-sm font-medium text-gray-700">Regulator<span class="text-rose-500">*</span></label>
                            <select id="regulator" wire:model.defer="form.license.regulator" class="form-select mt-1 block w-full">
                                <option value="">Select regulator</option>
                                @foreach ($regulators as $regulatorOption)
                                    <option value="{{ $regulatorOption }}">{{ $regulatorOption }}</option>
                                @endforeach
                                <option value="Other">Other</option>
                            </select>
                            @error('form.license.regulator')
                                <p class="mt-2 text-sm text-rose-600">{{ $message }}</p>
                            @enderror
                        </div>
                        <div>
                            <label for="license_expires_at" class="block text-sm font-medium text-gray-700">License expiry</label>
                            <input id="license_expires_at" type="date" wire:model.defer="form.license.license_expires_at" class="form-input mt-1 block w-full" />
                            @error('form.license.license_expires_at')
                                <p class="mt-2 text-sm text-rose-600">{{ $message }}</p>
                            @enderror
                        </div>
                    </div>

                    <div>
                        <label for="regions_served" class="block text-sm font-medium text-gray-700">Regions you service</label>
                        <textarea id="regions_served" rows="3" wire:model.defer="form.license.regions_served" class="form-textarea mt-1 block w-full" placeholder="e.g. Greater Sydney, Illawarra, Blue Mountains"></textarea>
                        <p class="text-xs text-gray-500 mt-2">Separate multiple regions with commas or line breaks.</p>
                        @error('form.license.regions_served')
                            <p class="mt-2 text-sm text-rose-600">{{ $message }}</p>
                        @enderror
                    </div>

                    <div>
                        <label for="specialisations" class="block text-sm font-medium text-gray-700">Specialisations</label>
                        <textarea id="specialisations" rows="3" wire:model.defer="form.license.specialisations" class="form-textarea mt-1 block w-full" placeholder="First-home buyers, downsizers, rent-to-own"></textarea>
                        @error('form.license.specialisations')
                            <p class="mt-2 text-sm text-rose-600">{{ $message }}</p>
                        @enderror
                    </div>
                </section>
            @endif

            @if ($step === 'documents')
                <section class="space-y-6">
                    <header>
                        <h2 class="text-lg font-semibold text-gray-900">Upload supporting documents</h2>
                        <p class="text-sm text-gray-500 mt-1">Uploads stay private. We only share summaries with women comparing agents.</p>
                    </header>

                    <div class="space-y-6">
                        <livewire:agents.document-uploader
                            wire:model="documents.license_certificate"
                            field="license_certificate"
                            label="Current license certificate"
                            description="PDF or scan issued by your regulator."
                            :accepted="['pdf', 'jpg', 'jpeg', 'png']"
                        />
                        @error('documents.license_certificate')
                            <p class="mt-2 text-sm text-rose-600">{{ $message }}</p>
                        @enderror

                        <livewire:agents.document-uploader
                            wire:model="documents.photo_id"
                            field="photo_id"
                            label="Government-issued photo ID"
                            description="Required for identity verification (driver licence or passport)."
                            :accepted="['pdf', 'jpg', 'jpeg', 'png']"
                        />
                        @error('documents.photo_id')
                            <p class="mt-2 text-sm text-rose-600">{{ $message }}</p>
                        @enderror

                        <livewire:agents.document-uploader
                            wire:model="documents.insurance"
                            field="insurance"
                            label="Professional indemnity insurance"
                            description="Optional but recommended — helps accelerate approvals."
                            :accepted="['pdf', 'jpg', 'jpeg', 'png']"
                        />
                    </div>
                </section>
            @endif

            @if ($step === 'references')
                <section class="space-y-6">
                    <header class="flex items-start justify-between">
                        <div>
                            <h2 class="text-lg font-semibold text-gray-900">Client or partner references</h2>
                            <p class="text-sm text-gray-500 mt-1">Share women-led success stories so we can highlight lived experience.</p>
                        </div>
                        <button type="button" class="inline-flex items-center rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50" wire:click="addReferenceRow">
                            <svg xmlns="http://www.w3.org/2000/svg" class="mr-1 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            Add reference
                        </button>
                    </header>

                    <div class="space-y-5">
                        @foreach ($form['references'] as $index => $reference)
                            <div class="rounded-lg border border-gray-200 p-4" wire:key="reference-{{ $index }}">
                                <div class="flex items-center justify-between mb-3">
                                    <h3 class="text-sm font-semibold text-gray-700">Reference #{{ $index + 1 }}</h3>
                                    @if (count($form['references']) > 1)
                                        <button type="button" class="text-xs font-semibold text-rose-600 hover:text-rose-700" wire:click="removeReferenceRow({{ $index }})">Remove</button>
                                    @endif
                                </div>

                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700">Name<span class="text-rose-500">*</span></label>
                                        <input type="text" wire:model.defer="form.references.{{ $index }}.name" class="form-input mt-1 block w-full" />
                                        @error('form.references.'.$index.'.name')
                                            <p class="mt-2 text-sm text-rose-600">{{ $message }}</p>
                                        @enderror
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700">Relationship<span class="text-rose-500">*</span></label>
                                        <input type="text" wire:model.defer="form.references.{{ $index }}.relationship" class="form-input mt-1 block w-full" placeholder="Client, partner, mentor" />
                                        @error('form.references.'.$index.'.relationship')
                                            <p class="mt-2 text-sm text-rose-600">{{ $message }}</p>
                                        @enderror
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700">Email<span class="text-rose-500">*</span></label>
                                        <input type="email" wire:model.defer="form.references.{{ $index }}.email" class="form-input mt-1 block w-full" />
                                        @error('form.references.'.$index.'.email')
                                            <p class="mt-2 text-sm text-rose-600">{{ $message }}</p>
                                        @enderror
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700">Phone</label>
                                        <input type="tel" wire:model.defer="form.references.{{ $index }}.phone" class="form-input mt-1 block w-full" />
                                        @error('form.references.'.$index.'.phone')
                                            <p class="mt-2 text-sm text-rose-600">{{ $message }}</p>
                                        @enderror
                                    </div>
                                </div>
                            </div>
                        @endforeach
                    </div>
                </section>
            @endif

            @if ($step === 'review')
                <section class="space-y-6">
                    <header>
                        <h2 class="text-lg font-semibold text-gray-900">Review & submit</h2>
                        <p class="text-sm text-gray-500 mt-1">Check that everything looks right before you hand it to our verification team.</p>
                    </header>

                    <div class="space-y-5">
                        <div class="rounded-lg border border-gray-200 p-4">
                            <h3 class="text-sm font-semibold text-gray-700 mb-3">Profile summary</h3>
                            <dl class="grid grid-cols-1 md:grid-cols-2 gap-y-2 text-sm text-gray-600">
                                <div><dt class="font-medium text-gray-500">Name</dt><dd>{{ $form['profile']['legal_name'] }}</dd></div>
                                <div><dt class="font-medium text-gray-500">Preferred</dt><dd>{{ $form['profile']['preferred_name'] ?: '—' }}</dd></div>
                                <div><dt class="font-medium text-gray-500">Phone</dt><dd>{{ $form['profile']['phone'] }}</dd></div>
                                <div><dt class="font-medium text-gray-500">Agency</dt><dd>{{ $form['profile']['agency_name'] ?: '—' }}</dd></div>
                                <div><dt class="font-medium text-gray-500">Website</dt><dd>{{ $form['profile']['website'] ?: '—' }}</dd></div>
                                <div><dt class="font-medium text-gray-500">Experience</dt><dd>{{ $form['profile']['experience_years'] ? $form['profile']['experience_years'].' years' : '—' }}</dd></div>
                            </dl>
                        </div>

                        <div class="rounded-lg border border-gray-200 p-4">
                            <h3 class="text-sm font-semibold text-gray-700 mb-3">License summary</h3>
                            <dl class="grid grid-cols-1 md:grid-cols-2 gap-y-2 text-sm text-gray-600">
                                <div><dt class="font-medium text-gray-500">License number</dt><dd>{{ $form['license']['license_number'] }}</dd></div>
                                <div><dt class="font-medium text-gray-500">Regulator</dt><dd>{{ $form['license']['regulator'] }}</dd></div>
                                <div><dt class="font-medium text-gray-500">Type</dt><dd>{{ $form['license']['license_type'] ?: '—' }}</dd></div>
                                <div><dt class="font-medium text-gray-500">Expires</dt><dd>{{ $form['license']['license_expires_at'] ?: '—' }}</dd></div>
                                <div class="md:col-span-2"><dt class="font-medium text-gray-500">Regions</dt><dd>{{ $form['license']['regions_served'] ?: '—' }}</dd></div>
                                <div class="md:col-span-2"><dt class="font-medium text-gray-500">Specialisations</dt><dd>{{ $form['license']['specialisations'] ?: '—' }}</dd></div>
                            </dl>
                        </div>

                        <div class="rounded-lg border border-gray-200 p-4">
                            <h3 class="text-sm font-semibold text-gray-700 mb-3">References</h3>
                            <ul class="space-y-2 text-sm text-gray-600">
                                @foreach ($form['references'] as $reference)
                                    <li class="flex flex-col">
                                        <span class="font-medium text-gray-700">{{ $reference['name'] }} — {{ $reference['relationship'] }}</span>
                                        <span>{{ $reference['email'] }}</span>
                                        @if (! empty($reference['phone']))
                                            <span>{{ $reference['phone'] }}</span>
                                        @endif
                                    </li>
                                @endforeach
                            </ul>
                        </div>

                        <div class="rounded-lg border border-rose-200 bg-rose-50 p-4">
                            <label class="flex items-start gap-3 text-sm text-rose-700">
                                <input type="checkbox" wire:model="form.consent.terms_accepted" class="mt-1 h-4 w-4 rounded border-rose-300 text-rose-600" />
                                <span>
                                    I have read and agree to the <a href="{{ route('policies.women-only') }}" class="font-semibold underline" target="_blank" rel="noopener">WomenRise women-only community policy</a>, confirm the information provided is accurate, and consent to WomenRise verifying my license with the selected regulator. I understand my details will be used to match me with women seeking verified advocates.
                                </span>
                            </label>
                            @error('form.consent.terms_accepted')
                                <p class="mt-2 text-sm text-rose-600">{{ $message }}</p>
                            @enderror
                        </div>

                        <div class="space-y-3 text-sm text-gray-600">
                            <label class="flex items-center gap-2">
                                <input type="checkbox" wire:model="form.consent.share_with_partners" class="h-4 w-4 rounded border-gray-300 text-rose-600" />
                                <span>Share my profile with vetted partner programs supporting women in real estate.</span>
                            </label>
                            <label class="flex items-center gap-2">
                                <input type="checkbox" wire:model="form.consent.ai_followups_opt_in" class="h-4 w-4 rounded border-gray-300 text-rose-600" />
                                <span>Send me AI-powered guidance on maintaining trusted status and upcoming reverification windows.</span>
                            </label>
                        </div>

                        @error('form.review.submit')
                            <p class="text-sm text-rose-600">{{ $message }}</p>
                        @enderror
                    </div>
                </section>
            @endif

            <div class="flex items-center justify-between border-t border-gray-100 pt-4">
                <div>
                    @if ($step !== 'profile')
                        <button type="button" class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50" wire:click="previous" wire:loading.attr="disabled">Back</button>
                    @endif
                </div>
                <div class="flex items-center gap-3">
                    @if ($step !== 'review')
                        <button type="button" class="inline-flex items-center rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-400" wire:click="next" wire:loading.attr="disabled">
                            Continue
                        </button>
                    @else
                        <button type="submit" class="inline-flex items-center rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-400" wire:loading.attr="disabled">
                            Submit for review
                        </button>
                    @endif
                </div>
            </div>
        </form>
    </div>

    @if ($assistantEnabled)
        <div class="bg-white shadow rounded-xl">
            <livewire:agents.verification-assistant :context="$assistantContext" :key="'verification-assistant'" />
        </div>
    @endif

    <div wire:loading.class="flex" wire:loading.class.remove="hidden" wire:target="submit,next,previous" class="fixed inset-0 z-30 hidden items-center justify-center bg-white/70">
        <div class="flex flex-col items-center gap-3 text-rose-600">
            <svg class="h-10 w-10 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <p class="text-sm font-medium">Saving your progress…</p>
        </div>
    </div>
</div>
