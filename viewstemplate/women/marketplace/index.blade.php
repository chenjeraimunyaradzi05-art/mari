@extends('layouts.app')

@section('content')
    @php
        $categoryToneClasses = [
            'emerald' => 'bg-emerald-100 text-emerald-900 border-emerald-300',
            'rose' => 'bg-rose-100 text-rose-900 border-rose-300',
            'cyan' => 'bg-cyan-100 text-cyan-900 border-cyan-300',
        ];
        $activeFilters = array_filter($query, fn ($value) => filled($value));
    @endphp

    <section class="bg-slate-950 text-white">
        <div class="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-16 lg:flex-row lg:items-end lg:py-24">
            <div class="flex-1 space-y-6">
                <span class="inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-1 text-sm uppercase tracking-wide text-white/80">
                    Women-Owned Marketplace
                </span>
                <h1 class="text-4xl font-semibold leading-tight sm:text-5xl">
                    Fitness, beauty, and pet care listings that centre women, carers, and community safety.
                </h1>
                <p class="text-lg text-white/80">
                    Built from the Problem Map research, every listing is vetted for trauma-aware care, ethical pricing, and advertising partners that fund real perks.
                </p>
                <dl class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <dt class="text-sm text-white/70">Live listings</dt>
                        <dd class="text-2xl font-semibold">{{ $stats['live_listings'] ?? '—' }}</dd>
                    </div>
                    <div>
                        <dt class="text-sm text-white/70">Sponsored perks</dt>
                        <dd class="text-2xl font-semibold">{{ $stats['sponsored_perks'] ?? '—' }}</dd>
                    </div>
                    <div>
                        <dt class="text-sm text-white/70">States represented</dt>
                        <dd class="text-2xl font-semibold">{{ $stats['states_represented'] ?? '—' }}</dd>
                    </div>
                    <div>
                        <dt class="text-sm text-white/70">Weekly searches</dt>
                        <dd class="text-2xl font-semibold">{{ $stats['community_requests'] ?? '—' }}</dd>
                    </div>
                </dl>
            </div>
            @if (!empty($heroSponsors))
                <div class="flex w-full max-w-xl flex-col gap-4 rounded-3xl bg-white/5 p-6 backdrop-blur">
                    <p class="text-sm uppercase tracking-wide text-white/70">Advertising partners funding care</p>
                    @foreach ($heroSponsors as $sponsor)
                        <article class="rounded-2xl bg-white/10 p-4">
                            <div class="flex items-center gap-3">
                                <span class="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">Sponsored</span>
                                <p class="text-white/80">{{ $sponsor['label'] ?? $sponsor['title'] ?? 'Community partner' }}</p>
                            </div>
                            <h3 class="mt-2 text-lg font-semibold text-white">{{ $sponsor['title'] ?? 'Partner placement' }}</h3>
                            @if (!empty($sponsor['description']))
                                <p class="mt-1 text-sm text-white/80">{{ $sponsor['description'] }}</p>
                            @endif
                            @if (!empty($sponsor['cta_url'] ?? null) && !empty($sponsor['cta_text'] ?? null))
                                <form method="POST" action="{{ route('women.marketplace.sponsor.redirect') }}" target="_blank" class="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-rose-200">
                                    @csrf
                                    <input type="hidden" name="slot" value="marketplace-hero">
                                    <input type="hidden" name="sponsor" value="{{ $sponsor['title'] ?? $sponsor['label'] ?? 'Partner' }}">
                                    <input type="hidden" name="redirect" value="{{ $sponsor['cta_url'] }}">
                                    @if (!empty($sponsor['metrics']['signature'] ?? null))
                                        <input type="hidden" name="signature" value="{{ $sponsor['metrics']['signature'] }}">
                                    @endif
                                    @if (!empty($sponsor['metrics']['creative_id'] ?? null))
                                        <input type="hidden" name="creative_id" value="{{ $sponsor['metrics']['creative_id'] }}">
                                    @endif
                                    <button type="submit" class="inline-flex items-center gap-2">
                                        {{ $sponsor['cta_text'] }}
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5h10m0 0v10m0-10L9 15" />
                                        </svg>
                                    </button>
                                </form>
                            @endif
                        </article>
                    @endforeach
                </div>
            @endif
        </div>
    </section>

    @if (session('marketplace_status'))
        <div class="mx-auto mt-4 max-w-5xl px-6">
            <div class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                {{ session('marketplace_status') }}
            </div>
        </div>
    @endif

    <section class="relative z-10 -mt-10">
        <div class="mx-auto max-w-6xl px-6">
            <form id="marketplace-search" method="GET" action="{{ route('women.marketplace.index') }}" class="rounded-3xl bg-white p-6 shadow-xl shadow-slate-200">
                <div class="grid gap-4 md:grid-cols-5">
                    <label class="flex flex-col gap-2 md:col-span-2">
                        <span class="text-sm font-semibold text-slate-600">Search women-owned services</span>
                        <input type="search" name="q" value="{{ $query['q'] }}" placeholder="pilates, mobile glam, grief care" class="rounded-2xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500" />
                    </label>
                    <label class="flex flex-col gap-2">
                        <span class="text-sm font-semibold text-slate-600">Category</span>
                        <select name="category" class="rounded-2xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500">
                            <option value="">All voices</option>
                            @foreach ($categories as $key => $category)
                                <option value="{{ $key }}" @selected($query['category'] === $key)>{{ $category['label'] }}</option>
                            @endforeach
                        </select>
                    </label>
                    <label class="flex flex-col gap-2">
                        <span class="text-sm font-semibold text-slate-600">Location</span>
                        <select name="location" class="rounded-2xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500">
                            <option value="">Nationwide</option>
                            @foreach ($filters['locations'] ?? [] as $location)
                                <option value="{{ $location['value'] }}" @selected($query['location'] === $location['value'])>{{ $location['label'] }}</option>
                            @endforeach
                        </select>
                    </label>
                    <label class="flex flex-col gap-2">
                        <span class="text-sm font-semibold text-slate-600">Price tier</span>
                        <select name="price" class="rounded-2xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500">
                            <option value="">Any</option>
                            @foreach ($filters['price_ranges'] ?? [] as $price)
                                <option value="{{ $price['value'] }}" @selected($query['price'] === $price['value'])>{{ $price['label'] }}</option>
                            @endforeach
                        </select>
                    </label>
                </div>
                <div class="mt-4 flex flex-wrap items-center gap-3">
                    <div class="flex gap-3">
                        <label class="flex items-center gap-2 text-sm text-slate-600">
                            <input type="radio" name="sort" value="" @checked(! $query['sort']) class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            Default sort
                        </label>
                        <label class="flex items-center gap-2 text-sm text-slate-600">
                            <input type="radio" name="sort" value="rating" @checked($query['sort'] === 'rating') class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            Highest rated
                        </label>
                        <label class="flex items-center gap-2 text-sm text-slate-600">
                            <input type="radio" name="sort" value="newest" @checked($query['sort'] === 'newest') class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            Recently added
                        </label>
                    </div>
                    <button type="submit" class="ml-auto inline-flex items-center rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200">
                        Run marketplace search
                    </button>
                    @if (!empty($activeFilters))
                        <a href="{{ route('women.marketplace.index') }}" class="text-sm font-semibold text-rose-600">Clear filters</a>
                    @endif
                </div>
            </form>
        </div>
    </section>

    <section class="mx-auto max-w-7xl px-6 py-12">
        <div class="grid gap-10 lg:grid-cols-4">
            <div class="space-y-10 lg:col-span-3">
                <div class="grid gap-6 md:grid-cols-3">
                    @foreach ($categories as $key => $category)
                        <article class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div class="flex items-center justify-between">
                                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ $category['label'] }}</p>
                                <span class="text-sm font-semibold text-slate-500">{{ $categoryCounts[$key] ?? 0 }} live</span>
                            </div>
                            <h3 class="mt-2 text-xl font-semibold text-slate-900">{{ $category['summary'] }}</h3>
                            <p class="mt-3 text-sm text-slate-600">{{ $category['proof'] }}</p>
                            <span class="mt-4 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold {{ $categoryToneClasses[$category['tone']] ?? 'border-slate-200 bg-slate-100 text-slate-900' }}">
                                {{ $categoryCounts[$key] ?? 0 }} services ready
                            </span>
                        </article>
                    @endforeach
                </div>

                <div class="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Results</p>
                            <h2 class="text-2xl font-semibold text-slate-900">{{ $totalResults }} services match</h2>
                        </div>
                        @if (!empty($appliedFilters))
                            <div class="flex flex-wrap gap-2">
                                @foreach ($appliedFilters as $filter)
                                    <span class="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                                        {{ $filter['label'] }}: {{ $filter['value'] }}
                                    </span>
                                @endforeach
                            </div>
                        @endif
                    </div>

                    @if ($aiContexts->isNotEmpty())
                        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Athena follow-ups</p>
                                    <p class="text-sm text-slate-600">Jump back into your last concierge prompts.</p>
                                </div>
                            </div>
                            <ul class="mt-4 space-y-3">
                                @foreach ($aiContexts as $context)
                                    @php
                                        $contextFilters = collect($context['filters'] ?? [])->filter();
                                    @endphp
                                    <li class="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                                        <div class="flex items-center justify-between gap-4">
                                            <div>
                                                <p class="font-semibold text-slate-900">{{ Str::limit($context['prompt'] ?? 'Marketplace reflection', 90) }}</p>
                                                <p class="text-xs text-slate-500">
                                                    {{ $contextFilters->isNotEmpty() ? $contextFilters->map(fn ($value, $key) => Str::headline($key).': '.Str::headline($value))->implode(' • ') : 'Saved filters' }}
                                                    · {{ optional($context['created_at'])->diffForHumans() }}
                                                </p>
                                            </div>
                                            <a href="{{ route('ai.concierge', ['context' => 'women-marketplace', 'context_payload' => $context['context_payload'], 'prompt' => $context['prompt']]) }}" class="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-indigo-700">
                                                Re-open in Athena
                                            </a>
                                        </div>
                                    </li>
                                @endforeach
                            </ul>
                        </div>
                    @endif

                    <div class="grid gap-6 md:grid-cols-2">
                        @forelse ($listings as $listing)
                            @php
                                $heroImage = $listing->hero_image ?: asset('frontend/assets/imgs/page/homepage2/img1.png');
                                $modalities = implode(', ', $listing->modalities ?? []);
                                $availability = implode(', ', $listing->availability_options ?? []);
                            @endphp
                            <article class="flex flex-col rounded-3xl border border-slate-200 bg-white shadow-sm">
                                <div class="relative">
                                    <img src="{{ $heroImage }}" alt="{{ $listing->name }}" class="h-56 w-full rounded-t-3xl object-cover" />
                                    <div class="absolute left-4 top-4 flex flex-wrap gap-2">
                                        <span class="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-900">{{ $listing->categoryLabel() }}</span>
                                        @if ($listing->is_sponsored)
                                            <span class="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">Advertising partner</span>
                                        @endif
                                    </div>
                                </div>
                                <div class="flex flex-1 flex-col gap-4 p-6">
                                    <div>
                                        <div class="flex items-center justify-between text-sm text-slate-500">
                                            <span>{{ $listing->location_label ?? 'Nationwide' }}</span>
                                            <span class="inline-flex items-center gap-1 font-semibold text-amber-500">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="m9.049 2.927 1.902 3.852 4.253.618-3.077 2.997.726 4.234-3.804-2-3.804 2 .726-4.234-3.077-2.997 4.253-.618 1.902-3.852z" />
                                                </svg>
                                                {{ number_format($listing->rating ?? 4.8, 2) }}
                                            </span>
                                        </div>
                                        <h3 class="mt-3 text-xl font-semibold text-slate-900">{{ $listing->name }}</h3>
                                        <p class="mt-2 text-sm text-slate-600">{{ $listing->description }}</p>
                                    </div>
                                    @if (!empty($listing->tags))
                                        <ul class="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                                            @foreach ($listing->tags as $tag)
                                                <li class="rounded-full bg-slate-100 px-3 py-1">{{ $tag }}</li>
                                            @endforeach
                                        </ul>
                                    @endif
                                    <div class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                                        <p class="font-semibold text-slate-900">{{ $listing->price_copy ?? 'Flexible pricing available' }}</p>
                                        <p class="mt-1 text-xs text-slate-500">{{ Str::headline($listing->price_tier ?? 'Flexible') }} tier · {{ $modalities ?: 'Hybrid delivery' }}</p>
                                        @if (!empty($listing->perks))
                                            <ul class="mt-3 space-y-1 text-xs text-slate-600">
                                                @foreach ($listing->perks as $perk)
                                                    <li class="flex items-start gap-2">
                                                        <svg xmlns="http://www.w3.org/2000/svg" class="mt-0.5 h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        <span>{{ $perk }}</span>
                                                    </li>
                                                @endforeach
                                            </ul>
                                        @endif
                                        @if ($availability)
                                            <p class="mt-3 text-xs text-slate-500">Access support: {{ $availability }}</p>
                                        @endif
                                    </div>
                                    <div class="space-y-3">
                                        <form method="POST" action="{{ route('women.marketplace.leads.store', $listing) }}" class="space-y-3">
                                            @csrf
                                            <input type="hidden" name="return_to" value="{{ url()->full() }}">
                                            @foreach ($activeFilters as $key => $value)
                                                <input type="hidden" name="filters[{{ $key }}]" value="{{ $value }}">
                                            @endforeach
                                            <details class="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-600">
                                                <summary class="cursor-pointer font-semibold text-slate-800">Add context for this founder (optional)</summary>
                                                <textarea name="notes" rows="2" class="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-indigo-500" placeholder="Mention carers, mobility needs, or preferred times"></textarea>
                                            </details>
                                            <div class="flex items-center justify-between">
                                                <span class="text-sm text-slate-500">{{ $listing->review_count }} verified reviews</span>
                                                <button type="submit" class="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                                                    {{ $listing->booking_cta ?? 'Request intro' }}
                                                </button>
                                            </div>
                                        </form>
                                        <form method="POST" action="{{ route('women.marketplace.ask', $listing) }}" class="text-right">
                                            @csrf
                                            @foreach ($activeFilters as $key => $value)
                                                <input type="hidden" name="filters[{{ $key }}]" value="{{ $value }}">
                                            @endforeach
                                            <input type="hidden" name="prompt" value="Help me compare {{ $listing->name }} with similar {{ $listing->categoryLabel() }} listings.">
                                            <button type="submit" class="text-xs font-semibold text-indigo-700">Ask Athena about this listing →</button>
                                        </form>
                                    </div>
                                </div>
                            </article>
                        @empty
                            <div class="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600 md:col-span-2">
                                <p class="text-lg font-semibold text-slate-900">No listings match yet</p>
                                <p class="mt-2">Adjust filters or tell the marketplace team who you want us to onboard.</p>
                                <a href="{{ route('contact.index') }}" class="mt-4 inline-flex items-center rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white">Request a listing</a>
                            </div>
                        @endforelse
                    </div>
                </div>

                @if (!empty($spotlightSponsors))
                    <section class="rounded-3xl bg-gradient-to-r from-rose-50 to-amber-50 p-6">
                        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p class="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">Advertising spotlight</p>
                                <h3 class="mt-2 text-2xl font-semibold text-slate-900">Partner-funded perks keep memberships affordable.</h3>
                            </div>
                            <div class="flex flex-wrap gap-4">
                                @foreach ($spotlightSponsors as $sponsor)
                                    <article class="w-full rounded-2xl bg-white/80 p-4 text-sm text-slate-700 md:w-56">
                                        <p class="text-xs font-semibold uppercase tracking-wide text-rose-500">{{ $sponsor['label'] ?? 'Partner' }}</p>
                                        <h4 class="mt-1 text-base font-semibold text-slate-900">{{ $sponsor['title'] ?? 'Marketplace sponsor' }}</h4>
                                        @if (!empty($sponsor['description']))
                                            <p class="mt-1 text-xs text-slate-600">{{ $sponsor['description'] }}</p>
                                        @endif
                                        @if (!empty($sponsor['cta_url'] ?? null) && !empty($sponsor['cta_text'] ?? null))
                                            <form method="POST" action="{{ route('women.marketplace.sponsor.redirect') }}" target="_blank" class="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
                                                @csrf
                                                <input type="hidden" name="slot" value="marketplace-spotlight">
                                                <input type="hidden" name="sponsor" value="{{ $sponsor['title'] ?? $sponsor['label'] ?? 'Partner' }}">
                                                <input type="hidden" name="redirect" value="{{ $sponsor['cta_url'] }}">
                                                @if (!empty($sponsor['metrics']['signature'] ?? null))
                                                    <input type="hidden" name="signature" value="{{ $sponsor['metrics']['signature'] }}">
                                                @endif
                                                @if (!empty($sponsor['metrics']['creative_id'] ?? null))
                                                    <input type="hidden" name="creative_id" value="{{ $sponsor['metrics']['creative_id'] }}">
                                                @endif
                                                <button type="submit" class="inline-flex items-center gap-1">
                                                    {{ $sponsor['cta_text'] }}
                                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5h10m0 0v10m0-10L9 15" />
                                                    </svg>
                                                </button>
                                            </form>
                                        @endif
                                    </article>
                                @endforeach
                            </div>
                        </div>
                    </section>
                @endif
            </div>

            <aside class="space-y-8">
                <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 class="text-lg font-semibold text-slate-900">Fine-tune marketplace filters</h3>
                    <p class="mt-1 text-sm text-slate-600">Surface listings that match availability needs.</p>
                    <div class="mt-4 space-y-4">
                        <label class="flex flex-col gap-2 text-sm text-slate-600">
                            Modality
                            <select name="modality" form="marketplace-search" onchange="this.form?.submit()" class="rounded-2xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500">
                                <option value="">Any</option>
                                @foreach ($filters['modalities'] ?? [] as $modality)
                                    <option value="{{ $modality['value'] }}" @selected($query['modality'] === $modality['value'])>{{ $modality['label'] }}</option>
                                @endforeach
                            </select>
                        </label>
                        <label class="flex flex-col gap-2 text-sm text-slate-600">
                            Access needs
                            <select name="availability" form="marketplace-search" onchange="this.form?.submit()" class="rounded-2xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500">
                                <option value="">All services</option>
                                @foreach ($filters['availability'] ?? [] as $availability)
                                    <option value="{{ $availability['value'] }}" @selected($query['availability'] === $availability['value'])>{{ $availability['label'] }}</option>
                                @endforeach
                            </select>
                        </label>
                        <p class="text-xs text-slate-500">Filters use live Problem Map demand signals so partners can sponsor the gaps.</p>
                    </div>
                </div>

                @if (!empty($sidebarSponsors))
                    <div class="space-y-4">
                        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Marketplace advertising slots</p>
                        @foreach ($sidebarSponsors as $sponsor)
                            <article class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                                @if (!empty($sponsor['url']))
                                    <img src="{{ $sponsor['url'] }}" alt="{{ $sponsor['title'] ?? 'Marketplace sponsor' }}" class="h-40 w-full object-cover" />
                                @endif
                                <div class="space-y-2 p-4">
                                    <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ $sponsor['label'] ?? 'Partner' }}</p>
                                    <h3 class="text-lg font-semibold text-slate-900">{{ $sponsor['title'] ?? 'Sponsor placement' }}</h3>
                                    @if (!empty($sponsor['description']))
                                        <p class="text-sm text-slate-600">{{ $sponsor['description'] }}</p>
                                    @endif
                                    @if (!empty($sponsor['cta_url'] ?? null) && !empty($sponsor['cta_text'] ?? null))
                                        <form method="POST" action="{{ route('women.marketplace.sponsor.redirect') }}" target="_blank" class="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600">
                                            @csrf
                                            <input type="hidden" name="slot" value="marketplace-sidebar">
                                            <input type="hidden" name="sponsor" value="{{ $sponsor['title'] ?? $sponsor['label'] ?? 'Partner' }}">
                                            <input type="hidden" name="redirect" value="{{ $sponsor['cta_url'] }}">
                                            @if (!empty($sponsor['metrics']['signature'] ?? null))
                                                <input type="hidden" name="signature" value="{{ $sponsor['metrics']['signature'] }}">
                                            @endif
                                            @if (!empty($sponsor['metrics']['creative_id'] ?? null))
                                                <input type="hidden" name="creative_id" value="{{ $sponsor['metrics']['creative_id'] }}">
                                            @endif
                                            <button type="submit" class="inline-flex items-center gap-2">
                                                {{ $sponsor['cta_text'] }}
                                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5h10m0 0v10m0-10L9 15" />
                                                </svg>
                                            </button>
                                        </form>
                                    @endif
                                </div>
                            </article>
                        @endforeach
                    </div>
                @endif
            </aside>
        </div>
    </section>
@endsection
