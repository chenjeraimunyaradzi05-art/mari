<div class="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
    <header class="flex items-baseline justify-between gap-4 pb-4">
        <span class="text-xs font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-300">Collaboration</span>
        <strong class="text-lg font-semibold text-slate-900 dark:text-white">{{ count($projects) }} active projects</strong>
    </header>

    <ul class="space-y-3">
        @forelse($projects as $project)
            <li class="rounded-2xl border border-slate-200/60 bg-slate-50/80 p-4 shadow-sm transition dark:border-slate-700/60 dark:bg-slate-800/70">
                <div class="flex items-start justify-between gap-3">
                    <h4 class="text-base font-semibold text-slate-900 dark:text-white">{{ $project['title'] }}</h4>
                    <div class="flex items-center gap-2">
                        @if(! empty($project['ai_provider']))
                            <span class="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">AI: {{ \Illuminate\Support\Str::upper($project['ai_provider']) }}</span>
                        @endif
                        <span class="inline-flex shrink-0 items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">{{ $project['match_score'] ?? '—' }} fit</span>
                    </div>
                </div>
                <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">{{ $project['summary'] }}</p>
                @if(! empty($project['ai_summary']))
                    <p class="mt-2 rounded-2xl border border-teal-200/60 bg-teal-50/70 px-3 py-2 text-sm text-teal-800 dark:border-teal-500/40 dark:bg-teal-500/10 dark:text-teal-100">{{ $project['ai_summary'] }}</p>
                @endif
                <div class="mt-3 flex flex-wrap gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <span class="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-700/60">Lead: {{ $project['owner'] ?? 'WomenRise member' }}</span>
                    @if(! empty($project['launch_at']))
                        <span class="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-700/60">Launch: {{ $project['launch_at'] }}</span>
                    @endif
                </div>
                @if(! empty($project['values_alignment']))
                    <div class="mt-3 flex flex-wrap gap-2">
                        @foreach($project['values_alignment'] as $alignment)
                            @php
                                $pillar = \Illuminate\Support\Str::headline($alignment['pillar'] ?? 'equity');
                                $confidence = \Illuminate\Support\Str::headline($alignment['confidence'] ?? 'medium');
                            @endphp
                            <span class="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">{{ $pillar }} · {{ $confidence }}</span>
                        @endforeach
                    </div>
                @endif
                @if(! empty($project['activation_steps']))
                    <div class="mt-4">
                        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Activation steps</p>
                        <ul class="mt-2 space-y-2">
                            @foreach($project['activation_steps'] as $step)
                                <li class="rounded-2xl border border-slate-200/60 bg-white/70 px-3 py-2 text-sm text-slate-700 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/70 dark:text-slate-200">
                                    <span class="font-medium">{{ $step['label'] ?? $step }}</span>
                                    @if(! empty($step['urgency']))
                                        <span class="ml-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">{{ \Illuminate\Support\Str::headline($step['urgency']) }}</span>
                                    @endif
                                </li>
                            @endforeach
                        </ul>
                    </div>
                @endif
            </li>
        @empty
            <li class="rounded-2xl border border-dashed border-slate-300/70 bg-white/60 p-4 text-sm text-slate-500 shadow-inner dark:border-slate-600/70 dark:bg-slate-800/40 dark:text-slate-400">No partner opportunities yet. Build your investor profile to unlock tailored matches.</li>
        @endforelse
    </ul>
</div>
