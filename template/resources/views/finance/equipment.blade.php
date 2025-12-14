@php
    use Illuminate\Support\Carbon;
    use Illuminate\Support\Str;

    $aiConciergeSurface = 'finance_equipment';
    $aiContextKey = 'equipment_finance_focus';
    $aiConciergePayloads = [
        $aiContextKey => [
            'context' => $aiContext['context'] ?? 'business-legal-foundations',
            'title' => $aiContext['title'] ?? 'Equipment financing explainer',
            'guardrails' => $aiContext['guardrails'] ?? null,
            'context_payload' => [
                'summary' => sprintf(
                    'Tracking %d facilities totalling %s with %s in monthly repayments.',
                    $loanSummary['active_facilities'] ?? 0,
                    money_format($loanSummary['total_balance'] ?? 0),
                    money_format($loanSummary['monthly_payment'] ?? 0)
                ),
                'loan_summary' => $loanSummary,
                'lenders' => $lenders,
                'timeline' => $timeline,
            ],
        ],
    ];
    $aiEntryRoute = config('app.platform.ai_entry_route', 'ai.concierge');
    $aiEntryUrl = \Illuminate\Support\Facades\Route::has($aiEntryRoute) ? route($aiEntryRoute) : url('/ai');
@endphp

@extends('layouts.app')

@section('title', 'Equipment financing workspace')

@section('navigation')
    <div aria-hidden="true" class="hidden"></div>
@endsection

@section('suppress-welcome-card')
    1
@endsection

@section('content')
<div class="mx-auto flex max-w-6xl flex-col gap-10 px-4 sm:px-6 lg:px-8">
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-3xl border border-slate-100 bg-white/90 p-5 shadow-sm">
            <p class="text-xs uppercase tracking-[0.35em] text-slate-400">Total financed</p>
            <p class="mt-2 text-3xl font-semibold text-slate-900">{{ money_format($loanSummary['total_balance']) }}</p>
            <p class="text-sm text-slate-500">Blended debt pool currently serviced.</p>
        </div>
        <div class="rounded-3xl border border-slate-100 bg-white/90 p-5 shadow-sm">
            <p class="text-xs uppercase tracking-[0.35em] text-slate-400">Monthly repayments</p>
            <p class="mt-2 text-3xl font-semibold text-slate-900">{{ money_format($loanSummary['monthly_payment']) }}</p>
            <p class="text-sm text-slate-500">Includes leases, LOC, and asset finance.</p>
        </div>
        <div class="rounded-3xl border border-slate-100 bg-white/90 p-5 shadow-sm">
            <p class="text-xs uppercase tracking-[0.35em] text-slate-400">Average rate</p>
            <p class="mt-2 text-3xl font-semibold text-slate-900">{{ number_format($loanSummary['avg_rate'], 2) }}<span class="text-base font-medium">%</span></p>
            <p class="text-sm text-slate-500">Weighted across all active facilities.</p>
        </div>
        <div class="rounded-3xl border border-slate-100 bg-white/90 p-5 shadow-sm">
            <p class="text-xs uppercase tracking-[0.35em] text-slate-400">Facilities</p>
            <p class="mt-2 text-3xl font-semibold text-slate-900">{{ $loanSummary['active_facilities'] }}</p>
            <p class="text-sm text-slate-500">Any overdue, cross-collateral, or seasonal.</p>
        </div>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section class="rounded-3xl border border-slate-100 bg-white/95 p-6 shadow-sm lg:col-span-2">
            <div class="flex flex-col gap-2 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-xs uppercase tracking-[0.4em] text-slate-400">Active facilities</p>
                    <h2 class="text-xl font-semibold text-slate-900">Current equipment exposure</h2>
                </div>
                <p class="text-sm text-slate-500">Updated whenever a debt record syncs.</p>
            </div>
            <div class="divide-y divide-slate-100">
                @forelse($loans as $loan)
                    <article class="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p class="text-base font-semibold text-slate-900">{{ $loan['name'] }}</p>
                            <p class="text-sm text-slate-500">{{ number_format($loan['rate'], 2) }}% variable · {{ money_format($loan['min_payment']) }} minimum</p>
                        </div>
                        <div class="text-right">
                            <p class="text-2xl font-semibold text-slate-900">{{ money_format($loan['balance']) }}</p>
                            <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Outstanding</p>
                        </div>
                    </article>
                @empty
                    <p class="py-10 text-center text-sm text-slate-500">No equipment facilities are saved yet. Import your debt schedule or sync a bank feed to begin.</p>
                @endforelse
            </div>
        </section>
        <section class="rounded-3xl border border-slate-100 bg-white/95 p-6 shadow-sm">
            <p class="text-xs uppercase tracking-[0.45em] text-slate-400">Scenario studio</p>
            <h2 class="mt-2 text-xl font-semibold text-slate-900">Refinance simulations</h2>
            <p class="text-sm text-slate-500">Blended payouts with kinder terms and instant savings vs current minimums.</p>
            <div class="mt-5 space-y-4">
                @foreach($scenarios as $scenario)
                    <article class="rounded-2xl border border-violet-100 bg-gradient-to-b from-violet-50 to-white p-5 shadow-inner">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-semibold text-slate-600">{{ $scenario['term_months'] }} month term</p>
                                <p class="text-xs text-slate-500">Rate {{ number_format($scenario['rate'], 2) }}%</p>
                            </div>
                            <p class="text-2xl font-semibold text-slate-900">{{ money_format($scenario['monthly_payment']) }}/mo</p>
                        </div>
                        <dl class="mt-4 grid grid-cols-2 gap-3 text-xs">
                            <div class="rounded-2xl bg-white/70 p-3">
                                <dt class="uppercase tracking-[0.3em] text-slate-400">Total paid</dt>
                                <dd class="mt-1 text-base font-semibold text-slate-900">{{ money_format($scenario['total_paid']) }}</dd>
                            </div>
                            <div class="rounded-2xl bg-white/70 p-3">
                                <dt class="uppercase tracking-[0.3em] text-slate-400">Interest</dt>
                                <dd class="mt-1 text-base font-semibold text-slate-900">{{ money_format($scenario['total_interest']) }}</dd>
                            </div>
                            <div class="rounded-2xl bg-white/70 p-3 col-span-2">
                                <dt class="uppercase tracking-[0.3em] text-slate-400">Savings vs current</dt>
                                <dd class="mt-1 text-base font-semibold {{ $scenario['savings_vs_current'] >= 0 ? 'text-emerald-600' : 'text-rose-600' }}">{{ money_format($scenario['savings_vs_current']) }}</dd>
                            </div>
                        </dl>
                    </article>
                @endforeach
            </div>
        </section>
    </div>

    <section class="rounded-3xl border border-slate-100 bg-white/95 p-6 shadow-sm">
        <div class="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
            <div>
                <p class="text-xs uppercase tracking-[0.4em] text-slate-400">Partner lenders</p>
                <h2 class="text-xl font-semibold text-slate-900">Aligned capital stack</h2>
            </div>
            <p class="text-sm text-slate-500">Regional, First Nations, and specialty equipment partners already briefed.</p>
        </div>
        <div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            @foreach($lenders as $lender)
                <article class="rounded-3xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white p-5 shadow-sm">
                    <p class="text-sm font-semibold text-slate-900">{{ $lender['name'] }}</p>
                    <p class="text-xs text-slate-500">{{ $lender['range'] }} · {{ $lender['ticket'] }}</p>
                    <p class="mt-2 text-sm text-slate-500">SLA {{ $lender['sla'] }}</p>
                    <div class="mt-3 flex flex-wrap gap-2">
                        @foreach($lender['focus'] as $focus)
                            <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{{ $focus }}</span>
                        @endforeach
                    </div>
                </article>
            @endforeach
        </div>
    </section>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section class="rounded-3xl border border-slate-100 bg-white/95 p-6 shadow-sm">
            <p class="text-xs uppercase tracking-[0.4em] text-slate-400">Document runway</p>
            <h2 class="mt-2 text-xl font-semibold text-slate-900">What lenders expect</h2>
            <div class="mt-4 space-y-4">
                @foreach($documents as $document)
                    <article class="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                        <p class="text-sm font-semibold text-slate-900">{{ $document['title'] }}</p>
                        <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                            @foreach($document['items'] as $item)
                                <li>{{ $item }}</li>
                            @endforeach
                        </ul>
                    </article>
                @endforeach
            </div>
        </section>
        <section class="rounded-3xl border border-slate-100 bg-white/95 p-6 shadow-sm">
            <p class="text-xs uppercase tracking-[0.4em] text-slate-400">Funding timeline</p>
            <h2 class="mt-2 text-xl font-semibold text-slate-900">From intake to settlement</h2>
            <ol class="mt-6 space-y-4">
                @foreach($timeline as $index => $step)
                    <li class="flex gap-4">
                        <div class="flex flex-col items-center">
                            <span class="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">{{ $step['label'] }}</span>
                            @if(!$loop->last)
                                <span class="mt-1 h-full w-px flex-1 bg-slate-200"></span>
                            @endif
                        </div>
                        <div class="rounded-2xl bg-slate-50/70 p-4 shadow-inner">
                            <p class="text-sm font-semibold text-slate-900">{{ $step['title'] }}</p>
                            <p class="text-sm text-slate-600">{{ $step['detail'] }}</p>
                        </div>
                    </li>
                @endforeach
            </ol>
        </section>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section class="rounded-3xl border border-slate-100 bg-white/95 p-6 shadow-sm">
            <p class="text-xs uppercase tracking-[0.4em] text-slate-400">Bank pulse</p>
            <h2 class="mt-2 text-xl font-semibold text-slate-900">Recent equipment spend</h2>
            <div class="mt-4 divide-y divide-slate-100">
                @forelse($transactions as $transaction)
                    @php
                        $postedAt = $transaction['posted_at'] ?? null;
                        $date = $postedAt ? Carbon::parse($postedAt) : null;
                        $amount = (float) ($transaction['amount'] ?? 0);
                    @endphp
                    <article class="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p class="text-base font-semibold text-slate-900">{{ $transaction['description'] }}</p>
                            <p class="text-sm text-slate-500">{{ $date ? $date->format('d M Y') : 'Date pending' }}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-lg font-semibold {{ $amount >= 0 ? 'text-emerald-600' : 'text-rose-600' }}">{{ money_format($amount) }}</p>
                            <p class="text-xs text-slate-500">{{ Str::headline($transaction['status'] ?? 'pending') }}</p>
                        </div>
                    </article>
                @empty
                    <p class="py-10 text-center text-sm text-slate-500">No transactions detected yet. Connect a bank feed to activate live monitoring.</p>
                @endforelse
            </div>
        </section>
        <section class="rounded-3xl border border-slate-900/10 bg-slate-900 p-6 text-white shadow-xl">
            <p class="text-xs uppercase tracking-[0.4em] text-white/60">Tap Athena</p>
            <h2 class="mt-2 text-2xl font-semibold">Need a calmer read on lender options?</h2>
            <p class="mt-3 text-sm text-white/80">{{ $aiContext['guardrails'] ?? 'Educational reflections only.' }}</p>
            <div class="mt-6 flex flex-col gap-3 sm:flex-row">
                <a
                    href="{{ $aiEntryUrl }}?context={{ $aiContextKey }}"
                    class="flex-1 rounded-3xl bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-500 px-5 py-3 text-center text-sm font-semibold text-white shadow-lg transition hover:shadow-xl"
                >
                    Ask about equipment financing
                </a>
                <a href="{{ $aiEntryUrl }}" class="flex-1 rounded-3xl border border-white/30 px-5 py-3 text-center text-sm font-semibold text-white/90 transition hover:bg-white/10">
                    Open full concierge
                </a>
            </div>
            <p class="mt-4 text-xs text-white/70">Context: {{ $aiContext['title'] }}</p>
        </section>
    </div>
</div>
@endsection
