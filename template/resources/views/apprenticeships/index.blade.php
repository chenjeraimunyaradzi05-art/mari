@php
    use Illuminate\Support\Carbon;
    use Illuminate\Support\Str;

    $aiConciergeSurface = 'apprenticeships_index';
    $aiContextKey = 'apprenticeship_pathways';
    $aiConciergePayloads = [
        $aiContextKey => [
            'context' => $aiContext['context'] ?? 'career-placement-apprenticeships',
            'title' => $aiContext['title'] ?? 'Apprenticeship placement explainer',
            'guardrails' => $aiContext['guardrails'] ?? null,
            'context_payload' => [
                'filters' => $filters,
                'stats' => $stats,
                'pathways' => collect($pathways)->pluck('title'),
            ],
        ],
    ];
@endphp

@extends('layouts.app')

@section('title', 'Apprenticeships & traineeships')

@section('navigation')
    <div aria-hidden="true" class="hidden"></div>
@endsection

@section('suppress-welcome-card')
    1
@endsection

@section('content')
<div class="mx-auto flex max-w-6xl flex-col gap-10 px-4 sm:px-6 lg:px-8">
    <section class="rounded-3xl border border-slate-100 bg-white/95 p-6 shadow-sm">
        <form method="GET" class="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
                <label for="keyword" class="text-xs uppercase tracking-[0.35em] text-slate-400">Keyword</label>
                <input id="keyword" name="keyword" type="text" value="{{ $filters['keyword'] }}" placeholder="Electrical, housing, rail..." class="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-rose-400 focus:ring-rose-400" />
            </div>
            <div>
                <label for="location" class="text-xs uppercase tracking-[0.35em] text-slate-400">Location</label>
                <input id="location" name="location" type="text" value="{{ $filters['location'] }}" placeholder="e.g. Newcastle" class="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-rose-400 focus:ring-rose-400" />
            </div>
            <div>
                <label for="max_duration" class="text-xs uppercase tracking-[0.35em] text-slate-400">Max duration (weeks)</label>
                <input id="max_duration" name="max_duration" type="number" min="4" step="1" value="{{ $filters['max_duration'] }}" class="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-rose-400 focus:ring-rose-400" />
            </div>
            <div class="flex items-end gap-3">
                <button type="submit" class="flex-1 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Filter programs</button>
                <a href="{{ route('apprenticeships.index') }}" class="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Reset</a>
            </div>
        </form>
    </section>

    <section class="space-y-6">
        <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
                <p class="text-xs uppercase tracking-[0.35em] text-slate-400">Live programs</p>
                <h2 class="text-xl font-semibold text-slate-900">Curated apprenticeships & traineeships</h2>
            </div>
            <p class="text-sm text-slate-500">Showing {{ $programs->firstItem() ?? 0 }}–{{ $programs->lastItem() ?? 0 }} of {{ $programs->total() }} matches</p>
        </div>
        <div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            @forelse($programs as $program)
                @php
                    $company = $program->page;
                    $requirements = collect($program->requirements ?? [])->filter()->take(3);
                    $publishedAt = $program->published_at ? Carbon::parse($program->published_at) : null;
                @endphp
                <article id="program-{{ $program->id }}" class="flex h-full flex-col rounded-3xl border border-slate-100 bg-white/95 p-5 shadow-sm">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <p class="text-xs uppercase tracking-[0.35em] text-slate-400">{{ optional($company)->name ?? 'Partner' }}</p>
                            <h3 class="mt-1 text-lg font-semibold text-slate-900">{{ $program->title }}</h3>
                            <p class="text-sm text-slate-500">{{ optional($company)->tagline }}</p>
                        </div>
                        <span class="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">{{ $program->duration_weeks ? $program->duration_weeks.' wks' : 'Flexible' }}</span>
                    </div>
                    <p class="mt-3 flex-1 text-sm text-slate-600">{{ $program->summary ?? 'Partner did not supply a summary yet. Reach out for more context.' }}</p>
                    <dl class="mt-4 grid grid-cols-2 gap-3 text-xs">
                        <div class="rounded-2xl bg-slate-50 p-3">
                            <dt class="uppercase tracking-[0.3em] text-slate-400">Location</dt>
                            <dd class="mt-1 text-base font-semibold text-slate-900">{{ $program->location ?? 'Across AU' }}</dd>
                        </div>
                        <div class="rounded-2xl bg-slate-50 p-3">
                            <dt class="uppercase tracking-[0.3em] text-slate-400">Status</dt>
                            <dd class="mt-1 text-base font-semibold text-slate-900">{{ Str::headline($program->status ?? 'open') }}</dd>
                        </div>
                    </dl>
                    @if($requirements->isNotEmpty())
                        <div class="mt-4">
                            <p class="text-xs uppercase tracking-[0.35em] text-slate-400">Snapshot</p>
                            <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                                @foreach($requirements as $requirement)
                                    <li>{{ $requirement }}</li>
                                @endforeach
                            </ul>
                        </div>
                    @endif
                    <div class="mt-5 flex flex-col gap-2 text-sm text-slate-500">
                        <p>Published {{ $publishedAt ? $publishedAt->diffForHumans() : 'recently' }}</p>
                        <p>Safety score {{ optional($company)->safety_score ?? 'N/A' }} · {{ Str::headline(optional($company)->verification_status ?? 'pending') }}</p>
                    </div>
                    <div class="mt-5 flex flex-wrap gap-3">
                        <a
                            href="{{ $program->application_url ?: '#' }}"
                            @if($program->application_url) target="_blank" rel="noreferrer" @endif
                            class="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white {{ $program->application_url ? 'hover:bg-slate-800' : 'cursor-not-allowed opacity-50' }}"
                        >
                            <i class="fas fa-arrow-up-right-from-square"></i>
                            Apply / request callback
                        </a>
                        <button
                            type="button"
                            class="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800"
                            x-data="{ copied: false }"
                            x-on:click="navigator.clipboard.writeText('{{ url()->current().'#program-'.$program->id }}'); copied = true; setTimeout(() => copied = false, 2000);"
                        >
                            <i class="fas fa-share"></i>
                            <span x-text="copied ? 'Copied!' : 'Share brief'"></span>
                        </button>
                    </div>
                </article>
            @empty
                <div class="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 md:col-span-2 lg:col-span-3">
                    <p class="font-semibold text-slate-700">No apprenticeships match those filters.</p>
                    <p class="mt-2">Reset the filters above and Athena will surface the latest intakes.</p>
                </div>
            @endforelse
        </div>
        @if($programs->hasPages())
            <div class="pt-4">
                {{ $programs->links() }}
            </div>
        @endif
    </section>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        @foreach($pathways as $pathway)
            <article class="rounded-3xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white p-5 shadow-sm">
                <p class="text-xs uppercase tracking-[0.35em] text-slate-400">Pathway</p>
                <h3 class="mt-1 text-lg font-semibold text-slate-900">{{ $pathway['title'] }}</h3>
                <p class="mt-2 text-sm text-slate-600">{{ $pathway['summary'] }}</p>
                <p class="mt-4 text-sm font-semibold text-slate-900">{{ $pathway['slots'] }} open slots · Regions: {{ implode(', ', $pathway['regions']) }}</p>
                <div class="mt-3 flex flex-wrap gap-2">
                    @foreach($pathway['focus'] as $focus)
                        <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{{ $focus }}</span>
                    @endforeach
                </div>
            </article>
        @endforeach
    </div>

    <section class="rounded-3xl border border-slate-100 bg-white/95 p-6 shadow-sm">
        <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
                <p class="text-xs uppercase tracking-[0.35em] text-slate-400">Subsidies & mentors</p>
                <h2 class="text-xl font-semibold text-slate-900">Wage supports to stack with your placement</h2>
            </div>
            <p class="text-sm text-slate-500">Bookmark the ones aligned to your cohort before intake calls.</p>
        </div>
        <div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            @foreach($subsidies as $subsidy)
                <article class="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
                    <p class="text-xs uppercase tracking-[0.35em] text-slate-400">{{ $subsidy['sponsor'] }}</p>
                    <h3 class="mt-1 text-lg font-semibold text-slate-900">{{ $subsidy['title'] }}</h3>
                    <p class="text-sm text-slate-600">{{ $subsidy['summary'] }}</p>
                    <dl class="mt-4 text-sm text-slate-600">
                        <div class="flex items-center justify-between">
                            <dt>Value</dt>
                            <dd class="font-semibold text-slate-900">{{ $subsidy['value'] }}</dd>
                        </div>
                        <div class="flex items-center justify-between">
                            <dt>Status</dt>
                            <dd class="font-semibold {{ Str::contains(Str::lower($subsidy['status']), 'open') ? 'text-emerald-600' : 'text-amber-600' }}">{{ $subsidy['status'] }}</dd>
                        </div>
                    </dl>
                    <a href="{{ $subsidy['link'] }}" target="_blank" rel="noreferrer" class="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700">
                        Learn more
                        <i class="fas fa-arrow-up-right-from-square"></i>
                    </a>
                </article>
            @endforeach
        </div>
    </section>

    <section class="rounded-3xl border border-violet-100 bg-gradient-to-r from-violet-900 to-indigo-900 p-6 text-white shadow-xl">
        <p class="text-xs uppercase tracking-[0.4em] text-white/60">Ask Athena</p>
        <h2 class="mt-2 text-2xl font-semibold">Need a calmer walk-through of subsidy paperwork or safety interviews?</h2>
        <p class="mt-3 text-sm text-white/80">{{ $aiContext['guardrails'] }}</p>
        <div class="mt-5 flex flex-col gap-3 sm:flex-row">
            <a href="{{ route('ai.concierge') }}?context={{ $aiContextKey }}" class="flex-1 rounded-3xl bg-white/90 px-5 py-3 text-center text-sm font-semibold text-slate-900 shadow-lg transition hover:-translate-y-0.5">Launch Athena in this context</a>
            <a href="{{ route('ai.concierge') }}" class="flex-1 rounded-3xl border border-white/40 px-5 py-3 text-center text-sm font-semibold text-white/90">Open concierge workspace</a>
        </div>
    </section>
</div>
@endsection
