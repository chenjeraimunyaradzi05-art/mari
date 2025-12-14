<div class="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
    <header class="flex items-baseline justify-between gap-4 pb-4">
        <span class="text-xs font-semibold uppercase tracking-widest text-teal-700 dark:text-teal-300">Overall progress</span>
        <strong class="text-lg font-semibold text-slate-900 dark:text-white">{{ $overallProgress ?? 0 }}%</strong>
    </header>

    <ul class="space-y-4">
        @forelse($goals as $goal)
            <li class="rounded-2xl border border-slate-200/60 bg-slate-50/80 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/70">
                <div class="flex items-center justify-between gap-2">
                    <h4 class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ $goal['label'] }}</h4>
                    <span class="text-sm font-semibold text-teal-700 dark:text-teal-300">{{ $goal['progress'] ?? 0 }}%</span>
                </div>
                <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">{{ number_format($goal['current'] ?? 0, 2) }} / {{ number_format($goal['target'] ?? 0, 2) }}</p>
                @if(! empty($goal['ai_nudges']))
                    <ul class="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                        @foreach($goal['ai_nudges'] as $nudge)
                            <li>{{ $nudge }}</li>
                        @endforeach
                    </ul>
                @endif
            </li>
        @empty
            <li class="rounded-2xl border border-dashed border-slate-300/70 p-4 text-center text-sm text-slate-500 dark:border-slate-600/70 dark:text-slate-400">Set up your savings or investment goals to unlock tailored guidance.</li>
        @endforelse
    </ul>
</div>
