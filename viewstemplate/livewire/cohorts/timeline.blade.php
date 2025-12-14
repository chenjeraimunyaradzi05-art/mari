<div class="space-y-4" aria-live="polite">
    <div class="flex items-center justify-between">
        <div>
            <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">AI Activity Timeline</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">Latest nudges and activation steps dispatched outside the dashboard.</p>
        </div>
        <button type="button" wire:click="refreshEvents" class="inline-flex items-center gap-2 rounded-full border border-slate-300/70 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-teal-400 hover:text-teal-600 dark:border-slate-600 dark:text-slate-300 dark:hover:border-teal-300 dark:hover:text-teal-200">
            <span>Refresh</span>
        </button>
    </div>

    <div class="space-y-3">
        @forelse($events as $event)
            <article class="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300/80 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-900/60" aria-label="Timeline event">
                <header class="flex flex-wrap items-center gap-3">
                    <h3 class="text-base font-semibold text-slate-900 dark:text-slate-100">{{ $event['headline'] }}</h3>
                    @if(! empty($event['subject']))
                        <span class="inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-700 dark:bg-teal-500/20 dark:text-teal-200">{{ $event['subject'] }}</span>
                    @endif
                    <span class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{{ $event['occurred_at'] }}</span>
                </header>
                @if(! empty($event['summary']))
                    <p class="mt-3 text-sm text-slate-600 dark:text-slate-300">{{ $event['summary'] }}</p>
                @endif

                @if(! empty($event['activation_steps']))
                    <div class="mt-4 space-y-2">
                        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Activation steps</p>
                        <ul class="space-y-2">
                            @foreach($event['activation_steps'] as $step)
                                <li class="rounded-2xl border border-slate-200/60 bg-slate-50/70 px-4 py-3 text-sm text-slate-700 dark:border-slate-600/60 dark:bg-slate-800/70 dark:text-slate-200">
                                    {{ is_array($step) ? ($step['label'] ?? '') : $step }}
                                </li>
                            @endforeach
                        </ul>
                    </div>
                @endif

                @if(! empty($event['values_alignment']))
                    <div class="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        @foreach($event['values_alignment'] as $value)
                            <span class="inline-flex items-center rounded-full border border-slate-200/60 px-3 py-1 text-[11px] dark:border-slate-600/60">{{ is_array($value) ? ($value['pillar'] ?? $value['label'] ?? '') : $value }}</span>
                        @endforeach
                    </div>
                @endif

                <footer class="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                    @if(! empty($event['provider']))
                        <span>Provider: {{ $event['provider'] }}</span>
                    @endif
                    @if(! empty($event['score']))
                        <span>Match score: {{ $event['score'] }}</span>
                    @endif
                </footer>
            </article>
        @empty
            <p class="rounded-3xl border border-dashed border-slate-300/70 bg-white/70 px-6 py-8 text-center text-sm text-slate-500 dark:border-slate-600/70 dark:bg-slate-900/40 dark:text-slate-400">We will post new AI guidance here as soon as the next recommendation fires.</p>
        @endforelse
    </div>
</div>
