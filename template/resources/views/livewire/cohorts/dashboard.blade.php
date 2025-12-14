<div class="space-y-8 lg:space-y-10">
    <section class="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-sm backdrop-blur-sm sm:p-8 dark:border-slate-700/60 dark:bg-slate-900/60" aria-label="Hero summary">
        <div class="flex flex-col gap-2 sm:gap-3">
            <h1 class="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">{{ $hero['headline'] ?? 'Welcome back' }}</h1>
            <p class="text-sm font-medium uppercase tracking-widest text-teal-700/80 dark:text-teal-300">Persona: {{ $hero['persona'] ?? 'WomenRise member' }}</p>
        </div>
        <div class="mt-6 grid gap-4 sm:grid-cols-3">
            <div class="flex flex-col gap-1 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/70" aria-label="Readiness score">
                <span class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Readiness</span>
                <span class="text-xl font-semibold text-slate-900 dark:text-white">{{ $hero['readiness_score'] ?? 0 }}%</span>
            </div>
            <div class="flex flex-col gap-1 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/70" aria-label="Savings progress">
                <span class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Savings</span>
                <span class="text-xl font-semibold text-slate-900 dark:text-white">{{ $hero['savings']['percent'] ?? 0 }}%</span>
                <small class="text-xs font-medium text-slate-500 dark:text-slate-300">{{ number_format($hero['savings']['current'] ?? 0, 2) }} / {{ number_format($hero['savings']['target'] ?? 0, 2) }}</small>
            </div>
            @if(! empty($hero['next_milestone']))
                <div class="flex flex-col gap-1 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/70" aria-label="Next milestone">
                    <span class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Next milestone</span>
                    <span class="text-xl font-semibold text-slate-900 dark:text-white">{{ $hero['next_milestone'] }}</span>
                </div>
            @endif
        </div>
        <p class="mt-6 text-sm font-medium text-slate-600 dark:text-slate-200">{{ $hero['ai_tip'] ?? 'Stay consistent with your next actions.' }}</p>
    </section>

    <section class="rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-sm sm:p-7 dark:border-slate-700/60 dark:bg-slate-900/60" aria-label="Quick actions">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Quick Actions</h2>
        <ul class="mt-4 grid gap-3 sm:grid-cols-2">
            @forelse($quickActions as $action)
                <li class="rounded-2xl border border-slate-200/60 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/70 dark:text-slate-200">{{ $action }}</li>
            @empty
                <li class="rounded-2xl border border-slate-200/60 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/70 dark:text-slate-200">Add a new goal to personalise your dashboard.</li>
            @endforelse
        </ul>
    </section>

    <div class="grid gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-live="polite">
        @foreach($widgets as $index => $widget)
            <div class="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700/60 dark:bg-slate-900/60" data-widget="{{ $widget['type'] }}">
                <header class="flex items-center justify-between gap-3">
                    <h3 class="text-base font-semibold text-slate-900 dark:text-slate-100">{{ $widget['label'] }}</h3>
                    @if(! empty($widget['pinned']))
                        <span class="inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-700 dark:bg-teal-500/20 dark:text-teal-200">Pinned</span>
                    @endif
                </header>

                <div class="mt-4 space-y-4 text-sm text-slate-600 dark:text-slate-200">
                    @switch($widget['type'])
                        @case('goal_tracker')
                            @livewire('goals.tracker', [
                                'profileId' => $profileId,
                                'summary' => $modules['goal_tracker'] ?? [],
                            ], key('goal-tracker-'.$profileId.'-'.$index))
                            @break

                        @case('mortgage_widget')
                            @livewire('mortgage.widget', [
                                'profileId' => $profileId,
                                'insight' => $modules['mortgage_widget'] ?? [],
                            ], key('mortgage-widget-'.$profileId.'-'.$index))
                            @break

                        @case('mentor_matches')
                            @livewire('cohorts.mentor-matches', [
                                'profileId' => $profileId,
                                'matches' => $modules['mentor_matches'] ?? [],
                            ], key('mentor-matches-'.$profileId.'-'.$index))
                            @break

                        @case('partner_opportunities')
                            @livewire('partners.opportunities', [
                                'profileId' => $profileId,
                                'projects' => $modules['partner_opportunities'] ?? [],
                            ], key('partner-opportunities-'.$profileId.'-'.$index))
                            @break

                        @case('recommended_listings')
                            <ul class="space-y-4">
                                @foreach(($modules['recommended_listings'] ?? []) as $listing)
                                    <li class="rounded-2xl border border-slate-200/60 bg-slate-50/70 p-4 shadow-sm transition hover:border-teal-400/60 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800/70">
                                        <a href="{{ $listing['url'] ?? '#' }}" class="flex flex-col gap-2 text-slate-700 hover:text-teal-700 dark:text-slate-200 dark:hover:text-teal-300">
                                            <h4 class="text-sm font-semibold">{{ $listing['title'] }}</h4>
                                            <p class="text-sm text-slate-600 dark:text-slate-300">{{ $listing['summary'] }}</p>
                                            <span class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Trust: {{ $listing['trust_score'] ?? 'N/A' }} · Market: {{ $listing['market_score'] ?? 'N/A' }}</span>
                                        </a>
                                    </li>
                                @endforeach
                            </ul>
                            @break

                        @case('ai_nudges')
                            <ul class="space-y-3">
                                @forelse(($modules['ai_nudges'] ?? []) as $nudge)
                                    <li class="rounded-2xl border border-slate-200/60 bg-slate-50/80 p-3 text-sm shadow-sm dark:border-slate-700/60 dark:bg-slate-800/70">{{ $nudge }}</li>
                                @empty
                                    <li class="rounded-2xl border border-dashed border-slate-300/70 p-6 text-center text-sm text-slate-500 dark:border-slate-600/60 dark:text-slate-400">No new nudges—you're caught up!</li>
                                @endforelse
                            </ul>
                            @break

                        @default
                            <p class="rounded-2xl border border-dashed border-slate-300/70 p-6 text-center text-sm text-slate-500 dark:border-slate-600/60 dark:text-slate-400">Module coming soon.</p>
                    @endswitch
                </div>
            </div>
        @endforeach
    </div>
</div>
