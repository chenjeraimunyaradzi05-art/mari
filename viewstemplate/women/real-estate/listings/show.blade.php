@extends('women.real-estate.layouts.console')



@section('console-content')
    @if (session('status'))
        <div class="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-800 shadow-sm shadow-emerald-100">
            {{ session('status') }}
        </div>
    @endif

    <div class="wr-console-hero">
        <span class="wr-console-pill">WomenRise Listing Overview</span>

        <div class="flex flex-col-reverse gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div class="space-y-4">
                <h1 class="wr-console-headline">{{ $listing->title }}</h1>
                <p class="wr-console-subtitle">
                    {{ $listing->description ? Str::limit($listing->description, 180) : 'Review listing readiness, partnerships, and mortgage intelligence from one console view.' }}
                </p>
                <div class="wr-listing-meta">
                    <span class="wr-listing-meta__chip">{{ ucfirst(str_replace('_', ' ', $listing->listing_type)) }}</span>
                    <span class="wr-listing-meta__chip">Audience · {{ strtoupper(str_replace('_', ' ', $listing->audience)) }}</span>
                    <span class="wr-listing-meta__chip">Verification · {{ ucfirst($listing->verification_status) }}</span>
                    <span class="wr-listing-meta__chip">Moderation · {{ ucfirst($listing->moderation_status) }}</span>
                    <span class="wr-listing-meta__chip">Visibility · {{ ucfirst($listing->visibility) }}</span>
                </div>
            </div>

            <div class="wr-listing-actions">
                @can('update', $listing)
                    <a href="{{ route('women.real-estate.listings.edit', $listing) }}" class="wr-action-btn primary">Edit Listing</a>
                @endcan

                @can('delete', $listing)
                    <form action="{{ route('women.real-estate.listings.destroy', $listing) }}" method="post" class="inline">
                        @csrf
                        @method('DELETE')
                        <button type="submit" class="wr-action-btn danger" onclick="return confirm('Remove this listing?')">Delete</button>
                    </form>
                @endcan
            </div>
        </div>
    </div>

    <div class="wr-console-shell space-y-8">
        <div class="wr-console-card-shell">
            <div class="wr-console-card space-y-10">
                @if ($listing->agentProfile)
                    <section class="space-y-3">
                        <div class="wr-section-title">Agent partner</div>
                        <h2 class="wr-section-heading">
                            {{ $listing->agentProfile->headline ?? ($listing->agentProfile->user->name ?? 'Trusted women-focused agent') }}
                        </h2>
                        <p class="text-sm text-indigo-800">
                            {{ $listing->agentProfile->bio ? Str::limit($listing->agentProfile->bio, 220) : 'Connected agent is ready to support seekers, negotiations, and onboarding.' }}
                        </p>
                        <div class="space-y-1 text-xs text-indigo-800/80">
                            @if ($listing->agentProfile->experience_years)
                                <p>Experience: {{ $listing->agentProfile->experience_years }} years</p>
                            @endif
                            @if ($listing->agentProfile->service_regions)
                                <p>Regions: {{ implode(', ', $listing->agentProfile->service_regions) }}</p>
                            @endif
                            <p>Status: {{ ucfirst($listing->agentProfile->availability_status) }}</p>
                        </div>
                        <div class="mt-3 flex flex-wrap gap-3 text-sm">
                            @if ($listing->agentProfile->calendly_url)
                                <a href="{{ $listing->agentProfile->calendly_url }}" target="_blank" class="inline-flex items-center gap-2 rounded-xl bg-indigo-600/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.26em] text-indigo-700 transition hover:bg-indigo-600/20">
                                    Book a call
                                </a>
                            @endif
                            @if ($listing->agentProfile->video_pitch_url)
                                <a href="{{ $listing->agentProfile->video_pitch_url }}" target="_blank" class="inline-flex items-center gap-2 rounded-xl bg-pink-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.26em] text-pink-600 transition hover:bg-pink-500/20">
                                    Watch introduction
                                </a>
                            @endif
                        </div>
                    </section>
                @endif

                @if ($listing->photos->isNotEmpty())
                    <section class="space-y-4">
                        <div class="wr-section-title">Gallery</div>
                        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
                            @foreach ($listing->photos as $photo)
                                <figure class="relative overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
                                    <img src="{{ $photo->url }}" alt="Listing photo" class="h-56 w-full object-cover">
                                    @if ($photo->is_primary)
                                        <span class="absolute left-3 top-3 inline-flex items-center rounded-full bg-pink-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white shadow-md">
                                            Primary
                                        </span>
                                    @endif
                                </figure>
                            @endforeach
                        </div>
                    </section>
                @endif

                <section class="space-y-3">
                    <div class="wr-section-title">Story</div>
                    <h2 class="wr-section-heading">Experience snapshot</h2>
                    @if ($listing->description)
                        <p class="whitespace-pre-line text-slate-700">{{ $listing->description }}</p>
                    @else
                        <p class="text-slate-500">No description has been added yet. Share the story behind this opportunity to help women connect faster.</p>
                    @endif
                </section>

                <section class="space-y-4">
                    <div class="wr-section-title">Snapshot metrics</div>
                    <div class="wr-meta-grid two-column">
                        <div class="wr-meta-card space-y-2">
                            <h4>Pricing</h4>
                            <p>Price: {{ $listing->price_cents ? number_format($listing->price_cents / 100, 2) : 'N/A' }} {{ $listing->currency }}</p>
                            <p>Bond: {{ $listing->bond_cents ? number_format($listing->bond_cents / 100, 2) : 'N/A' }} {{ $listing->currency }}</p>
                        </div>
                        <div class="wr-meta-card space-y-2">
                            <h4>Status</h4>
                            <p>Verification: {{ ucfirst($listing->verification_status) }}</p>
                            <p>Moderation: {{ ucfirst($listing->moderation_status) }}</p>
                            <p>Visibility: {{ ucfirst($listing->visibility) }}</p>
                        </div>
                        <div class="wr-meta-card space-y-2">
                            <h4>Availability</h4>
                            <p>Available from: {{ optional($listing->availability_date)->toFormattedDateString() ?? 'TBD' }}</p>
                            <p>Mortgage required: {{ $listing->mortgage_required ? 'Yes' : 'No' }}</p>
                        </div>
                    </div>
                </section>

                <section class="space-y-3">
                    <div class="wr-section-title">Location context</div>
                    @if ($listing->location)
                        <pre class="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700">{{ json_encode($listing->location, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) }}</pre>
                    @else
                        <p class="text-slate-500">No location data provided.</p>
                    @endif
                </section>

                <section class="space-y-3">
                    <div class="wr-section-title">Amenities</div>
                    @if ($listing->amenities)
                        <pre class="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700">{{ json_encode($listing->amenities, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) }}</pre>
                    @else
                        <p class="text-slate-500">No amenities listed.</p>
                    @endif
                </section>

                <section class="space-y-4">
                    <div class="wr-section-title">Partnership intentions</div>
                    <h2 class="wr-section-heading">Community momentum</h2>

                    @if ($canViewAllIntentions)
                        @if ($listing->partnershipIntentions->isEmpty())
                            <p class="text-sm text-slate-600">No partnership intentions yet. Encourage the community to co-invest, co-rent, or collaborate.</p>
                        @else
                            <div class="overflow-x-auto rounded-2xl border border-indigo-100 bg-white/80 shadow-sm">
                                <table class="min-w-full divide-y divide-indigo-100 text-sm">
                                    <thead class="bg-indigo-50/70">
                                        <tr>
                                            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">Initiator</th>
                                            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">Intent</th>
                                            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">Budget</th>
                                            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">Finance</th>
                                            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">Skills</th>
                                            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">Status</th>
                                            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-indigo-50" data-intentions-body>
                                        @foreach ($listing->partnershipIntentions as $intention)
                                            <tr class="bg-white/80">
                                                <td class="px-4 py-3 text-slate-800">{{ $intention->initiator->name ?? 'Member' }}</td>
                                                <td class="px-4 py-3 capitalize">{{ str_replace('_', ' ', $intention->intent_type) }}</td>
                                                <td class="px-4 py-3">
                                                    @php
                                                        $min = $intention->budget_range_min_cents;
                                                        $max = $intention->budget_range_max_cents;
                                                    @endphp
                                                    @if ($min || $max)
                                                        <span>
                                                            {{ $min ? '$' . number_format($min / 100, 0) : 'N/A' }}
                                                            –
                                                            {{ $max ? '$' . number_format($max / 100, 0) : 'Open' }}
                                                        </span>
                                                    @else
                                                        <span class="text-slate-400">Not stated</span>
                                                    @endif
                                                </td>
                                                <td class="px-4 py-3 capitalize">{{ $intention->preferred_finance_type ? str_replace('_', ' ', $intention->preferred_finance_type) : '—' }}</td>
                                                <td class="px-4 py-3 text-slate-600">
                                                    @if ($intention->skills_offered)
                                                        <span>{{ implode(', ', $intention->skills_offered) }}</span>
                                                    @else
                                                        <span class="text-slate-400">—</span>
                                                    @endif
                                                </td>
                                                <td class="px-4 py-3 text-xs font-semibold uppercase tracking-[0.26em] @class([
                                                    'text-amber-600' => $intention->status === 'pending',
                                                    'text-emerald-600' => $intention->status === 'matched',
                                                    'text-slate-400' => in_array($intention->status, ['withdrawn', 'expired'], true),
                                                ])">
                                                    {{ ucfirst($intention->status) }}
                                                </td>
                                                <td class="px-4 py-3 text-slate-600">{{ Str::limit($intention->notes, 120) }}</td>
                                            </tr>
                                        @endforeach
                                    </tbody>
                                </table>
                            </div>
                        @endif
                    @else
                        @php
                            $activeIntention = $viewerIntentions->first(function ($intention) {
                                return in_array($intention->status, ['pending', 'matched'], true);
                            });
                        @endphp

                        @if ($activeIntention)
                            <div class="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-sm text-emerald-900">
                                <p class="font-semibold">You have an active {{ str_replace('_', ' ', $activeIntention->intent_type) }} intention.</p>
                                <p class="mt-1">Status: <strong>{{ ucfirst($activeIntention->status) }}</strong></p>
                                @if ($activeIntention->notes)
                                    <p class="mt-2 text-emerald-800">Notes you shared: {{ $activeIntention->notes }}</p>
                                @endif
                                <form action="{{ route('women.real-estate.listings.partnership-intentions.destroy', [$listing, $activeIntention]) }}" method="POST" class="mt-3 inline-flex">
                                    @csrf
                                    @method('DELETE')
                                    <button type="submit" class="inline-flex items-center gap-2 rounded-xl border border-emerald-400 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700 transition hover:bg-emerald-100">Withdraw intention</button>
                                </form>
                            </div>
                        @else
                            <form method="POST" action="{{ route('women.real-estate.listings.partnership-intentions.store', $listing) }}" class="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4 text-sm text-slate-700">
                                @csrf
                                <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div>
                                        <label for="intent_type" class="block font-medium text-slate-800">I am interested in *</label>
                                        <select name="intent_type" id="intent_type" class="form-select mt-1">
                                            @foreach (['co_rent' => 'Co-rent / house share', 'co_buy' => 'Co-buy / shared equity', 'co_develop' => 'Co-develop / project'] as $value => $label)
                                                <option value="{{ $value }}" @selected(old('intent_type', 'co_rent') === $value)>{{ $label }}</option>
                                            @endforeach
                                        </select>
                                    </div>
                                    <div>
                                        <label for="preferred_finance_type" class="block font-medium text-slate-800">Preferred finance</label>
                                        <select name="preferred_finance_type" id="preferred_finance_type" class="form-select mt-1">
                                            <option value="">Open to ideas</option>
                                            @foreach (['mortgage' => 'Mortgage', 'cash' => 'Cash', 'shared_equity' => 'Shared equity', 'rent' => 'Rent-based'] as $value => $label)
                                                <option value="{{ $value }}" @selected(old('preferred_finance_type') === $value)>{{ $label }}</option>
                                            @endforeach
                                        </select>
                                    </div>
                                    <div>
                                        <label for="budget_range_min_cents" class="block font-medium text-slate-800">Budget (min)</label>
                                        <input type="number" name="budget_range_min_cents" id="budget_range_min_cents" class="form-input mt-1" value="{{ old('budget_range_min_cents') }}" placeholder="e.g. 50000 (AUD cents)">
                                    </div>
                                    <div>
                                        <label for="budget_range_max_cents" class="block font-medium text-slate-800">Budget (max)</label>
                                        <input type="number" name="budget_range_max_cents" id="budget_range_max_cents" class="form-input mt-1" value="{{ old('budget_range_max_cents') }}" placeholder="Optional upper bound">
                                    </div>
                                </div>
                                <div>
                                    <label for="skills_offered" class="block font-medium text-slate-800">What can you contribute?</label>
                                    <textarea name="skills_offered" id="skills_offered" rows="2" class="form-textarea mt-1" placeholder="Comma separated (e.g. legal advice, interior design)">{{ old('skills_offered') }}</textarea>
                                </div>
                                <div>
                                    <label for="availability_window" class="block font-medium text-slate-800">Availability window</label>
                                    <input type="text" name="availability_window" id="availability_window" class="form-input mt-1" value="{{ old('availability_window') }}" placeholder="e.g. Relocating from March 2026">
                                </div>
                                <div>
                                    <label for="notes" class="block font-medium text-slate-800">Notes for the agent / owner</label>
                                    <textarea name="notes" id="notes" rows="3" class="form-textarea mt-1" placeholder="Share what you are looking for, support needs, or non-negotiables.">{{ old('notes') }}</textarea>
                                </div>
                                @error('partnership')
                                    <p class="text-sm text-red-600">{{ $message }}</p>
                                @enderror
                                @foreach ($errors->getMessages() as $field => $messages)
                                    @if (in_array($field, ['intent_type', 'budget_range_min_cents', 'budget_range_max_cents', 'preferred_finance_type', 'skills_offered', 'availability_window', 'notes'], true))
                                        @foreach ($messages as $message)
                                            <p class="text-sm text-red-600">{{ $message }}</p>
                                        @endforeach
                                    @endif
                                @endforeach
                                <button type="submit" class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-xs font-semibold uppercase tracking-[0.26em] text-white shadow-md transition hover:bg-indigo-500">Submit partnership intention</button>
                            </form>
                        @endif
                    @endif
                </section>
            </div>
        </div>

        <div class="wr-console-card-shell">
            <div
                class="wr-console-card space-y-6"
                data-mortgage-widget
                data-stats-url="{{ route('api.women.real-estate.listings.mortgage-quotes.stats', $listing) }}"
                data-list-url="{{ route('api.women.real-estate.listings.mortgage-quotes.index', ['listing' => $listing, 'limit' => 6]) }}"
            >
                @php
                    $initialQuotes = $listing->mortgageQuotes;
                    $initialTotalQuotes = $initialQuotes->count();
                    $initialAverageRepaymentCents = $initialQuotes->avg('calculated_repayment_cents');
                    $initialLatestQuote = $initialQuotes->first();
                    $initialRiskBreakdown = $initialQuotes->groupBy('risk_rating')->map->count();
                @endphp

                <div class="space-y-2">
                    <div class="wr-section-title">Mortgage intelligence (beta)</div>
                    <h2 class="wr-section-heading">Scenario telemetry</h2>
                    <p class="text-sm text-slate-600">Generate indicative repayments using the latest lender snapshots curated for the WomenRise community. These numbers are illustrative only.</p>
                </div>

                <div class="wr-meta-grid two-column md:grid-cols-3">
                    <div class="wr-meta-card space-y-2">
                        <h4>Total scenarios</h4>
                        <p class="text-2xl font-semibold text-slate-900" data-total-scenarios>{{ number_format($initialTotalQuotes) }}</p>
                        <p class="text-xs text-slate-500">All mortgage quotes generated for this listing.</p>
                    </div>
                    <div class="wr-meta-card space-y-2">
                        <h4>Average repayment</h4>
                        <p class="text-2xl font-semibold text-slate-900" data-average-repayment>
                            @if ($initialAverageRepaymentCents)
                                ${{ number_format($initialAverageRepaymentCents / 100, 2) }}
                            @else
                                <span class="text-slate-400">—</span>
                            @endif
                        </p>
                        <p class="text-xs text-slate-500">Monthly equivalent across the latest scenarios.</p>
                    </div>
                    <div class="wr-meta-card space-y-2">
                        <h4>Latest update</h4>
                        <p class="text-2xl font-semibold text-slate-900" data-latest-scenario>
                            @if ($initialLatestQuote)
                                {{ optional($initialLatestQuote->generated_at)->diffForHumans() ?? '—' }}
                            @else
                                <span class="text-slate-400">Not yet run</span>
                            @endif
                        </p>
                        <div class="flex items-center justify-between">
                            <p class="text-xs text-slate-500">Keep scenarios fresh before sharing with seekers.</p>
                            <button
                                type="button"
                                data-refresh-btn
                                class="inline-flex items-center gap-2 rounded-xl border border-indigo-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-indigo-700 transition hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                Refresh data
                            </button>
                        </div>
                    </div>
                </div>

                <div data-widget-status class="hidden text-xs"></div>

                <div class="flex flex-wrap gap-2" data-risk-list>
                    @forelse ($initialRiskBreakdown as $risk => $count)
                        <span class="inline-flex items-center rounded-full bg-indigo-100/70 px-3 py-1 text-xs font-semibold text-indigo-700">
                            {{ ucfirst($risk ?? 'n/a') }} · {{ $count }}
                        </span>
                    @empty
                        <span class="text-xs text-slate-500">Risk mix will appear once scenarios run.</span>
                    @endforelse
                </div>

                <div class="overflow-x-auto rounded-2xl border border-indigo-100 bg-white/85 shadow-sm">
                    <table class="min-w-full divide-y divide-indigo-100 text-sm">
                        <thead class="bg-indigo-50/70">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">Snapshot</th>
                                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">Rate</th>
                                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">Repayment</th>
                                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">Term</th>
                                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">Frequency</th>
                                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">Risk</th>
                                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">Generated</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-indigo-50" data-quotes-body>
                            @forelse ($listing->mortgageQuotes as $quote)
                                @php
                                    $principal = $quote->principal_amount_cents / 100;
                                    $deposit = $quote->deposit_amount_cents ? $quote->deposit_amount_cents / 100 : null;
                                    $termYears = intdiv($quote->loan_term_months, 12);
                                @endphp
                                <tr class="bg-white/80 align-top">
                                    <td class="px-4 py-3 text-slate-800">
                                        <div class="font-semibold text-sm">{{ $quote->rateSnapshot->provider ?? 'Snapshot removed' }}</div>
                                        <div class="text-xs text-slate-500">
                                            {{ $quote->rateSnapshot->product_name ?? 'Product no longer available' }}
                                        </div>
                                    </td>
                                    <td class="px-4 py-3 text-slate-700">
                                        <div>{{ number_format($quote->rateSnapshot->interest_rate ?? 0, 2) }}%</div>
                                        @if ($quote->deposit_amount_cents)
                                            <div class="text-xs text-slate-500">Deposit: ${{ number_format($deposit, 0) }}</div>
                                        @endif
                                    </td>
                                    <td class="px-4 py-3 text-slate-700">
                                        <div>${{ number_format($quote->calculated_repayment_cents / 100, 2) }}</div>
                                        <div class="text-xs text-slate-500">Principal: ${{ number_format($principal, 0) }}</div>
                                    </td>
                                    <td class="px-4 py-3 text-slate-700">{{ $termYears }} years</td>
                                    <td class="px-4 py-3 text-slate-700 capitalize">{{ $quote->repayment_frequency }}</td>
                                    <td class="px-4 py-3">
                                        <span class="inline-flex items-center rounded-full bg-indigo-100/70 px-3 py-1 text-xs font-semibold text-indigo-700">
                                            {{ ucfirst($quote->risk_rating ?? 'n/a') }}
                                        </span>
                                    </td>
                                    <td class="px-4 py-3 text-xs text-slate-500">
                                        {{ optional($quote->generated_at)->diffForHumans() ?? '—' }}
                                        @if ($quote->ai_commentary)
                                            <div class="mt-1 text-slate-600">{{ Str::limit($quote->ai_commentary, 120) }}</div>
                                        @endif
                                    </td>
                                </tr>
                            @empty
                                <tr>
                                    <td colspan="7" class="px-4 py-4 text-center text-sm text-slate-500">No mortgage scenarios yet. Generate one below to kick things off.</td>
                                </tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>

                @if ($availableRateSnapshots->isNotEmpty())
                    <form method="POST" action="{{ route('women.real-estate.listings.mortgage-quotes.store', $listing) }}" class="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4 text-sm text-slate-700">
                        @csrf
                        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label for="mortgage_rate_snapshot_id" class="block font-medium text-slate-800">Select lender snapshot *</label>
                                <select id="mortgage_rate_snapshot_id" name="mortgage_rate_snapshot_id" class="form-select mt-1">
                                    <option value="">Choose an option</option>
                                    @foreach ($availableRateSnapshots as $snapshot)
                                        <option value="{{ $snapshot->id }}" @selected((int) old('mortgage_rate_snapshot_id') === (int) $snapshot->id)>
                                            {{ $snapshot->provider }} · {{ $snapshot->product_name }} · {{ number_format($snapshot->interest_rate, 2) }}% ({{ optional($snapshot->captured_at)->diffForHumans() ?? 'capture pending' }})
                                        </option>
                                    @endforeach
                                </select>
                                @error('mortgage_rate_snapshot_id')
                                    <p class="mt-1 text-xs text-red-600">{{ $message }}</p>
                                @enderror
                            </div>
                            <div>
                                <label for="loan_term_years" class="block font-medium text-slate-800">Loan term (years) *</label>
                                <input id="loan_term_years" name="loan_term_years" type="number" min="1" max="40" class="form-input mt-1" value="{{ old('loan_term_years', 30) }}">
                                @error('loan_term_years')
                                    <p class="mt-1 text-xs text-red-600">{{ $message }}</p>
                                @enderror
                            </div>
                            <div>
                                <label for="purchase_price_cents" class="block font-medium text-slate-800">Purchase price (cents)</label>
                                <input id="purchase_price_cents" name="purchase_price_cents" type="number" min="1000" class="form-input mt-1" value="{{ old('purchase_price_cents', $listing->price_cents) }}" placeholder="e.g. 65000000 for $650k">
                                @error('purchase_price_cents')
                                    <p class="mt-1 text-xs text-red-600">{{ $message }}</p>
                                @enderror
                            </div>
                            <div>
                                <label for="deposit_amount_cents" class="block font-medium text-slate-800">Deposit (cents)</label>
                                <input id="deposit_amount_cents" name="deposit_amount_cents" type="number" min="0" class="form-input mt-1" value="{{ old('deposit_amount_cents') }}" placeholder="Optional deposit contribution">
                                @error('deposit_amount_cents')
                                    <p class="mt-1 text-xs text-red-600">{{ $message }}</p>
                                @enderror
                            </div>
                            <div>
                                <label for="repayment_frequency" class="block font-medium text-slate-800">Repayment frequency *</label>
                                <select id="repayment_frequency" name="repayment_frequency" class="form-select mt-1">
                                    @foreach (['monthly' => 'Monthly', 'fortnightly' => 'Fortnightly', 'weekly' => 'Weekly'] as $value => $label)
                                        <option value="{{ $value }}" @selected(old('repayment_frequency', 'monthly') === $value)>{{ $label }}</option>
                                    @endforeach
                                </select>
                                @error('repayment_frequency')
                                    <p class="mt-1 text-xs text-red-600">{{ $message }}</p>
                                @enderror
                            </div>
                        </div>
                        <p class="text-xs text-slate-500">Outputs preview repayments only and do not constitute financial advice.</p>
                        <button type="submit" class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-xs font-semibold uppercase tracking-[0.26em] text-white shadow-md transition hover:bg-indigo-500">Generate mortgage scenario</button>
                    </form>
                @else
                    <div class="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-800">
                        We are still onboarding lender data for this listing type. Mortgage scenarios will be available soon.
                    </div>
                @endif
            </div>
        </div>
    </div>
@endsection

@push('scripts')
<script>
document.addEventListener('DOMContentLoaded', () => {
    const widgets = document.querySelectorAll('[data-mortgage-widget]');

    widgets.forEach((widget) => {
        const statsUrl = widget.dataset.statsUrl;
        const listUrl = widget.dataset.listUrl;

        if (!statsUrl || !listUrl) {
            return;
        }

        const refreshBtn = widget.querySelector('[data-refresh-btn]');
        const statusEl = widget.querySelector('[data-widget-status]');
        const totalEl = widget.querySelector('[data-total-scenarios]');
        const averageEl = widget.querySelector('[data-average-repayment]');
        const latestEl = widget.querySelector('[data-latest-scenario]');
        const riskListEl = widget.querySelector('[data-risk-list]');
        const quotesBody = widget.querySelector('[data-quotes-body]');

        const currencyFormatter = typeof Intl !== 'undefined' && typeof Intl.NumberFormat !== 'undefined'
            ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 })
            : null;

        const numberFormatter = typeof Intl !== 'undefined' && typeof Intl.NumberFormat !== 'undefined'
            ? new Intl.NumberFormat()
            : null;

        const relativeFormatter = typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat !== 'undefined'
            ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
            : null;

        function getXsrfToken() {
            const match = document.cookie.split('; ').find((row) => row.startsWith('XSRF-TOKEN='));
            if (!match) {
                return null;
            }
            const value = match.split('=')[1];
            try {
                return decodeURIComponent(value);
            } catch (error) {
                return value;
            }
        }

        const xsrfToken = getXsrfToken();

        function formatMoney(cents) {
            if (cents === null || cents === undefined) {
                return '—';
            }

            const value = Number(cents) / 100;

            if (!Number.isFinite(value)) {
                return '—';
            }

            if (currencyFormatter) {
                return currencyFormatter.format(value);
            }

            return '$' + value.toFixed(2);
        }

        function formatNumber(value) {
            if (!Number.isFinite(value)) {
                return '0';
            }

            if (numberFormatter) {
                return numberFormatter.format(value);
            }

            return String(value);
        }

        function formatRelative(isoString) {
            if (!isoString) {
                return '—';
            }

            const date = new Date(isoString);

            if (Number.isNaN(date.getTime())) {
                return isoString;
            }

            if (!relativeFormatter) {
                return date.toLocaleString();
            }

            const diffMs = date.getTime() - Date.now();
            const diffMinutes = diffMs / 60000;
            const absMinutes = Math.abs(diffMinutes);

            if (absMinutes < 1) {
                return 'just now';
            }

            const ranges = [
                { limit: 60, divisor: 60, unit: 'minute' },
                { limit: 1440, divisor: 3600, unit: 'hour' },
                { limit: 10080, divisor: 86400, unit: 'day' },
                { limit: 525600, divisor: 604800, unit: 'week' },
            ];

            for (const range of ranges) {
                if (absMinutes < range.limit) {
                    const value = Math.round(diffMs / (range.divisor * 1000));
                    return relativeFormatter.format(value, range.unit);
                }
            }

            const years = Math.round(diffMs / (31536000 * 1000));
            return relativeFormatter.format(years, 'year');
        }

        function truncate(text, limit = 160) {
            if (!text) {
                return '';
            }

            return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
        }

        function showStatus(message, tone = 'muted') {
            if (!statusEl) {
                return;
            }

            statusEl.classList.remove('hidden', 'text-slate-500', 'text-red-600', 'text-emerald-600');

            if (tone === 'success') {
                statusEl.classList.add('text-emerald-600');
            } else if (tone === 'error') {
                statusEl.classList.add('text-red-600');
            } else {
                statusEl.classList.add('text-slate-500');
            }

            statusEl.textContent = message;
        }

        function updateStats(stats) {
            if (!stats) {
                return;
            }

            if (totalEl) {
                totalEl.textContent = formatNumber(Number(stats.total ?? 0));
            }

            if (averageEl) {
                if (stats.average_repayment_cents === null || stats.average_repayment_cents === undefined) {
                    averageEl.textContent = '—';
                } else {
                    averageEl.textContent = formatMoney(stats.average_repayment_cents);
                }
            }

            if (latestEl) {
                latestEl.textContent = stats.latest_generated_at ? formatRelative(stats.latest_generated_at) : 'Not yet run';
            }

            if (riskListEl) {
                riskListEl.innerHTML = '';
                const entries = Object.entries(stats.risk_breakdown || {}).filter(([risk]) => Boolean(risk));

                if (entries.length === 0) {
                    const span = document.createElement('span');
                    span.className = 'text-xs text-slate-500';
                    span.textContent = 'Risk mix will appear once scenarios run.';
                    riskListEl.appendChild(span);
                } else {
                    entries.forEach(([risk, count]) => {
                        const chip = document.createElement('span');
                        chip.className = 'inline-flex items-center rounded-full bg-indigo-100/70 px-3 py-1 text-xs font-semibold text-indigo-700';
                        const label = `${risk.charAt(0).toUpperCase()}${risk.slice(1)} · ${formatNumber(Number(count))}`;
                        chip.textContent = label;
                        riskListEl.appendChild(chip);
                    });
                }
            }
        }

        function createCell(className) {
            const cell = document.createElement('td');
            cell.className = className;
            return cell;
        }

        function updateQuotes(quotes) {
            if (!quotesBody) {
                return;
            }

            quotesBody.innerHTML = '';

            if (!Array.isArray(quotes) || quotes.length === 0) {
                const row = document.createElement('tr');
                const cell = createCell('px-4 py-4 text-sm text-slate-500 text-center');
                cell.colSpan = 7;
                cell.textContent = 'No mortgage scenarios yet. Generate one below to kick things off.';
                row.appendChild(cell);
                quotesBody.appendChild(row);
                return;
            }

            quotes.forEach((quote) => {
                const row = document.createElement('tr');
                row.className = 'bg-white align-top';

                const snapshotTd = createCell('px-4 py-2 text-gray-800');
                const snapshotTitle = document.createElement('div');
                snapshotTitle.className = 'font-semibold text-sm';
                snapshotTitle.textContent = quote.rate_snapshot?.provider ?? 'Snapshot removed';
                const snapshotSubtitle = document.createElement('div');
                snapshotSubtitle.className = 'text-xs text-slate-500';
                snapshotSubtitle.textContent = quote.rate_snapshot?.product_name ?? 'Product no longer available';
                snapshotTd.appendChild(snapshotTitle);
                snapshotTd.appendChild(snapshotSubtitle);

                const rateTd = createCell('px-4 py-2 text-gray-700');
                const rateValue = document.createElement('div');
                const interest = Number(quote.rate_snapshot?.interest_rate ?? 0);
                rateValue.textContent = Number.isFinite(interest) ? `${interest.toFixed(2)}%` : '—';
                rateTd.appendChild(rateValue);
                if (quote.deposit_amount_cents) {
                    const deposit = document.createElement('div');
                    deposit.className = 'text-xs text-slate-500';
                    deposit.textContent = `Deposit: ${formatMoney(quote.deposit_amount_cents)}`;
                    rateTd.appendChild(deposit);
                }

                const repaymentTd = createCell('px-4 py-2 text-gray-700');
                const repaymentValue = document.createElement('div');
                repaymentValue.textContent = formatMoney(quote.calculated_repayment_cents);
                const principal = document.createElement('div');
                principal.className = 'text-xs text-slate-500';
                principal.textContent = `Principal: ${formatMoney(quote.principal_amount_cents)}`;
                repaymentTd.appendChild(repaymentValue);
                repaymentTd.appendChild(principal);

                const termTd = createCell('px-4 py-2 text-gray-700');
                const termYears = Number(quote.loan_term_months) / 12;
                termTd.textContent = Number.isFinite(termYears) ? `${Math.round(termYears)} years` : '—';

                const frequencyTd = createCell('px-4 py-2 text-gray-700 capitalize');
                frequencyTd.textContent = quote.repayment_frequency ?? '—';

                const riskTd = createCell('px-4 py-2');
                const riskBadge = document.createElement('span');
                riskBadge.className = 'inline-flex items-center rounded-full bg-indigo-100/70 px-3 py-1 text-xs font-semibold text-indigo-700';
                const riskLabel = quote.risk_rating ? `${quote.risk_rating.charAt(0).toUpperCase()}${quote.risk_rating.slice(1)}` : 'N/A';
                riskBadge.textContent = riskLabel;
                riskTd.appendChild(riskBadge);

                const generatedTd = createCell('px-4 py-2 text-slate-500 text-xs');
                generatedTd.textContent = formatRelative(quote.generated_at);
                if (quote.ai_commentary) {
                    const commentary = document.createElement('div');
                    commentary.className = 'mt-1 text-gray-600';
                    commentary.textContent = truncate(quote.ai_commentary);
                    generatedTd.appendChild(commentary);
                }

                row.appendChild(snapshotTd);
                row.appendChild(rateTd);
                row.appendChild(repaymentTd);
                row.appendChild(termTd);
                row.appendChild(frequencyTd);
                row.appendChild(riskTd);
                row.appendChild(generatedTd);

                quotesBody.appendChild(row);
            });
        }

        async function fetchJson(url) {
            const headers = {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            };

            if (xsrfToken) {
                headers['X-XSRF-TOKEN'] = xsrfToken;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers,
                credentials: 'same-origin',
            });

            let payload = null;
            if (response.status !== 204) {
                try {
                    payload = await response.json();
                } catch (error) {
                    payload = null;
                }
            }

            if (!response.ok) {
                const message = payload?.message ?? `Request failed (${response.status})`;
                throw new Error(message);
            }

            return payload;
        }

        let inFlight = false;

        async function refreshData() {
            if (inFlight) {
                return;
            }

            inFlight = true;

            if (refreshBtn) {
                refreshBtn.disabled = true;
            }

            showStatus('Refreshing mortgage intelligence…', 'muted');

            try {
                const [stats, quotes] = await Promise.all([
                    fetchJson(statsUrl),
                    fetchJson(listUrl),
                ]);

                updateStats(stats);
                updateQuotes(quotes?.data ?? []);
                showStatus('Mortgage intelligence refreshed.', 'success');
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unable to refresh mortgage intelligence.';
                showStatus(message, 'error');
            } finally {
                if (refreshBtn) {
                    refreshBtn.disabled = false;
                }
                inFlight = false;
            }
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', (event) => {
                event.preventDefault();
                refreshData();
            });
        }

        refreshData();
    });
});
</script>
@endpush

