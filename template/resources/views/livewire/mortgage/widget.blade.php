<div class="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
    @php
        $aiGuidance = $insight['ai_guidance'] ?? [];
        $sustainability = $aiGuidance['sustainability_plan'] ?? ($insight['notes']['sustainability_plan'] ?? []);
        $aiProvider = $aiGuidance['provider'] ?? ($insight['notes']['ai_provider'] ?? null);
        $aiActions = $aiGuidance['next_actions'] ?? [];
    @endphp

    <header class="flex flex-wrap items-baseline justify-between gap-4 pb-4">
        <div class="flex flex-col">
            <span class="text-xs font-semibold uppercase tracking-widest text-teal-700 dark:text-teal-300">Mortgage readiness</span>
            @if(! empty($aiGuidance['headline']))
                <p class="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">{{ $aiGuidance['headline'] }}</p>
            @endif
        </div>
        <div class="flex items-center gap-3">
            @if($aiProvider)
                <span class="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">AI: {{ \Illuminate\Support\Str::upper($aiProvider) }}</span>
            @endif
            <strong class="text-lg font-semibold text-slate-900 dark:text-white">Deposit ratio {{ number_format($insight['deposit_ratio'] ?? 0, 2) }}</strong>
        </div>
    </header>

    <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="rounded-2xl border border-slate-200/60 bg-slate-50/80 p-4 text-sm font-medium text-slate-600 dark:border-slate-700/60 dark:bg-slate-800/70 dark:text-slate-200">
            <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Target price</dt>
            <dd class="mt-1 text-base font-semibold text-slate-900 dark:text-white">${{ number_format($insight['target_price'] ?? 0, 0) }}</dd>
        </div>
        <div class="rounded-2xl border border-slate-200/60 bg-slate-50/80 p-4 text-sm font-medium text-slate-600 dark:border-slate-700/60 dark:bg-slate-800/70 dark:text-slate-200">
            <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Current savings</dt>
            <dd class="mt-1 text-base font-semibold text-slate-900 dark:text-white">${{ number_format($insight['current_savings'] ?? 0, 0) }}</dd>
        </div>
        <div class="rounded-2xl border border-slate-200/60 bg-slate-50/80 p-4 text-sm font-medium text-slate-600 dark:border-slate-700/60 dark:bg-slate-800/70 dark:text-slate-200">
            <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Monthly repayment</dt>
            <dd class="mt-1 text-base font-semibold text-slate-900 dark:text-white">${{ number_format($insight['repayments']['monthly'] ?? 0, 2) }}</dd>
        </div>
        <div class="rounded-2xl border border-slate-200/60 bg-slate-50/80 p-4 text-sm font-medium text-slate-600 dark:border-slate-700/60 dark:bg-slate-800/70 dark:text-slate-200">
            <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Risk rating</dt>
            <dd>
                @php $risk = $insight['risk_rating'] ?? 'medium'; @endphp
                <span @class([
                    'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
                    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200' => $risk === 'low',
                    'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200' => $risk === 'medium',
                    'bg-rose-50 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200' => $risk === 'high',
                ])>{{ ucfirst($risk) }}</span>
            </dd>
        </div>
    </dl>

    <section class="mt-6 space-y-3">
        <h4 class="text-sm font-semibold text-slate-900 dark:text-slate-100">Grant checklist</h4>
        <ul class="space-y-2">
            @forelse($insight['grant_checklist'] ?? [] as $item)
                @php $status = $item['status'] ?? null; @endphp
                <li @class([
                    'flex items-start gap-3 rounded-2xl px-4 py-3 text-sm shadow-sm',
                    'border-slate-200/60 bg-slate-50/80 text-slate-600 dark:border-slate-700/60 dark:bg-slate-800/70 dark:text-slate-300' => ! in_array($status, ['complete', 'action-needed'], true),
                    'border-teal-200/70 bg-teal-50/70 text-teal-700 dark:border-teal-500/40 dark:bg-teal-500/10 dark:text-teal-200' => $status === 'complete',
                    'border-amber-200/70 bg-amber-50/70 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200' => $status === 'action-needed',
                ])>{{ $item['label'] }}</li>
            @empty
                <li class="rounded-2xl border border-dashed border-slate-300/70 px-4 py-3 text-sm text-slate-500 dark:border-slate-600/70 dark:text-slate-400">No grant items yet—complete your financial profile.</li>
            @endforelse
        </ul>
    </section>

    <section class="mt-6 space-y-3">
        <h4 class="text-sm font-semibold text-slate-900 dark:text-slate-100">Next actions</h4>
        <ul class="space-y-2">
            @foreach(($insight['next_actions'] ?? []) as $action)
                <li class="rounded-2xl border border-slate-200/60 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/70 dark:text-slate-300">{{ $action }}</li>
            @endforeach
        </ul>
    </section>

    @if($aiActions !== [])
        <section class="mt-6 space-y-3">
            <div class="flex items-center justify-between">
                <h4 class="text-sm font-semibold text-slate-900 dark:text-slate-100">AI climate-positive plan</h4>
                @if(isset($sustainability['carbon_score']))
                    <span class="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">Carbon score {{ $sustainability['carbon_score'] }}</span>
                @endif
            </div>
            <ul class="space-y-2">
                @foreach($aiActions as $action)
                    <li class="rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-3 text-sm shadow-sm dark:border-slate-700/60 dark:bg-slate-800/70">
                        <p class="font-medium text-slate-800 dark:text-slate-100">{{ $action['label'] ?? $action }}</p>
                        <div class="mt-2 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                            @if(! empty($action['impact']))
                                <span class="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-1 text-teal-700 dark:bg-teal-500/20 dark:text-teal-200">Impact: {{ \Illuminate\Support\Str::headline($action['impact']) }}</span>
                            @endif
                            @if(! empty($action['urgency']))
                                <span class="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">{{ \Illuminate\Support\Str::headline($action['urgency']) }}</span>
                            @endif
                        </div>
                    </li>
                @endforeach
            </ul>
        </section>
    @endif

    @if($sustainability)
        <section class="mt-6 space-y-3">
            <h4 class="text-sm font-semibold text-slate-900 dark:text-slate-100">Sustainability commitments</h4>
            <dl class="grid gap-4 sm:grid-cols-3">
                @if(isset($sustainability['flora_fauna_support']))
                    <div class="rounded-2xl border border-emerald-200/60 bg-emerald-50/70 p-4 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                        <dt class="text-xs font-semibold uppercase tracking-wide">Flora & fauna</dt>
                        <dd class="mt-1">{{ $sustainability['flora_fauna_support'] }}</dd>
                    </div>
                @endif
                @if(isset($sustainability['community_equity']))
                    <div class="rounded-2xl border border-violet-200/60 bg-violet-50/70 p-4 text-sm text-violet-900 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200">
                        <dt class="text-xs font-semibold uppercase tracking-wide">Community equity</dt>
                        <dd class="mt-1">{{ $sustainability['community_equity'] }}</dd>
                    </div>
                @endif
                @if(isset($sustainability['carbon_score']))
                    <div class="rounded-2xl border border-sky-200/60 bg-sky-50/70 p-4 text-sm text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
                        <dt class="text-xs font-semibold uppercase tracking-wide">Carbon uplift</dt>
                        <dd class="mt-1">Projected score {{ $sustainability['carbon_score'] }} / 100</dd>
                    </div>
                @endif
            </dl>
        </section>
    @endif

    @if(! empty($insight['notes']['commentary']))
        <p class="mt-6 rounded-2xl border border-teal-200/70 bg-teal-50/70 px-4 py-3 text-sm text-teal-800 dark:border-teal-500/40 dark:bg-teal-500/10 dark:text-teal-200">{{ $insight['notes']['commentary'] }}</p>
    @endif
</div>
