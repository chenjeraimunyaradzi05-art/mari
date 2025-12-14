@extends('layouts.app')

@section('title', 'Money Inbox')

@section('content')
@php use Illuminate\Support\Str; use Illuminate\Support\Carbon; @endphp
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
    <section class="rounded-3xl bg-gradient-to-r from-fuchsia-600 via-rose-500 to-amber-400 p-8 text-white shadow-xl shadow-fuchsia-900/30">
        <p class="text-xs uppercase tracking-[0.5em] text-white/70">Money Inbox v1</p>
        <div class="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
                <h1 class="text-3xl font-bold">Subscription ledger, trade-offs & debt calm</h1>
                <p class="mt-2 text-sm text-white/80">One screen to see recurring spend, explore kinder choices, and launch the debt consolidator you already trust.</p>
            </div>
            <div class="rounded-2xl bg-white/15 px-5 py-4 text-right">
                <p class="text-xs uppercase tracking-[0.4em] text-white/60">Monthly spend</p>
                <p class="text-3xl font-semibold">{{ money_format($ledgerSummary['monthly_total']) }}</p>
                <p class="text-xs text-white/70">≈ {{ money_format($ledgerSummary['annualised_total']) }} yearly</p>
            </div>
        </div>
    </section>

    @if (session('status'))
        <div class="rounded-3xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm text-emerald-900">
            <p class="font-semibold">{{ session('status') }}</p>
        </div>
    @endif

    @if ($errors->has('csv'))
        <div class="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-700">
            <p class="font-semibold">{{ $errors->first('csv') }}</p>
        </div>
    @endif

    @auth
        <div
            data-import-status-wrapper
            data-endpoint="{{ route('financial.money-inbox.import-status') }}"
            data-poll-interval="15000"
            data-initial-status='@json($latestImportStatus)'
        >
            <div data-import-status-card>
                @if ($latestImportStatus)
                    @php
                        $status = $latestImportStatus['status'] ?? 'queued';
                        $toneMap = [
                            'queued' => 'border-slate-200 bg-slate-50 text-slate-700',
                            'processing' => 'border-amber-200 bg-amber-50 text-amber-900',
                            'completed' => 'border-emerald-200 bg-emerald-50 text-emerald-900',
                            'failed' => 'border-rose-200 bg-rose-50 text-rose-800',
                        ];
                        $tone = $toneMap[$status] ?? $toneMap['queued'];
                        $filename = $latestImportStatus['original_name'] ?? 'CSV import';
                        $lastUpdated = $latestImportStatus['finished_at'] ?? $latestImportStatus['started_at'] ?? $latestImportStatus['queued_at'] ?? null;
                        $lastUpdatedInstance = $lastUpdated instanceof Carbon ? $lastUpdated : ($lastUpdated ? Carbon::parse($lastUpdated) : null);
                        $warnings = (array) ($latestImportStatus['warnings'] ?? []);
                        $stats = $latestImportStatus['stats'] ?? [];
                    @endphp
                    <div class="rounded-3xl border px-6 py-4 text-sm {{ $tone }}">
                        <p class="text-xs uppercase tracking-[0.4em]">Latest import</p>
                        <p class="mt-1 text-base font-semibold">{{ Str::headline($status) }} · {{ $filename }}</p>
                        @if ($lastUpdatedInstance)
                            <p class="text-xs opacity-75">Updated {{ $lastUpdatedInstance->diffForHumans() }}</p>
                        @endif

                        @if ($status === 'completed')
                            <dl class="mt-3 grid grid-cols-3 gap-3 text-xs font-semibold">
                                <div>
                                    <dt class="text-[0.65rem] uppercase tracking-[0.3em] opacity-75">Created</dt>
                                    <dd class="text-base">{{ data_get($stats, 'created', 0) }}</dd>
                                </div>
                                <div>
                                    <dt class="text-[0.65rem] uppercase tracking-[0.3em] opacity-75">Updated</dt>
                                    <dd class="text-base">{{ data_get($stats, 'updated', 0) }}</dd>
                                </div>
                                <div>
                                    <dt class="text-[0.65rem] uppercase tracking-[0.3em] opacity-75">Unchanged</dt>
                                    <dd class="text-base">{{ data_get($stats, 'unchanged', 0) }}</dd>
                                </div>
                            </dl>

                            @if (!empty(data_get($stats, 'archived')))
                                <p class="mt-2 text-xs">{{ data_get($stats, 'archived') }} entries were archived because they were missing from the file.</p>
                            @endif

                            @if ($warnings)
                                <div class="mt-3 rounded-2xl border border-dashed border-current/40 p-3">
                                    <p class="text-xs font-semibold">Warnings</p>
                                    <ul class="mt-1 list-disc space-y-1 pl-5">
                                        @foreach($warnings as $warning)
                                            <li>{{ $warning }}</li>
                                        @endforeach
                                    </ul>
                                </div>
                            @endif
                        @elseif ($status === 'failed')
                            <p class="mt-2 text-sm font-semibold text-rose-700">{{ $latestImportStatus['error'] ?? 'Import failed. Please retry with a fresh export.' }}</p>
                        @else
                            <p class="mt-2 text-sm">We're processing <span class="font-semibold">{{ $filename }}</span>. Larger files can take a few minutes—refresh this page for the latest status.</p>
                        @endif

                        <div class="mt-4 flex justify-end">
                            <a href="{{ route('notifications.index') }}" class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-rose-700 shadow-sm transition hover:bg-white">
                                <i class="fas fa-bell"></i>
                                View notifications
                            </a>
                        </div>
                    </div>
                @endif
            </div>
        </div>
    @endauth

    @auth
    <section class="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
                <p class="text-xs uppercase tracking-[0.4em] text-slate-400">CSV import</p>
                <h2 class="text-lg font-semibold text-slate-900">Bring your existing ledger</h2>
                <p class="text-sm text-slate-500">Upload a CSV from your bank or spreadsheet — Athena will align labels and archive missing rows if you like.</p>
            </div>
            <form action="{{ route('financial.money-inbox.import') }}" method="POST" enctype="multipart/form-data" class="w-full max-w-xl space-y-3">
                @csrf
                <label class="block text-sm font-semibold text-slate-700" for="subscriptions-csv">CSV file</label>
                <input id="subscriptions-csv" name="csv" type="file" accept=".csv,text/csv" class="w-full rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm" required />
                <label class="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" name="archive_missing" value="1" class="h-4 w-4 rounded border-slate-300 text-rose-500" {{ old('archive_missing') ? 'checked' : '' }} />
                    Archive subscriptions not present in this file
                </label>
                <p class="text-xs text-slate-500">Columns supported: label, monthly_amount, category, necessity_level, provider, billing_cycle, status, next_renewal, tags, notes.</p>
                <button type="submit" class="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-700">
                    <i class="fas fa-file-import"></i>
                    Import subscriptions CSV
                </button>
            </form>
        </div>
    </section>
    @endauth

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <x-panel tone="surface">
            <p class="text-xs uppercase tracking-wide text-slate-500">Essential services</p>
            <p class="text-2xl font-semibold text-slate-900">{{ money_format($ledgerSummary['essentials']['total']) }}</p>
            <p class="text-xs text-slate-500">{{ $ledgerSummary['essentials']['count'] }} subscriptions flagged as non-negotiable.</p>
        </x-panel>
        <x-panel tone="surface">
            <p class="text-xs uppercase tracking-wide text-slate-500">Flexible treats</p>
            <p class="text-2xl font-semibold text-slate-900">{{ money_format($ledgerSummary['flexible']['total']) }}</p>
            <p class="text-xs text-slate-500">{{ $ledgerSummary['flexible']['count'] }} items safe to pause or reshape.</p>
        </x-panel>
        <x-panel tone="surface">
            <p class="text-xs uppercase tracking-wide text-slate-500">Upcoming renewals</p>
            <p class="text-2xl font-semibold text-slate-900">{{ count($ledgerSummary['upcoming']) }}</p>
            <p class="text-xs text-slate-500">Next 14 days.</p>
        </x-panel>
        <x-panel tone="surface">
            <p class="text-xs uppercase tracking-wide text-slate-500">Min. debt payments</p>
            <p class="text-2xl font-semibold text-slate-900">{{ money_format($debtPulse['min_payment_total']) }}/mo</p>
            <p class="text-xs text-slate-500">Across {{ count($debtPulse['debts']) }} active debts.</p>
        </x-panel>
    </div>

    @php
        $bundleOffer = $bundleConcierge['offer'] ?? [];
        $bundleConfidence = isset($bundleOffer['confidence']) ? (int) round($bundleOffer['confidence'] * 100) : 0;
        $bundleLineItems = collect($bundleOffer['line_items'] ?? [])->take(3);
    @endphp

    <section class="rounded-3xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-teal-50 to-rose-50 p-6 shadow-sm"
        data-bundle-mode="{{ $bundleConcierge['mode'] ?? 'preview' }}"
        data-bundle-endpoint="{{ $bundleConcierge['api']['create'] ?? '' }}"
        data-bundle-payload='@json($bundleConciergeSeed)'>
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
                <p class="text-xs uppercase tracking-[0.4em] text-emerald-500">Bundled expense concierge</p>
                <h2 class="mt-2 text-2xl font-semibold text-slate-900">
                    Potentially free {{ money_format($bundleOffer['projected_savings_monthly'] ?? 0) }} per month
                </h2>
                <p class="mt-2 text-sm text-slate-600">
                    {{ $bundleConcierge['mode'] === 'live' ? 'These savings reflect your latest concierge bundle offer.' : 'Preview based on Athena defaults until you generate a personalised offer.' }}
                </p>
                <div class="mt-3 flex flex-wrap gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-slate-500">
                    <span class="rounded-full bg-white px-3 py-1 text-emerald-600">{{ $bundleOffer['status'] ?? 'preview' }} mode</span>
                    <span class="rounded-full bg-white px-3 py-1 text-emerald-600">Confidence {{ $bundleConfidence }}%</span>
                    @if(!empty($bundleOffer['bundle_code']))
                        <span class="rounded-full bg-white px-3 py-1 text-slate-500/80">Ref {{ $bundleOffer['bundle_code'] }}</span>
                    @endif
                </div>
            </div>
            <div class="w-full max-w-xs">
                <div class="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                    <span>Confidence</span>
                    <span>{{ $bundleConfidence }}%</span>
                </div>
                <div class="mt-2 h-3 w-full rounded-full bg-white/70">
                    <div class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-rose-400" style="width: {{ $bundleConfidence }}%"></div>
                </div>
                <p class="mt-2 text-xs text-slate-600">Annual impact {{ money_format($bundleOffer['projected_savings_annual'] ?? 0) }} tracked in the Impact Index.</p>
            </div>
        </div>
        <div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            @forelse($bundleLineItems as $line)
                <article class="rounded-3xl border border-white/60 bg-white/80 p-4 shadow-sm">
                    <p class="text-[0.65rem] uppercase tracking-[0.4em] text-emerald-500">{{ $line['label'] ?? Str::title($line['category'] ?? 'Category') }}</p>
                    <h3 class="mt-2 text-lg font-semibold text-slate-900">{{ $line['suggested_provider'] ?? 'Athena partner' }}</h3>
                    <dl class="mt-3 space-y-1 text-sm text-slate-600">
                        <div class="flex items-center justify-between">
                            <dt>Current</dt>
                            <dd class="font-semibold">{{ money_format($line['current_monthly_cost'] ?? 0) }}</dd>
                        </div>
                        <div class="flex items-center justify-between">
                            <dt>Projected</dt>
                            <dd class="font-semibold text-emerald-600">{{ money_format($line['suggested_monthly_cost'] ?? 0) }}</dd>
                        </div>
                        <div class="flex items-center justify-between text-xs">
                            <dt>Savings</dt>
                            <dd class="font-semibold text-rose-500">{{ money_format($line['projected_savings_monthly'] ?? 0) }}/mo</dd>
                        </div>
                    </dl>
                    <p class="mt-3 text-xs text-slate-500">{{ data_get($line, 'metadata.discount_percent') ? data_get($line, 'metadata.discount_percent').'%' : 'Bundle bonus ready' }} off partner rate.</p>
                </article>
            @empty
                <article class="rounded-3xl border border-dashed border-white/60 bg-white/50 p-4 text-sm text-slate-500">
                    Bundle insights appear once you generate your first concierge offer.
                </article>
            @endforelse
        </div>
        <div class="mt-6 flex flex-wrap gap-3 text-sm">
            @if($bundleConcierge['api']['create'] ?? false)
                <span class="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
                    API ready · POST {{ $bundleConcierge['api']['create'] }}
                </span>
            @endif
            <a href="{{ $aiEntryUrl }}?context=money-bundle-negotiation" class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300">
                <i class="fas fa-comments"></i>
                Ask AI concierge for scripts
            </a>
        </div>
        @if(!empty($bundleOffer['negotiation_script']))
            <div class="mt-6 rounded-3xl border border-slate-100 bg-white/90 p-4 text-sm text-slate-700">
                <p class="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">Negotiation opener</p>
                <p class="mt-2 whitespace-pre-line">{{ $bundleOffer['negotiation_script'] }}</p>
            </div>
        @endif
    </section>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <x-panel tone="surface" class="lg:col-span-2" title="Subscription ledger" subtitle="Manual overview of recurring expenses">
            <div class="divide-y divide-slate-100">
                @forelse($subscriptions as $subscription)
                    <article class="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p class="text-base font-semibold text-slate-900">{{ $subscription['provider'] }} · {{ $subscription['service'] }}</p>
                            <p class="text-sm text-slate-500">{{ ucfirst(str_replace('_', ' ', $subscription['category'])) }} • {{ $subscription['billing_cycle'] }}</p>
                            <p class="mt-1 text-xs text-slate-500">{{ $subscription['notes'] }}</p>
                            <div class="mt-2 flex flex-wrap gap-2">
                                @foreach($subscription['tags'] as $tag)
                                    <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{{ str_replace('_', ' ', ucfirst($tag)) }}</span>
                                @endforeach
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="text-2xl font-semibold text-slate-900">{{ money_format($subscription['monthly_cost']) }}/mo</p>
                            <p class="text-xs text-slate-500">
                                @if($subscription['next_renewal'])
                                    Renewal {{ optional($subscription['next_renewal'])->format('d M') }}
                                @else
                                    Renewal date to be confirmed
                                @endif
                            </p>
                            <p class="text-xs text-{{ $subscription['status'] === 'planning_to_cancel' ? 'amber' : 'emerald' }}-600 capitalize">{{ str_replace('_', ' ', $subscription['status']) }}</p>
                        </div>
                    </article>
                @empty
                    <div class="py-10 text-center text-sm text-slate-500">
                        <p class="font-semibold text-slate-700">No saved subscriptions yet.</p>
                        <p class="mt-2">Use the API at <code class="rounded bg-slate-100 px-2 py-1 text-xs">/api/v1/money/subscriptions</code> or the upcoming CSV import to start your ledger.</p>
                    </div>
                @endforelse
            </div>
            <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p class="text-sm text-slate-500">Need a gentle explainer? Launch the AI modal with the calm guardrails already configured.</p>
                <button type="button" class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300" x-data x-on:click="$dispatch('open-modal', 'money-ai-coach')">
                    <i class="fas fa-moon"></i>
                    Ask Athena about subscriptions
                </button>
            </div>
        </x-panel>
        <x-panel tone="surface" title="Upcoming renewals" subtitle="Next charges you flagged">
            <ul class="space-y-4">
                @forelse($ledgerSummary['upcoming'] as $item)
                    <li class="rounded-2xl border border-slate-100 px-4 py-3">
                        <p class="text-sm font-semibold text-slate-900">{{ $item['label'] }}</p>
                        <p class="text-xs text-slate-500">{{ $item['renewal'] ?? 'Date TBC' }} • {{ money_format($item['monthly_cost']) }}/mo</p>
                        <p class="text-xs text-slate-400 capitalize">{{ str_replace('_', ' ', $item['status']) }}</p>
                    </li>
                @empty
                    <li class="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-500">
                        Upcoming renewals will appear here once you add subscriptions.
                    </li>
                @endforelse
            </ul>
            <div class="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p class="font-semibold text-slate-900">Leak alert</p>
                <p>Downgrade two flexible items to free ~{{ money_format($ledgerSummary['flexible']['total'] / 2) }} per month.</p>
            </div>
        </x-panel>
    </div>

    <section>
        <div class="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
                <h2 class="text-xl font-semibold text-slate-900">Trade-off widgets</h2>
                <p class="text-sm text-slate-500">Use the slider to see what partial changes could free for savings or debt snowballs.</p>
            </div>
        </div>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
            @foreach($tradeoffs as $tradeoff)
                <div class="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm" x-data="{ adoption: 50, format(value) { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value); } }">
                    <p class="text-xs uppercase tracking-[0.3em] text-slate-400">{{ $tradeoff['title'] }}</p>
                    <p class="mt-2 text-lg font-semibold text-slate-900">{{ $tradeoff['scenario'] }}</p>
                    <dl class="mt-4 space-y-1 text-sm text-slate-600">
                        <div class="flex items-center justify-between">
                            <dt>Current stack</dt>
                            <dd class="font-semibold text-slate-900">{{ money_format($tradeoff['current']) }}/mo</dd>
                        </div>
                        <div class="flex items-center justify-between">
                            <dt>Suggested</dt>
                            <dd class="font-semibold text-emerald-600">{{ money_format($tradeoff['alternative']) }}/mo</dd>
                        </div>
                    </dl>
                    <label class="mt-4 block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400" for="tradeoff-{{ Str::slug($tradeoff['title']) }}">Adoption preview</label>
                    <input id="tradeoff-{{ Str::slug($tradeoff['title']) }}" type="range" min="0" max="100" step="25" x-model.number="adoption" class="mt-2 w-full accent-rose-500">
                    <p class="mt-2 text-sm text-slate-500">Freeing <span class="font-semibold text-emerald-600" x-text="format((adoption / 100) * {{ $tradeoff['annual_saving'] }} / 12)"></span> per month ({{ $tradeoff['annual_saving'] }} yearly potential).</p>
                    <p class="mt-2 text-xs text-slate-500">{{ $tradeoff['emotion'] }}</p>
                </div>
            @endforeach
        </div>
    </section>

    @php
        $maskedRewardsCard = $rewardsCard['card_number']
            ? preg_replace('/-([A-Z0-9]{4})$/', '-••••', $rewardsCard['card_number'])
            : null;
        $cashbackGoal = max(1, (float) ($cashbackTracker['goal'] ?? 1));
        $cashbackProgress = min(100, round(((float) ($cashbackTracker['confirmed'] ?? 0) / $cashbackGoal) * 100));
    @endphp

    <section class="rounded-3xl border border-fuchsia-100 bg-gradient-to-r from-rose-50 via-fuchsia-50 to-amber-50 p-6 shadow-sm">
        <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
                <p class="text-xs uppercase tracking-[0.4em] text-rose-400">Athena rewards card</p>
                <h2 class="mt-2 text-2xl font-semibold text-slate-900">{{ $rewardsCard['holder'] }}</h2>
                <p class="text-sm text-slate-600">Tier: {{ Str::title($rewardsCard['tier']) }} · Status: {{ Str::title($rewardsCard['status']) }}</p>
                <p class="mt-3 text-sm text-slate-500">{{ $maskedRewardsCard ?? 'Activate your Athena card from the concierge to unlock calm discounts.' }}</p>
            </div>
            <div class="grid w-full grid-cols-2 gap-4 text-sm text-slate-600 md:grid-cols-4 lg:w-auto">
                <div class="rounded-2xl border border-white/60 bg-white/80 p-4">
                    <p class="text-[0.65rem] uppercase tracking-[0.4em] text-rose-400">Points</p>
                    <p class="text-2xl font-semibold text-slate-900">{{ number_format($rewardsCard['points_balance'], 0) }}</p>
                    <p class="text-xs">Lifetime {{ number_format($rewardsCard['lifetime_points'], 0) }}</p>
                </div>
                <div class="rounded-2xl border border-white/60 bg-white/80 p-4">
                    <p class="text-[0.65rem] uppercase tracking-[0.4em] text-rose-400">Redeemed</p>
                    <p class="text-2xl font-semibold text-slate-900">{{ number_format($rewardsCard['redeemed_points'], 0) }}</p>
                    <p class="text-xs">Cashback this month {{ money_format($rewardsCard['cashback_month']) }}</p>
                </div>
                <div class="rounded-2xl border border-white/60 bg-white/80 p-4">
                    <p class="text-[0.65rem] uppercase tracking-[0.4em] text-rose-400">Lifetime cashback</p>
                    <p class="text-2xl font-semibold text-slate-900">{{ money_format($rewardsCard['cashback_lifetime']) }}</p>
                    <p class="text-xs">Updated {{ optional($rewardsCard['updated_at'])->diffForHumans() }}</p>
                </div>
                <div class="rounded-2xl border border-white/60 bg-white/80 p-4">
                    <p class="text-[0.65rem] uppercase tracking-[0.4em] text-rose-400">Renewal</p>
                    <p class="text-2xl font-semibold text-slate-900">{{ optional($rewardsCard['renewal_at'])->format('M Y') }}</p>
                    <p class="text-xs">Reminder set {{ optional($rewardsCard['renewal_at'])->diffForHumans() }}</p>
                </div>
            </div>
        </div>
        <div class="mt-6 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            <span class="rounded-full bg-white px-4 py-2 text-rose-600">Budget-safe perks</span>
            <span class="rounded-full bg-white px-4 py-2 text-rose-600">AI guardrails included</span>
            <span class="rounded-full bg-white px-4 py-2 text-rose-600">No credit checks</span>
        </div>
    </section>

    <section class="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
                <p class="text-xs uppercase tracking-[0.4em] text-slate-400">Discount catalog</p>
                <h2 class="text-lg font-semibold text-slate-900">Current Athena card partners</h2>
                <p class="text-sm text-slate-500">Use these on purchases you already planned—no pressure spending or credit products.</p>
            </div>
            <div class="rounded-full bg-slate-900/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white">Card ID required</div>
        </div>
        <div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            @foreach($discountCatalog as $offer)
                <article class="rounded-3xl border border-slate-100 p-4 transition hover:border-rose-200 hover:shadow-sm">
                    <p class="text-[0.65rem] uppercase tracking-[0.4em] text-rose-400">{{ $offer['category'] }}</p>
                    <h3 class="mt-2 text-lg font-semibold text-slate-900">{{ $offer['partner'] }}</h3>
                    <p class="mt-1 text-sm text-slate-600">{{ $offer['offer'] }}</p>
                    <p class="mt-2 text-xs text-slate-500">{{ $offer['how'] }}</p>
                    <p class="mt-3 text-xs text-emerald-600">{{ $offer['impact'] }}</p>
                    <div class="mt-4 flex flex-wrap items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-slate-500">
                        <span class="rounded-full bg-slate-100 px-3 py-1">Valid {{ optional($offer['valid_until'])->format('d M Y') }}</span>
                        @foreach($offer['tags'] as $tag)
                            <span class="rounded-full bg-rose-50 px-3 py-1 text-rose-600">{{ str_replace('_', ' ', $tag) }}</span>
                        @endforeach
                    </div>
                </article>
            @endforeach
        </div>
    </section>

    <section class="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
                <p class="text-xs uppercase tracking-[0.4em] text-slate-400">Cashback tracker</p>
                <h2 class="text-lg font-semibold text-slate-900">{{ money_format($cashbackTracker['confirmed']) }} locked in</h2>
                <p class="text-sm text-slate-500">{{ money_format($cashbackTracker['pending']) }} pending clearing · Goal {{ money_format($cashbackTracker['goal']) }}</p>
            </div>
            <div class="w-full max-w-sm">
                <div class="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                    <p>Progress</p>
                    <p>{{ $cashbackProgress }}%</p>
                </div>
                <div class="mt-2 h-3 w-full rounded-full bg-slate-100">
                    <div class="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400" style="width: {{ $cashbackProgress }}%"></div>
                </div>
                <p class="mt-2 text-xs text-slate-500">Lifetime cashback {{ money_format($cashbackTracker['lifetime']) }} since joining.</p>
            </div>
        </div>
        <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div class="space-y-3">
                <h3 class="text-sm font-semibold text-slate-900">Earnings by category</h3>
                <ul class="space-y-3">
                    @foreach($cashbackTracker['categories'] as $category)
                        <li class="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
                            <div>
                                <p class="text-sm font-semibold text-slate-800">{{ $category['label'] }}</p>
                                <p class="text-xs text-slate-500">Keeps spending aligned to the plan</p>
                            </div>
                            <p class="text-sm font-semibold text-emerald-600">{{ money_format($category['amount']) }}</p>
                        </li>
                    @endforeach
                </ul>
            </div>
            <div>
                <h3 class="text-sm font-semibold text-slate-900">Recent cashback events</h3>
                <ul class="mt-3 space-y-3">
                    @foreach($cashbackTracker['events'] as $event)
                        <li class="rounded-2xl border border-slate-100 p-3">
                            <p class="text-sm font-semibold text-slate-800">{{ $event['label'] }}</p>
                            <div class="mt-1 flex items-center justify-between text-xs text-slate-500">
                                <span class="font-semibold text-emerald-600">{{ money_format($event['amount']) }}</span>
                                <span class="capitalize text-{{ $event['status'] === 'pending' ? 'amber' : 'emerald' }}-600">{{ $event['status'] }}</span>
                                <span>{{ optional($event['expected'])->diffForHumans() }}</span>
                            </div>
                        </li>
                    @endforeach
                </ul>
            </div>
        </div>
    </section>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        @php
            $womenOwned = $partnerOnboarding['forms']['women_owned'];
            $enterprise = $partnerOnboarding['forms']['enterprise'];
        @endphp
        <section class="rounded-3xl border border-rose-100 bg-white/90 p-6 shadow-sm" x-data="athenaPartnerForm({
            endpoint: @js($partnerOnboarding['endpoint']),
            subject: @js($womenOwned['subject']),
            successCopy: @js($womenOwned['success_copy']),
            title: 'Women-owned business onboarding',
            csrf: @js(csrf_token()),
        })">
            <p class="text-xs uppercase tracking-[0.4em] text-rose-400">Partner onboarding</p>
            <h2 class="mt-2 text-lg font-semibold text-slate-900">{{ $womenOwned['title'] }}</h2>
            <p class="text-sm text-slate-500">{{ $womenOwned['subtitle'] }}</p>
            <form class="mt-4 space-y-3" x-on:submit.prevent="submit">
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label class="text-sm text-slate-600">
                        Your name
                        <input type="text" x-model="fields.name" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" required>
                    </label>
                    <label class="text-sm text-slate-600">
                        Contact email
                        <input type="email" x-model="fields.email" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" required>
                    </label>
                </div>
                <label class="text-sm text-slate-600">
                    Business or studio name
                    <input type="text" x-model="fields.organisation" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" required>
                </label>
                <label class="text-sm text-slate-600">
                    Website or Instagram
                    <input type="text" x-model="fields.website" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" placeholder="https:// or @handle">
                </label>
                <label class="text-sm text-slate-600">
                    Offer focus
                    <input type="text" x-model="fields.offerFocus" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" placeholder="e.g. 10% off prenatal yoga">
                </label>
                <label class="text-sm text-slate-600">
                    Regions you can serve
                    <input type="text" x-model="fields.region" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" placeholder="Gold Coast, Brisbane, online">
                </label>
                <label class="text-sm text-slate-600">
                    Notes for Athena partnerships
                    <textarea x-model="fields.notes" rows="3" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" placeholder="Tell us about accessibility, languages, or safety commitments."></textarea>
                </label>
                <div class="space-y-2 text-sm">
                    <p class="text-emerald-600" x-show="success" x-text="success"></p>
                    <p class="text-rose-600" x-show="error" x-text="error"></p>
                </div>
                <button type="submit" class="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="submitting">
                    <i class="fas" :class="submitting ? 'fa-spinner fa-spin' : 'fa-paper-plane'"></i>
                    <span x-text="submitting ? 'Sending…' : 'Submit partner profile'"></span>
                </button>
            </form>
        </section>
        <section class="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-sm" x-data="athenaPartnerForm({
            endpoint: @js($partnerOnboarding['endpoint']),
            subject: @js($enterprise['subject']),
            successCopy: @js($enterprise['success_copy']),
            title: 'Enterprise & national partner intake',
            csrf: @js(csrf_token()),
        })">
            <p class="text-xs uppercase tracking-[0.4em] text-slate-400">Partner onboarding</p>
            <h2 class="mt-2 text-lg font-semibold text-slate-900">{{ $enterprise['title'] }}</h2>
            <p class="text-sm text-slate-500">{{ $enterprise['subtitle'] }}</p>
            <form class="mt-4 space-y-3" x-on:submit.prevent="submit">
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label class="text-sm text-slate-600">
                        Contact name
                        <input type="text" x-model="fields.name" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" required>
                    </label>
                    <label class="text-sm text-slate-600">
                        Work email
                        <input type="email" x-model="fields.email" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" required>
                    </label>
                </div>
                <label class="text-sm text-slate-600">
                    Organisation
                    <input type="text" x-model="fields.organisation" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" required>
                </label>
                <label class="text-sm text-slate-600">
                    Website
                    <input type="text" x-model="fields.website" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" placeholder="https://">
                </label>
                <label class="text-sm text-slate-600">
                    Offer summary
                    <textarea x-model="fields.offerFocus" rows="2" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" placeholder="Cashback %, wellbeing packs, debt relief, etc."></textarea>
                </label>
                <label class="text-sm text-slate-600">
                    Compliance or onboarding requirements
                    <textarea x-model="fields.notes" rows="2" class="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2" placeholder="Security reviews, marketing approvals, key dates."></textarea>
                </label>
                <div class="space-y-2 text-sm">
                    <p class="text-emerald-600" x-show="success" x-text="success"></p>
                    <p class="text-rose-600" x-show="error" x-text="error"></p>
                </div>
                <button type="submit" class="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="submitting">
                    <i class="fas" :class="submitting ? 'fa-spinner fa-spin' : 'fa-handshake-angle'"></i>
                    <span x-text="submitting ? 'Sending…' : 'Request partnership call'"></span>
                </button>
            </form>
        </section>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <x-panel tone="surface" title="Debt consolidator pulse" subtitle="Connects to the existing calculator">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                @foreach($debtPulse['scenarios'] as $scenario)
                    <div class="rounded-2xl border border-slate-100 p-4">
                        <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Rate {{ $scenario['rate'] }}%</p>
                        <p class="text-2xl font-semibold text-slate-900">{{ money_format($scenario['monthly_payment']) }}/mo</p>
                        <p class="text-xs text-slate-500">{{ $scenario['term_months'] }} months</p>
                        <dl class="mt-3 space-y-1 text-sm text-slate-600">
                            <div class="flex justify-between"><dt>Total paid</dt><dd>{{ money_format($scenario['total_paid']) }}</dd></div>
                            <div class="flex justify-between"><dt>Interest</dt><dd>{{ money_format($scenario['total_interest']) }}</dd></div>
                            <div class="flex justify-between"><dt>Savings vs min</dt><dd class="font-semibold {{ $scenario['savings_vs_current'] >= 0 ? 'text-emerald-600' : 'text-rose-600' }}">{{ money_format($scenario['savings_vs_current']) }}</dd></div>
                        </dl>
                    </div>
                @endforeach
            </div>
            <div class="mt-6 flex flex-wrap gap-3">
                <a href="{{ route('financial.debt') }}" class="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-700">
                    <i class="fas fa-arrow-up-right-from-square"></i>
                    Open detailed calculator
                </a>
                <button type="button" class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" x-data x-on:click="$dispatch('open-modal', 'debt-ai-coach')">
                    <i class="fas fa-microphone-lines"></i>
                    AI explanation modal
                </button>
            </div>
        </x-panel>
        <x-panel tone="surface" title="Keep calculators close" subtitle="These routes already exist—Money Inbox links there without duplication.">
            @php
                $calculatorLinks = [
                    [
                        'label' => 'Budget & cashflow workspace',
                        'description' => 'Review categories, forecast runway, and export for your mentor.',
                        'route' => route('financial.budget'),
                    ],
                    [
                        'label' => 'Transaction inbox',
                        'description' => 'Categorise feeds before they become leaks.',
                        'route' => route('financial.transactions'),
                    ],
                    [
                        'label' => 'Mortgage & rent calculators',
                        'description' => 'Link the housing module’s repayment and rent-vs-buy tools.',
                        'route' => route('housing.mortgage-calculator'),
                    ],
                    [
                        'label' => 'Full debt consolidator',
                        'description' => 'Already live at /financial/debt – this card keeps it one tap away.',
                        'route' => route('financial.debt'),
                    ],
                ];
            @endphp
            <div class="space-y-4">
                @foreach($calculatorLinks as $link)
                    <a href="{{ $link['route'] }}" class="block rounded-2xl border border-slate-100 p-4 transition hover:border-rose-200 hover:bg-rose-50/40">
                        <p class="text-sm font-semibold text-slate-900">{{ $link['label'] }}</p>
                        <p class="text-xs text-slate-500">{{ $link['description'] }}</p>
                    </a>
                @endforeach
            </div>
        </x-panel>
    </div>
</div>

<x-modal name="money-ai-coach" maxWidth="xl">
    @auth
    <div class="p-6 space-y-4" x-data="aiCoach({ context: '{{ $aiContexts['subscriptions']['context'] }}' })">
        <p class="text-xs uppercase tracking-[0.4em] text-slate-400">AI modal</p>
        <h2 class="text-2xl font-semibold text-slate-900">{{ $aiContexts['subscriptions']['title'] }}</h2>
        <p class="text-sm text-slate-500">Context key: <code class="rounded bg-slate-100 px-2 py-1 text-xs">{{ $aiContexts['subscriptions']['context'] }}</code></p>
        <p class="text-sm text-slate-500">{{ $aiContexts['subscriptions']['guardrails'] }}</p>
        <label class="block text-sm font-semibold text-slate-800" for="money-ai-note">What would you like Athena to explain?</label>
        <textarea id="money-ai-note" rows="4" x-model="question" class="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-rose-400 focus:ring-rose-400" placeholder="e.g. “Can you walk me through pausing a streaming bundle without feeling guilty?”"></textarea>
        <p class="text-sm text-rose-600" x-show="error" x-text="error" x-cloak></p>
        <div class="rounded-2xl bg-slate-50 p-4" x-show="answer" x-cloak>
            <p class="text-sm text-slate-800 whitespace-pre-line" x-text="answer"></p>
            <p class="mt-3 text-xs uppercase tracking-[0.3em] text-slate-400" x-text="disclaimer"></p>
        </div>
        <div class="flex flex-wrap justify-end gap-3">
            <button type="button" class="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" x-data x-on:click="$dispatch('close')">Close</button>
            <button type="button" class="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" x-on:click="ask()" :disabled="loading">
                <i class="fas" :class="loading ? 'fa-spinner fa-spin' : 'fa-comment-dots'"></i>
                <span x-text="loading ? 'Thinking…' : 'Ask Athena now'"></span>
            </button>
            <a href="{{ $aiEntryUrl }}" class="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white">
                <i class="fas fa-moon"></i>
                Open full AI concierge
            </a>
        </div>
    </div>
    @else
    <div class="p-6 space-y-4">
        <p class="text-xs uppercase tracking-[0.4em] text-slate-400">AI modal</p>
        <h2 class="text-2xl font-semibold text-slate-900">{{ $aiContexts['subscriptions']['title'] }}</h2>
        <p class="text-sm text-slate-500">Login to ask Athena personalised questions about your subscriptions.</p>
        <a href="{{ route('login') }}" class="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            <i class="fas fa-sign-in-alt"></i>
            Sign in to continue
        </a>
    </div>
    @endauth
</x-modal>

<x-modal name="debt-ai-coach" maxWidth="xl">
    @auth
    <div class="p-6 space-y-4" x-data="aiCoach({ context: '{{ $aiContexts['debt']['context'] }}' })">
        <p class="text-xs uppercase tracking-[0.4em] text-slate-400">AI modal</p>
        <h2 class="text-2xl font-semibold text-slate-900">{{ $aiContexts['debt']['title'] }}</h2>
        <p class="text-sm text-slate-500">Context key: <code class="rounded bg-slate-100 px-2 py-1 text-xs">{{ $aiContexts['debt']['context'] }}</code></p>
        <p class="text-sm text-slate-500">{{ $aiContexts['debt']['guardrails'] }}</p>
        <label class="block text-sm font-semibold text-slate-800" for="debt-ai-note">Outline what you want Athena to unpack.</label>
        <textarea id="debt-ai-note" rows="4" x-model="question" class="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-400 focus:ring-indigo-400" placeholder="e.g. “Help me understand the trade-off between term length and mental load.”"></textarea>
        <p class="text-sm text-rose-600" x-show="error" x-text="error" x-cloak></p>
        <div class="rounded-2xl bg-slate-50 p-4" x-show="answer" x-cloak>
            <p class="text-sm text-slate-800 whitespace-pre-line" x-text="answer"></p>
            <p class="mt-3 text-xs uppercase tracking-[0.3em] text-slate-400" x-text="disclaimer"></p>
        </div>
        <div class="flex flex-wrap justify-end gap-3">
            <button type="button" class="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" x-data x-on:click="$dispatch('close')">Close</button>
            <button type="button" class="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" x-on:click="ask()" :disabled="loading">
                <i class="fas" :class="loading ? 'fa-spinner fa-spin' : 'fa-microphone-lines'"></i>
                <span x-text="loading ? 'Thinking…' : 'Ask for context'"></span>
            </button>
            <a href="{{ $aiEntryUrl }}" class="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
                <i class="fas fa-wand-magic"></i>
                Continue in full AI workspace
            </a>
        </div>
    </div>
    @else
    <div class="p-6 space-y-4">
        <p class="text-xs uppercase tracking-[0.4em] text-slate-400">AI modal</p>
        <h2 class="text-2xl font-semibold text-slate-900">{{ $aiContexts['debt']['title'] }}</h2>
        <p class="text-sm text-slate-500">Sign in to ask Athena for a calm, educational explanation.</p>
        <a href="{{ route('login') }}" class="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
            <i class="fas fa-sign-in-alt"></i>
            Sign in to continue
        </a>
    </div>
    @endauth
</x-modal>
@endsection

@push('scripts')
<script>
    document.addEventListener('DOMContentLoaded', () => {
        const wrapper = document.querySelector('[data-import-status-wrapper]');
        if (!wrapper) {
            return;
        }

        const endpoint = wrapper.dataset.endpoint;
        if (!endpoint) {
            return;
        }

        const target = wrapper.querySelector('[data-import-status-card]');
        if (!target) {
            return;
        }

        const pollInterval = Number(wrapper.dataset.pollInterval || 15000);
        let lastStatus;

        try {
            lastStatus = JSON.parse(wrapper.dataset.initialStatus ?? 'null');
        } catch (error) {
            lastStatus = null;
        }

        let lastSignature = JSON.stringify(lastStatus ?? null);
        let stopped = false;

        const toneClasses = {
            queued: 'border-slate-200 bg-slate-50 text-slate-700',
            processing: 'border-amber-200 bg-amber-50 text-amber-900',
            completed: 'border-emerald-200 bg-emerald-50 text-emerald-900',
            failed: 'border-rose-200 bg-rose-50 text-rose-800',
        };

        const escapeHtml = (value) => {
            if (value === null || value === undefined) {
                return '';
            }

            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        const formatRelativeTime = (timestamp) => {
            if (!timestamp) {
                return '';
            }

            const parsed = new Date(timestamp);
            if (Number.isNaN(parsed.getTime())) {
                return '';
            }

            const diffSeconds = Math.round((parsed.getTime() - Date.now()) / 1000);
            const absoluteSeconds = Math.abs(diffSeconds);
            const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

            const thresholds = [
                { unit: 'second', limit: 60, divisor: 1 },
                { unit: 'minute', limit: 3600, divisor: 60 },
                { unit: 'hour', limit: 86400, divisor: 3600 },
                { unit: 'day', limit: 604800, divisor: 86400 },
                { unit: 'week', limit: 2629800, divisor: 604800 },
                { unit: 'month', limit: 31557600, divisor: 2629800 },
                { unit: 'year', limit: Infinity, divisor: 31557600 },
            ];

            for (const threshold of thresholds) {
                if (absoluteSeconds < threshold.limit) {
                    const value = diffSeconds / threshold.divisor;
                    return rtf.format(Math.round(value), threshold.unit);
                }
            }

            return parsed.toLocaleString();
        };

        const formatStateLabel = (value) => {
            if (!value) {
                return '';
            }

            return value
                .replace(/_/g, ' ')
                .replace(/(^|\s)\S/g, (match) => match.toUpperCase());
        };

        const renderStatusCard = (status) => {
            if (!status) {
                return '';
            }

            const state = String(status.status || 'queued').toLowerCase();
            const tone = toneClasses[state] || toneClasses.queued;
            const filename = escapeHtml(status.original_name || 'CSV import');
            const lastUpdated = status.finished_at || status.started_at || status.queued_at;
            const lastUpdatedLabel = formatRelativeTime(lastUpdated);
            const warnings = Array.isArray(status.warnings) ? status.warnings : [];
            const stats = status.stats || {};

            let markup = `<div class="rounded-3xl border px-6 py-4 text-sm ${tone}">`;
            markup += '<p class="text-xs uppercase tracking-[0.4em]">Latest import</p>';
            markup += `<p class="mt-1 text-base font-semibold">${escapeHtml(formatStateLabel(state) || 'Queued')} · ${filename}</p>`;

            if (lastUpdatedLabel) {
                markup += `<p class="text-xs opacity-75">Updated ${escapeHtml(lastUpdatedLabel)}</p>`;
            }

            if (state === 'completed') {
                markup += '<dl class="mt-3 grid grid-cols-3 gap-3 text-xs font-semibold">';
                markup += '<div><dt class="text-[0.65rem] uppercase tracking-[0.3em] opacity-75">Created</dt>';
                markup += `<dd class="text-base">${escapeHtml(stats.created ?? 0)}</dd></div>`;
                markup += '<div><dt class="text-[0.65rem] uppercase tracking-[0.3em] opacity-75">Updated</dt>';
                markup += `<dd class="text-base">${escapeHtml(stats.updated ?? 0)}</dd></div>`;
                markup += '<div><dt class="text-[0.65rem] uppercase tracking-[0.3em] opacity-75">Unchanged</dt>';
                markup += `<dd class="text-base">${escapeHtml(stats.unchanged ?? 0)}</dd></div>`;
                markup += '</dl>';

                if (stats.archived) {
                    markup += `<p class="mt-2 text-xs">${escapeHtml(stats.archived)} entries were archived because they were missing from the file.</p>`;
                }

                if (warnings.length > 0) {
                    markup += '<div class="mt-3 rounded-2xl border border-dashed border-current/40 p-3">';
                    markup += '<p class="text-xs font-semibold">Warnings</p>';
                    markup += '<ul class="mt-1 list-disc space-y-1 pl-5">';
                    warnings.forEach((warning) => {
                        markup += `<li>${escapeHtml(warning)}</li>`;
                    });
                    markup += '</ul></div>';
                }
            } else if (state === 'failed') {
                markup += `<p class="mt-2 text-sm font-semibold text-rose-700">${escapeHtml(status.error || 'Import failed. Please retry with a fresh export.')}</p>`;
            } else {
                markup += `<p class="mt-2 text-sm">We're processing <span class="font-semibold">${filename}</span>. Larger files can take a few minutes—refresh this page for the latest status.</p>`;
            }

            markup += '</div>';

            return markup;
        };

        const applyStatus = (status) => {
            target.innerHTML = renderStatusCard(status);
        };

        const poll = async () => {
            if (stopped || document.hidden) {
                return;
            }

            try {
                const response = await fetch(endpoint, {
                    headers: { 'Accept': 'application/json' },
                    credentials: 'same-origin',
                });

                if (response.status === 401 || response.status === 419) {
                    stopped = true;
                    return;
                }

                if (!response.ok) {
                    return;
                }

                const payload = await response.json();
                const status = payload?.data ?? null;
                const signature = JSON.stringify(status ?? null);

                if (signature !== lastSignature) {
                    lastSignature = signature;
                    applyStatus(status);
                }
            } catch (error) {
                console.warn('Unable to refresh subscription import status', error);
            }
        };

        poll();
        const intervalId = setInterval(() => {
            if (stopped) {
                clearInterval(intervalId);
                return;
            }

            poll();
        }, pollInterval);
    });
</script>
@endpush

@push('scripts')
<script>
    window.athenaPartnerForm = function (config) {
        return {
            fields: {
                name: '',
                email: '',
                organisation: '',
                website: '',
                offerFocus: '',
                region: '',
                notes: '',
            },
            submitting: false,
            success: '',
            error: '',
            async submit() {
                this.error = '';
                this.success = '';

                if (!this.fields.name || !this.fields.email || !this.fields.organisation) {
                    this.error = 'Please include your name, email, and organisation details.';
                    return;
                }

                this.submitting = true;

                try {
                    const response = await fetch(config.endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'X-CSRF-TOKEN': config.csrf,
                        },
                        credentials: 'same-origin',
                        body: JSON.stringify({
                            name: this.fields.name,
                            email: this.fields.email,
                            subject: config.subject,
                            message: [
                                `Program: ${config.title}`,
                                `Organisation: ${this.fields.organisation}`,
                                this.fields.website ? `Website / handle: ${this.fields.website}` : null,
                                this.fields.offerFocus ? `Offer focus: ${this.fields.offerFocus}` : null,
                                this.fields.region ? `Regions served: ${this.fields.region}` : null,
                                this.fields.notes ? `Notes: ${this.fields.notes}` : null,
                            ].filter(Boolean).join('\n'),
                        }),
                    });

                    if (!response.ok) {
                        throw new Error('Failed request');
                    }

                    this.success = config.successCopy || 'Thank you — we will reply shortly.';
                    this.fields = {
                        name: '',
                        email: '',
                        organisation: '',
                        website: '',
                        offerFocus: '',
                        region: '',
                        notes: '',
                    };
                } catch (error) {
                    console.warn('Partner form error', error);
                    this.error = 'Could not send your note. Please try again or email partnerships@athena.';
                } finally {
                    this.submitting = false;
                }
            },
        };
    };
</script>
@endpush
