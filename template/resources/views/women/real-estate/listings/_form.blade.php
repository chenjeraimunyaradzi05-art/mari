@csrf

<div class="space-y-10">
    <section class="rounded-3xl border border-indigo-100/70 bg-white/90 p-8 shadow-lg shadow-indigo-500/5 backdrop-blur">
        <header class="mb-6 flex flex-col gap-2">
            <span class="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-500">Listing identity</span>
            <h2 class="text-xl font-semibold text-slate-900">Core story and audience</h2>
            <p class="text-sm text-slate-500">Craft the snapshot women-first renters and buyers will see in marketplaces.</p>
        </header>

        <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div class="space-y-2">
                <label for="title" class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Title<span class="text-rose-500">*</span></label>
                <input type="text" name="title" id="title" value="{{ old('title', $listing->title ?? '') }}" class="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 shadow-inner shadow-slate-200 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" required>
            </div>

            <div class="space-y-2">
                <label for="slug" class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Slug (optional)</label>
                <input type="text" name="slug" id="slug" value="{{ old('slug', $listing->slug ?? '') }}" class="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 shadow-inner shadow-slate-200 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
            </div>

            <div class="space-y-2">
                <label for="listing_type" class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Listing type<span class="text-rose-500">*</span></label>
                <select name="listing_type" id="listing_type" class="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 shadow-inner shadow-slate-200 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" required>
                    @foreach (['rent_shared', 'rent_private', 'buy', 'investment'] as $option)
                        <option value="{{ $option }}" @selected(old('listing_type', $listing->listing_type ?? 'rent_shared') === $option)>
                            {{ ucfirst(str_replace('_', ' ', $option)) }}
                        </option>
                    @endforeach
                </select>
            </div>

            <div class="space-y-2">
                <label for="audience" class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Primary audience<span class="text-rose-500">*</span></label>
                <select name="audience" id="audience" class="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 shadow-inner shadow-slate-200 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" required>
                    @foreach (['women_only', 'women_students', 'women_professionals', 'women_caregivers', 'women_retirees'] as $option)
                        <option value="{{ $option }}" @selected(old('audience', $listing->audience ?? 'women_only') === $option)>
                            {{ ucfirst(str_replace('_', ' ', $option)) }}
                        </option>
                    @endforeach
                </select>
            </div>
        </div>

        <div class="mt-6 space-y-2">
            <label for="description" class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Immersive description</label>
            <textarea name="description" id="description" rows="6" class="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-inner shadow-slate-200 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">{{ old('description', $listing->description ?? '') }}</textarea>
            <p class="text-xs text-slate-400">Highlight safety, community programs, nearby women-first services, and partnership potential.</p>
        </div>
    </section>

    <section class="rounded-3xl border border-indigo-100/70 bg-white/90 p-8 shadow-lg shadow-indigo-500/5 backdrop-blur">
        <header class="mb-6 flex flex-col gap-2">
            <span class="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-500">Advocate alignment</span>
            <h2 class="text-xl font-semibold text-slate-900">Agent presence & visual storytelling</h2>
            <p class="text-sm text-slate-500">Connect your verified advocate profile and curate media women trust.</p>
        </header>

        @php
            $selectedAgentProfileId = old('agent_profile_id', $listing->agent_profile_id ?? null);
        @endphp

        @if(isset($agentProfile) && $agentProfile)
            <div class="space-y-2">
                <label for="agent_profile_id" class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Linked agent profile</label>
                <select name="agent_profile_id" id="agent_profile_id" class="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 shadow-inner shadow-slate-200 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
                    <option value="">Do not link my agent profile</option>
                    <option value="{{ $agentProfile->id }}" @selected((int) $selectedAgentProfileId === $agentProfile->id)>
                        {{ $agentProfile->headline ? $agentProfile->headline : 'My accredited agent profile' }}
                    </option>
                </select>
                <p class="text-xs text-slate-400">Link your public advocate presence to reinforce trust signals on listing pages.</p>
            </div>
        @else
            <div class="rounded-2xl border border-indigo-100 bg-indigo-50/80 p-5 text-sm text-indigo-800">
                <p class="font-semibold">Need a verified advocate profile?</p>
                <p class="mt-2 text-indigo-700">Create your WomenRise agent presence to unlock trusted badges, automated reminders, and share-ready highlights.</p>
                <a href="{{ route('women.real-estate.agents.profile.edit') }}" class="mt-3 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white shadow-md shadow-indigo-500/30 transition hover:bg-indigo-500">
                    Set up agent profile
                </a>
            </div>
        @endif

        <div class="mt-6 space-y-3">
            <label for="photos" class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Upload media</label>
            <div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center">
                <input type="file" name="photos[]" id="photos" accept="image/jpeg,image/png,image/webp" multiple class="block w-full text-sm text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:uppercase file:tracking-[0.18em] file:text-white hover:file:bg-indigo-500">
                <p class="mt-3 text-xs text-slate-400">Upload up to 10 visuals (max 5&nbsp;MB each). The first upload becomes the cover unless you select another hero.</p>
            </div>
        </div>

        @php
            $currentPrimaryId = old('primary_photo_id', isset($listing) ? optional($listing->photos->firstWhere('is_primary', true))->id : null);
            if (! $currentPrimaryId && isset($listing) && $listing->exists) {
                $currentPrimaryId = optional($listing->photos->first())->id;
            }
        @endphp

        @if(isset($listing) && $listing->exists && $listing->photos->isNotEmpty())
            <div class="mt-6 space-y-4">
                <h3 class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Existing gallery</h3>
                @foreach ($listing->photos as $photo)
                    <div class="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm shadow-slate-200/70 sm:flex-row sm:items-center">
                        <img src="{{ $photo->url }}" alt="Listing photo" class="h-24 w-24 rounded-xl object-cover shadow-lg shadow-slate-400/20">
                        <div class="flex-1 space-y-3">
                            <div class="flex flex-wrap items-center gap-4">
                                <label class="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
                                    <input type="radio" name="primary_photo_id" value="{{ $photo->id }}" class="h-4 w-4 text-indigo-600 focus:ring-indigo-500" @checked((int) $currentPrimaryId === $photo->id)>
                                    <span>Set as primary</span>
                                </label>
                                <label class="inline-flex items-center gap-2 text-sm font-semibold text-rose-600">
                                    <input type="checkbox" name="remove_photo_ids[]" value="{{ $photo->id }}" class="h-4 w-4 text-rose-500 focus:ring-rose-500">
                                    <span>Remove</span>
                                </label>
                                <span class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Position {{ $photo->position }}</span>
                            </div>
                            @if ($photo->caption)
                                <p class="text-xs text-slate-500">{{ $photo->caption }}</p>
                            @endif
                        </div>
                    </div>
                @endforeach
            </div>
        @endif
    </section>

    <section class="rounded-3xl border border-indigo-100/70 bg-white/90 p-8 shadow-lg shadow-indigo-500/5 backdrop-blur">
        <header class="mb-6 flex flex-col gap-2">
            <span class="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-500">Financial snapshot</span>
            <h2 class="text-xl font-semibold text-slate-900">Pricing posture & visibility</h2>
            <p class="text-sm text-slate-500">Maintain transparent pricing cues and control how the listing appears across channels.</p>
        </header>

        <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div class="space-y-2">
                <label for="price_cents" class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Price (cents)</label>
                <input type="number" name="price_cents" id="price_cents" value="{{ old('price_cents', $listing->price_cents ?? '') }}" min="0" class="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 shadow-inner shadow-slate-200 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
            </div>
            <div class="space-y-2">
                <label for="bond_cents" class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Bond (cents)</label>
                <input type="number" name="bond_cents" id="bond_cents" value="{{ old('bond_cents', $listing->bond_cents ?? '') }}" min="0" class="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 shadow-inner shadow-slate-200 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
            </div>
            <div class="space-y-2">
                <label for="currency" class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Currency<span class="text-rose-500">*</span></label>
                <input type="text" name="currency" id="currency" value="{{ old('currency', $listing->currency ?? 'AUD') }}" maxlength="3" required class="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 shadow-inner shadow-slate-200 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
            </div>
        </div>

        <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label for="mortgage_required" class="inline-flex items-center gap-3 text-sm font-semibold text-slate-600">
                <input type="hidden" name="mortgage_required" value="0">
                <input type="checkbox" name="mortgage_required" id="mortgage_required" value="1" class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" @checked(old('mortgage_required', $listing->mortgage_required ?? false))>
                <span>Mortgage required for this opportunity</span>
            </label>

            <div class="grid w-full gap-4 sm:w-auto sm:grid-cols-2">
                <div class="space-y-2">
                    <label for="availability_date" class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Availability date</label>
                    <input type="date" name="availability_date" id="availability_date" value="{{ old('availability_date', optional($listing->availability_date ?? null)->format('Y-m-d')) }}" class="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 shadow-inner shadow-slate-200 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
                </div>
                <div class="space-y-2">
                    <label for="visibility" class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Visibility</label>
                    <select name="visibility" id="visibility" class="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 shadow-inner shadow-slate-200 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
                        @foreach (['community', 'public', 'private'] as $option)
                            <option value="{{ $option }}" @selected(old('visibility', $listing->visibility ?? 'community') === $option)>
                                {{ ucfirst($option) }}
                            </option>
                        @endforeach
                    </select>
                </div>
            </div>
        </div>
    </section>

    <section class="rounded-3xl border border-indigo-100/70 bg-white/90 p-8 shadow-lg shadow-indigo-500/5 backdrop-blur">
        <header class="mb-6 flex flex-col gap-2">
            <span class="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-500">Place intelligence</span>
            <h2 class="text-xl font-semibold text-slate-900">Location & amenities</h2>
            <p class="text-sm text-slate-500">Capture the neighbourhood essentials and women-centered amenities that build trust.</p>
        </header>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input type="text" name="location[address_line1]" placeholder="Address line" value="{{ old('location.address_line1', data_get($listing->location, 'address_line1')) }}" class="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 shadow-inner shadow-slate-200 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
            <input type="text" name="location[suburb]" placeholder="Suburb" value="{{ old('location.suburb', data_get($listing->location, 'suburb')) }}" class="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 shadow-inner shadow-slate-200 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
            <input type="text" name="location[state]" placeholder="State" value="{{ old('location.state', data_get($listing->location, 'state')) }}" class="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 shadow-inner shadow-slate-200 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
            <input type="text" name="location[postcode]" placeholder="Postcode" value="{{ old('location.postcode', data_get($listing->location, 'postcode')) }}" class="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 shadow-inner shadow-slate-200 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
            <input type="text" name="location[country]" placeholder="Country code" value="{{ old('location.country', data_get($listing->location, 'country', 'AU')) }}" class="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 shadow-inner shadow-slate-200 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
            <input type="text" name="location[lat]" placeholder="Latitude" value="{{ old('location.lat', data_get($listing->location, 'lat')) }}" class="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 shadow-inner shadow-slate-200 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
            <input type="text" name="location[lng]" placeholder="Longitude" value="{{ old('location.lng', data_get($listing->location, 'lng')) }}" class="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 shadow-inner shadow-slate-200 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
        </div>

        <div class="mt-6 space-y-2">
            <label for="amenities" class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Women-first amenities (JSON)</label>
            <textarea name="amenities" id="amenities" rows="4" class="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-inner shadow-slate-200 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" placeholder='{"safety":"24/7 security"}'>{{ old('amenities', isset($listing) && $listing->amenities ? json_encode($listing->amenities, JSON_PRETTY_PRINT) : '') }}</textarea>
            <p class="text-xs text-slate-400">Detail safety measures, accessibility insights, transport, and wellness perks women look for.</p>
        </div>
    </section>
</div>

<div class="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-end">
    <a href="{{ route('women.real-estate.listings.index') }}" class="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-600 transition hover:border-slate-400 hover:text-slate-700">
        Cancel
    </a>
    <button type="submit" class="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-500 px-6 py-3 text-sm font-semibold uppercase tracking-[0.28em] text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-500 hover:via-purple-500 hover:to-fuchsia-500">
        Save Listing
    </button>
</div>
