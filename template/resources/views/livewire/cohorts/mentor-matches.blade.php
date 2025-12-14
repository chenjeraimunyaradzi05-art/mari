<div class="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
    <header class="flex items-baseline justify-between gap-4 pb-4">
        <span class="text-xs font-semibold uppercase tracking-widest text-fuchsia-700 dark:text-fuchsia-300">Mentor matches</span>
        <strong class="text-lg font-semibold text-slate-900 dark:text-white">{{ count($matches) }} recommendations</strong>
    </header>

    <ul class="space-y-3">
        @forelse($matches as $match)
            <li class="rounded-2xl border border-slate-200/60 bg-slate-50/80 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/70">
                <div class="flex items-start justify-between gap-3">
                    <h4 class="text-base font-semibold text-slate-900 dark:text-white">{{ $match['mentor'] }}</h4>
                    <span class="inline-flex shrink-0 items-center rounded-full bg-fuchsia-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-200">{{ $match['fit_score'] ?? '—' }} fit</span>
                </div>
                <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Focus: {{ $match['focus_area'] ?? 'General guidance' }}</p>
                @if(! empty($match['next_session']))
                    <span class="mt-2 inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700/60 dark:text-slate-200">Next session: {{ $match['next_session'] }}</span>
                @endif
                <button type="button" class="mt-4 inline-flex items-center justify-center rounded-full bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-500 dark:bg-fuchsia-500 dark:hover:bg-fuchsia-400">{{ $match['cta'] ?? 'Request intro' }}</button>
            </li>
        @empty
            <li class="rounded-2xl border border-dashed border-slate-300/70 bg-white/60 p-4 text-sm text-slate-500 shadow-inner dark:border-slate-600/70 dark:bg-slate-800/40 dark:text-slate-400">No mentor suggestions right now—complete your learning focus to unlock matches.</li>
        @endforelse
    </ul>
</div>
