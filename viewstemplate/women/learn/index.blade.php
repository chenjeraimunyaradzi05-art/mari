@extends('layouts.app')



@section('content')
    <div class="learning-page relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900/95 to-indigo-950 text-slate-100">
        <section class="mx-auto flex min-h-[24rem] w-full max-w-7xl flex-col gap-8 px-4 py-20 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div class="space-y-6 lg:w-3/5">
                <span class="inline-flex items-center gap-2 rounded-full bg-indigo-500/30 px-6 py-2.5 text-sm font-semibold uppercase tracking-[0.24em] text-indigo-100">WomenRise Learning</span>
                <h1 class="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                    Real estate pathways that honour women-led momentum
                </h1>
                <p class="max-w-3xl text-xl text-slate-200 lg:text-2xl">
                    Curated cohorts, lender clinics, and wraparound financial intelligence designed for women moving through the real estate journey. Enrol once and we will surface AI-assisted check-ins, accountability prompts, and peer sessions.
                </p>
                <div class="flex flex-wrap gap-3 text-base text-indigo-100">
                    <span class="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 font-semibold shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Cohort-based accountability
                    </span>
                    <span class="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 font-semibold shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6l4 2" />
                        </svg>
                        AI nudges & workshops
                    </span>
                    <span class="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 font-semibold shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17.657 16.657L13.414 12.414A2 2 0 0113 11.172V7a1 1 0 10-2 0v4.172a2 2 0 01-.586 1.414l-4.243 4.243" />
                        </svg>
                        Designed for Australian markets
                    </span>
                </div>
            </div>
            <div class="relative flex w-full max-w-sm flex-col gap-5 rounded-3xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-fuchsia-500 p-10 text-white shadow-2xl lg:w-2/5">
                <div class="text-sm uppercase tracking-[0.3em] text-white/70">How it works</div>
                <p class="text-xl font-semibold leading-relaxed text-white/90">
                    Pick a path, commit to weekly actions, and our mortgage and partnership engines will adapt around your progress. Drop out anytime—no stigma, just pace resetting.
                </p>
                <p class="text-base text-white/80">
                    Already enrolled paths appear below with progress meters. Your mentor circle receives an update every Friday.
                </p>
            </div>
        </section>

    <section id="learning-momentum-dashboard" class="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8" data-chart-root>
            <div class="space-y-10">
                <div class="learning-metrics__grid">
                    @foreach ($dashboardStats as $stat)
                        @php
                            $value = $stat['value'];
                            $suffix = $stat['suffix'] ?? null;
                            if (is_numeric($value)) {
                                $numericValue = (float) $value;
                                $display = abs($numericValue - round($numericValue)) < 0.001
                                    ? number_format((int) round($numericValue))
                                    : number_format($numericValue, 1);
                            } else {
                                $display = $value;
                            }
                            $display .= $suffix ? $suffix : '';
                        @endphp
                        <div class="stat-panel">
                            <span class="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-200/70">{{ $stat['label'] }}</span>
                            <strong>{{ $display }}</strong>
                            <p class="mt-2 text-sm text-slate-300/80">Live telemetry across WomenRise learning cohorts.</p>
                        </div>
                    @endforeach
                </div>

                <div class="radial-separator"></div>

                <div class="grid gap-6 lg:grid-cols-2">
                    <div class="chart-panel chart-3d">
                        <div class="mb-4 flex items-center justify-between">
                            <div>
                                <h3 class="text-lg font-semibold text-white">Status Momentum</h3>
                                <p class="text-sm text-slate-300/80">Active vs completion vs pause signals, refreshed every load.</p>
                            </div>
                        </div>
                        <canvas id="statusDistributionChart" height="260"></canvas>
                    </div>
                    <div class="chart-panel">
                        <div class="mb-4 flex items-center justify-between">
                            <div>
                                <h3 class="text-lg font-semibold text-white">Progress Velocity</h3>
                                <p class="text-sm text-slate-300/80">Average progress captured from the last two weeks of check-ins.</p>
                            </div>
                        </div>
                        <canvas id="progressTrendChart" height="220"></canvas>
                    </div>
                </div>

                <div class="chart-panel">
                    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 class="text-lg font-semibold text-white">Path Performance Pulse</h3>
                            <p class="text-sm text-slate-300/80">Active and completed enrolments per path with average completion momentum.</p>
                        </div>
                    </div>
                    <canvas id="pathPerformanceChart" height="240"></canvas>
                </div>
            </div>
        </section>

        <div class="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
            @if (session('status'))
                <div class="mb-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-4 text-base font-semibold text-emerald-200 shadow-sm shadow-emerald-500/20">
                    {{ session('status') }}
                </div>
            @endif

            <div class="grid gap-8 lg:grid-cols-2">
                @forelse ($paths as $path)
                    @php
                        $enrolment = $enrolments->get($path->id);
                        $modules = collect($path->modules ?? []);
                        $outcomes = collect($path->outcomes ?? []);
                        $associatedCourses = collect($path->associated_courses ?? []);
                        $progress = $enrolment?->progress_percent ?? 0;
                        $statusOptions = ['active' => 'Staying active', 'completed' => 'Completed', 'dropped' => 'Taking a pause'];
                        $formScopePath = (int) old('path_id', 0);
                        $pathHasOldInput = $formScopePath === $path->id;
                        $initialProgress = $enrolment ? ($pathHasOldInput ? (int) old('progress_percent', $progress) : $progress) : null;
                        if ($enrolment) {
                            $initialProgress = max(0, min(100, (int) $initialProgress));
                        }
                        $initialStatus = $enrolment ? ($pathHasOldInput ? old('enrolment_status', $enrolment->enrolment_status) : $enrolment->enrolment_status) : null;
                        if ($enrolment && ! array_key_exists($initialStatus, $statusOptions)) {
                            $initialStatus = $enrolment->enrolment_status;
                        }
                        $initialUpdateNotes = $enrolment ? ($pathHasOldInput ? old('notes', $enrolment->notes) : ($enrolment->notes ?? '')) : '';
                        $initialEnrolNotes = (! $enrolment && $pathHasOldInput) ? old('notes', '') : '';
                    @endphp
                    <article class="relative overflow-hidden rounded-[2.5rem] border border-indigo-500/25 bg-slate-900/60 p-10 shadow-[0_28px_90px_-50px_rgba(79,70,229,0.55)] backdrop-blur-xl transition hover:shadow-[0_36px_100px_-45px_rgba(236,72,153,0.6)]">
                        <div class="absolute inset-0 -z-[1] bg-gradient-to-br from-slate-900/35 via-indigo-500/25 to-fuchsia-500/20"></div>
                        <header class="space-y-5">
                            <div class="flex flex-wrap items-center gap-3 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-200">
                                <span class="inline-flex items-center gap-2 rounded-full bg-indigo-500/25 px-3.5 py-1.5 text-indigo-100">{{ str_replace('_', ' ', $path->path_type) }}</span>
                                <span class="inline-flex items-center gap-2 rounded-full bg-pink-500/25 px-3.5 py-1.5 text-pink-100">{{ ucfirst($path->difficulty_level) }}</span>
                                @if ($path->duration_weeks)
                                    <span class="inline-flex items-center gap-2 rounded-full bg-slate-700/50 px-3.5 py-1.5 text-slate-200">{{ $path->duration_weeks }} weeks</span>
                                @endif
                                @if ($path->ai_guided)
                                    <span class="inline-flex items-center gap-2 rounded-full bg-emerald-500/25 px-3.5 py-1.5 text-emerald-100">AI assisted</span>
                                @endif
                            </div>
                            <h2 class="text-3xl font-bold text-white lg:text-[2.4rem]">{{ $path->title }}</h2>
                            @if ($path->summary)
                                <p class="learning-card__summary text-slate-200/90">{{ $path->summary }}</p>
                            @endif
                        </header>

                        <section class="mt-8 space-y-6 text-base text-slate-200/90">
                            @if ($modules->isNotEmpty())
                                <div class="space-y-4">
                                    <h3 class="text-sm font-semibold uppercase tracking-[0.26em] text-slate-300/80">Modules</h3>
                                    <ul class="learning-card__modules space-y-3">
                                        @foreach ($modules as $module)
                                            <li class="rounded-2xl border border-slate-700/40 bg-slate-800/70 px-5 py-4 text-base text-slate-200/90">
                                                <span class="font-semibold text-white">{{ data_get($module, 'title', 'Module') }}</span>
                                                <span class="block text-slate-300/85">{{ data_get($module, 'summary', 'Action-focused milestone with mentor access.') }}</span>
                                            </li>
                                        @endforeach
                                    </ul>
                                </div>
                            @endif

                            @if ($outcomes->isNotEmpty())
                                <div>
                                    <h3 class="text-sm font-semibold uppercase tracking-[0.26em] text-slate-300/80">Outcomes</h3>
                                    <ul class="mt-3 grid gap-3 sm:grid-cols-2">
                                        @foreach ($outcomes as $key => $value)
                                            <li class="rounded-2xl border border-indigo-500/25 bg-slate-800/60 px-5 py-4 text-base shadow-inner shadow-indigo-500/10">
                                                <span class="block text-sm font-semibold uppercase tracking-[0.2em] text-indigo-200">{{ is_string($key) ? str_replace('_', ' ', $key) : 'Outcome' }}</span>
                                                <span class="text-slate-200/90">{{ is_array($value) ? implode(', ', $value) : $value }}</span>
                                            </li>
                                        @endforeach
                                    </ul>
                                </div>
                            @endif

                            @if ($associatedCourses->isNotEmpty())
                                <div>
                                    <h3 class="text-sm font-semibold uppercase tracking-[0.26em] text-slate-300/80">Partner resources</h3>
                                    <ul class="mt-3 space-y-3">
                                        @foreach ($associatedCourses as $course)
                                            <li>
                                                @php($courseTitle = data_get($course, 'title', 'Resource'))
                                                @php($courseUrl = data_get($course, 'url'))
                                                @if ($courseUrl)
                                                    <a href="{{ $courseUrl }}" class="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-base text-indigo-100 transition hover:bg-indigo-500/20" target="_blank" rel="noopener">
                                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7.5 7.5h9m0 0V6a1.5 1.5 0 00-1.5-1.5h-6A1.5 1.5 0 007.5 6v1.5m9 0V18a1.5 1.5 0 01-1.5 1.5h-6A1.5 1.5 0 007.5 18V7.5" />
                                                        </svg>
                                                        {{ $courseTitle }}
                                                    </a>
                                                @else
                                                    <span class="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-base text-indigo-100">
                                                        {{ $courseTitle }}
                                                    </span>
                                                @endif
                                            </li>
                                        @endforeach
                                    </ul>
                                </div>
                            @endif
                        </section>

                        <footer class="learning-card__footer mt-8 flex flex-col gap-6 rounded-2xl px-6 py-6">
                            @if ($enrolment)
                                <div class="space-y-5">
                                    <div class="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <span class="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">You are enrolled</span>
                                            <p class="mt-2 max-w-xl text-base text-slate-200/85">Tune your momentum below—we will update mentor signals and AI nudges instantly.</p>
                                        </div>
                                        <form method="POST" action="{{ route('women.learn.withdraw', $path) }}">
                                            @csrf
                                            @method('DELETE')
                                            <button type="submit" class="inline-flex items-center gap-2 rounded-full border border-rose-400/40 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:border-rose-300/60 hover:bg-rose-500/10">Withdraw</button>
                                        </form>
                                    </div>

                                    <div class="rounded-2xl border border-indigo-500/20 bg-slate-900/65 px-5 py-4 text-base text-slate-200 shadow-inner shadow-indigo-500/15">
                                        <div class="flex flex-wrap items-center justify-between gap-3">
                                            <span>Status: <strong class="capitalize text-white">{{ $enrolment->enrolment_status }}</strong></span>
                                            <span>{{ $progress }}% complete</span>
                                        </div>
                                        <div class="mt-3 h-2.5 w-full rounded-full bg-indigo-500/20">
                                            <div class="h-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" style="width: {{ $progress }}%"></div>
                                        </div>
                                        @if ($enrolment->notes)
                                            <p class="mt-3 text-sm text-slate-300/85">Mentor notes: {{ $enrolment->notes }}</p>
                                        @endif
                                        <p class="mt-3 text-sm text-slate-400">Last AI check-in: {{ optional($enrolment->last_ai_check_in_at)->diffForHumans() ?? 'Pending' }}</p>
                                    </div>

                                    <form method="POST" action="{{ route('women.learn.update', $path) }}" class="space-y-5 rounded-2xl border border-indigo-500/25 bg-slate-900/55 px-5 py-5 text-base text-slate-200 shadow-sm shadow-indigo-500/10" x-data='@json(['progress' => $initialProgress ?? 0, 'status' => $initialStatus ?? 'active'])'>
                                        @csrf
                                        @method('PATCH')
                                        <input type="hidden" name="path_id" value="{{ $path->id }}">

                                        <div>
                                            <label for="progress-{{ $path->id }}" class="flex items-center justify-between text-sm font-semibold text-slate-100">
                                                <span>Progress</span>
                                                <span class="text-indigo-300">@{{ progress }}%</span>
                                            </label>
                                            <input id="progress-{{ $path->id }}" type="range" name="progress_percent" min="0" max="100" x-model="progress" class="learning-progress-input mt-3 w-full" />
                                            <div class="mt-2 flex justify-between text-xs text-slate-400/90">
                                                <span>Starting out</span>
                                                <span>Momentum</span>
                                                <span>Done</span>
                                            </div>
                                            @if ($errors->has('progress_percent') && $pathHasOldInput)
                                                <p class="mt-2 text-sm text-rose-400">{{ $errors->first('progress_percent') }}</p>
                                            @endif
                                        </div>

                                        <div>
                                            <label for="status-{{ $path->id }}" class="text-sm font-semibold text-slate-100">Rhythm</label>
                                            <select id="status-{{ $path->id }}" name="enrolment_status" x-model="status" class="mt-2 w-full rounded-2xl border border-indigo-500/25 bg-slate-900/70 px-4 py-3 text-base text-slate-200 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400/60">
                                                @foreach ($statusOptions as $value => $label)
                                                    <option value="{{ $value }}">{{ $label }}</option>
                                                @endforeach
                                            </select>
                                            @if ($errors->has('enrolment_status') && $pathHasOldInput)
                                                <p class="mt-2 text-sm text-rose-400">{{ $errors->first('enrolment_status') }}</p>
                                            @endif
                                        </div>

                                        <div>
                                            <label for="update-notes-{{ $path->id }}" class="text-sm font-semibold text-slate-100">What should we surface next?</label>
                                            <textarea id="update-notes-{{ $path->id }}" name="notes" rows="3" class="mt-2 w-full rounded-2xl border border-indigo-500/25 bg-slate-900/70 px-4 py-3 text-base text-slate-200 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400/60" placeholder="Optional signal for your mentor circle">{{ $initialUpdateNotes }}</textarea>
                                            @if ($errors->has('notes') && $pathHasOldInput)
                                                <p class="mt-2 text-sm text-rose-400">{{ $errors->first('notes') }}</p>
                                            @endif
                                        </div>

                                        <div class="flex flex-wrap items-center justify-between gap-3">
                                            <p class="text-sm text-slate-400/90">Updates send a fresh AI digest to your circle.</p>
                                            <button type="submit" class="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.2em] text-white shadow-lg shadow-indigo-500/40 transition hover:from-indigo-600 hover:via-fuchsia-500 hover:to-rose-500">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7" />
                                                </svg>
                                                Save updates
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            @else
                                <form method="POST" action="{{ route('women.learn.enrol', $path) }}" class="space-y-5">
                                    @csrf
                                    <input type="hidden" name="path_id" value="{{ $path->id }}">
                                    <label class="block text-sm font-semibold uppercase tracking-[0.24em] text-slate-200/80" for="notes-{{ $path->id }}">What support do you need?</label>
                                    <textarea id="notes-{{ $path->id }}" name="notes" rows="3" class="w-full rounded-2xl border border-indigo-500/25 bg-slate-900/70 px-4 py-3 text-base text-slate-200 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400/60" placeholder="Optional note for your mentor circle">{{ $initialEnrolNotes }}</textarea>
                                    @if ($errors->has('notes') && $pathHasOldInput)
                                        <p class="text-sm text-rose-400">{{ $errors->first('notes') }}</p>
                                    @endif
                                    <button type="submit" class="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-fuchsia-500 px-6 py-3 text-sm font-semibold uppercase tracking-[0.24em] text-white shadow-lg shadow-indigo-500/40 transition hover:from-indigo-600 hover:via-fuchsia-500 hover:to-rose-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4" />
                                        </svg>
                                        Join this path
                                    </button>
                                </form>
                            @endif
                        </footer>
                    </article>
                @empty
                    <div class="rounded-3xl border border-dashed border-indigo-500/40 bg-slate-900/60 px-6 py-10 text-center text-slate-200 shadow-inner shadow-indigo-500/15">
                        <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-200">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                        </div>
                        <h2 class="mt-4 text-2xl font-semibold text-white">Learning pathways are forming</h2>
                        <p class="mt-2 text-base text-slate-300/85">We are sequencing new cohorts now. Check back shortly or ask your WomenRise contact to fast-track access.</p>
                    </div>
                @endforelse
            </div>
        </div>
    </div>
@endsection

@push('scripts')
    @once
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
    @endonce
    <script>
        const womenLearnCharts = () => {
            if (typeof Chart === 'undefined' || window.__womenLearnChartsInitialized) {
                return;
            }

            window.__womenLearnChartsInitialized = true;

            const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const palette = ['#6366f1', '#22d3ee', '#a855f7', '#fb7185', '#facc15'];

            const statusLabels = @json(array_keys($statusDistribution));
            const statusData = @json(array_values($statusDistribution));
            const statusCanvas = document.getElementById('statusDistributionChart');

            if (statusCanvas) {
                new Chart(statusCanvas, {
                    type: 'doughnut',
                    data: {
                        labels: statusLabels,
                        datasets: [
                            {
                                data: statusData.length ? statusData : [1, 1, 1],
                                backgroundColor: palette,
                                hoverBackgroundColor: palette,
                                borderWidth: 0,
                                cutout: '42%',
                                hoverOffset: 16,
                            },
                        ],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: {
                            animateRotate: !reduceMotion && statusData.some((value) => value > 0),
                            duration: reduceMotion ? 0 : 900,
                            easing: 'easeOutQuad',
                        },
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    color: '#e2e8f0',
                                    padding: 18,
                                    usePointStyle: true,
                                },
                            },
                            tooltip: {
                                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                titleColor: '#f8fafc',
                                bodyColor: '#e2e8f0',
                                borderColor: 'rgba(148, 163, 184, 0.2)',
                                borderWidth: 1,
                                padding: 12,
                            },
                        },
                    },
                });
            }

            const progressCanvas = document.getElementById('progressTrendChart');
            const progressSeries = @json($progressTrend);
            if (progressCanvas) {
                const labels = progressSeries.length ? progressSeries.map((point) => point.day) : ['Today'];
                const values = progressSeries.length ? progressSeries.map((point) => point.avg_progress) : [0];
                const ctx = progressCanvas.getContext('2d');
                const gradient = ctx.createLinearGradient(0, 0, 0, progressCanvas.height);
                gradient.addColorStop(0, 'rgba(99, 102, 241, 0.55)');
                gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

                new Chart(progressCanvas, {
                    type: 'line',
                    data: {
                        labels,
                        datasets: [
                            {
                                label: 'Avg progress %',
                                data: values,
                                fill: true,
                                backgroundColor: gradient,
                                borderColor: '#6366f1',
                                borderWidth: 3,
                                pointBackgroundColor: '#f8fafc',
                                pointBorderColor: '#6366f1',
                                tension: 0.37,
                            },
                        ],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: reduceMotion ? false : {
                            duration: 800,
                            easing: 'easeInOutQuad',
                        },
                        scales: {
                            x: {
                                grid: {
                                    color: 'rgba(148, 163, 184, 0.1)',
                                },
                                ticks: {
                                    color: '#cbd5f5',
                                },
                            },
                            y: {
                                beginAtZero: true,
                                grid: {
                                    color: 'rgba(148, 163, 184, 0.08)',
                                },
                                ticks: {
                                    color: '#cbd5f5',
                                    callback: (value) => `${value}%`,
                                },
                                suggestedMax: 100,
                            },
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: 'rgba(15, 23, 42, 0.92)',
                                titleColor: '#f8fafc',
                                bodyColor: '#e2e8f0',
                                padding: 12,
                                borderColor: 'rgba(99, 102, 241, 0.35)',
                                borderWidth: 1,
                                callbacks: {
                                    label: (context) => `${context.parsed.y}% momentum`,
                                },
                            },
                        },
                    },
                });
            }

            const pathCanvas = document.getElementById('pathPerformanceChart');
            const pathInsights = @json($pathInsights);
            if (pathCanvas) {
                const labels = pathInsights.length ? pathInsights.map((path) => path.label) : ['Path'];
                const activeSeries = pathInsights.length ? pathInsights.map((path) => path.active) : [0];
                const completedSeries = pathInsights.length ? pathInsights.map((path) => path.completed) : [0];
                const avgProgressSeries = pathInsights.length ? pathInsights.map((path) => path.avg_progress) : [0];

                new Chart(pathCanvas, {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [
                            {
                                type: 'bar',
                                label: 'Active',
                                data: activeSeries,
                                backgroundColor: 'rgba(99, 102, 241, 0.65)',
                                borderRadius: 12,
                                maxBarThickness: 32,
                            },
                            {
                                type: 'bar',
                                label: 'Completed',
                                data: completedSeries,
                                backgroundColor: 'rgba(236, 72, 153, 0.55)',
                                borderRadius: 12,
                                maxBarThickness: 32,
                            },
                            {
                                type: 'line',
                                label: 'Avg % complete',
                                data: avgProgressSeries,
                                yAxisID: 'percentage',
                                borderColor: '#22d3ee',
                                borderWidth: 3,
                                pointBackgroundColor: '#22d3ee',
                                tension: 0.35,
                            },
                        ],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            mode: 'index',
                            intersect: false,
                        },
                        animation: reduceMotion ? false : {
                            duration: 950,
                            easing: 'easeOutQuad',
                        },
                        scales: {
                            x: {
                                stacked: false,
                                grid: {
                                    color: 'rgba(148, 163, 184, 0.08)',
                                },
                                ticks: {
                                    color: '#e2e8f0',
                                },
                            },
                            y: {
                                stacked: false,
                                beginAtZero: true,
                                grid: {
                                    color: 'rgba(148, 163, 184, 0.08)',
                                },
                                ticks: {
                                    color: '#cbd5f5',
                                },
                            },
                            percentage: {
                                position: 'right',
                                beginAtZero: true,
                                grid: {
                                    drawOnChartArea: false,
                                },
                                ticks: {
                                    callback: (value) => `${value}%`,
                                    color: '#cbd5f5',
                                },
                            },
                        },
                        plugins: {
                            tooltip: {
                                backgroundColor: 'rgba(15, 23, 42, 0.92)',
                                titleColor: '#f8fafc',
                                bodyColor: '#e2e8f0',
                                borderColor: 'rgba(99, 102, 241, 0.3)',
                                borderWidth: 1,
                                padding: 12,
                            },
                            legend: {
                                labels: {
                                    color: '#e2e8f0',
                                    usePointStyle: true,
                                },
                            },
                        },
                    },
                });
            }
        };

        const scheduleWomenLearnCharts = () => {
            if (window.__womenLearnChartsInitialized) {
                return;
            }

            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => requestAnimationFrame(womenLearnCharts));
            } else {
                requestAnimationFrame(womenLearnCharts);
            }
        };

        document.addEventListener('DOMContentLoaded', () => {
            const root = document.querySelector('[data-chart-root]');

            if (!root) {
                return;
            }

            if ('IntersectionObserver' in window) {
                const observer = new IntersectionObserver((entries) => {
                    if (entries.some((entry) => entry.isIntersecting)) {
                        observer.disconnect();
                        scheduleWomenLearnCharts();
                    }
                }, { rootMargin: '200px 0px' });

                observer.observe(root);
            } else {
                scheduleWomenLearnCharts();
            }
        }, { once: true });
    </script>
@endpush

