@extends('frontend.layouts.master')

@section('title', 'Procurement Pipeline')
@section('meta_description', 'Track procurement missions, compliance trackers, and supplier diversity signals in Athena’s civic lab.')

@push('styles')
    <link rel="stylesheet" href="{{ asset('css/public-sector.css') }}">
@endpush

@section('contents')
<div class="civic-shell">
    <div class="container">
        <section class="civic-hero">
            <div>
                <div class="civic-pill"><i class="fas fa-diagram-project"></i> Agency pipeline</div>
                <h1 class="civic-hero__title">Pipeline cards, mission briefs, and compliance checkpoints in one calm view.</h1>
                <p class="text-muted">Monitor every public-sector mission from discovery through award while keeping Athena’s AI concierge one click away.</p>
                <div class="mt-3 d-flex gap-2 flex-wrap">
                    <a href="{{ route('public-sector.opportunities.index') }}" class="btn btn-outline-primary">Browse published roles</a>
                    <a href="{{ route('public-sector.dashboard') }}" class="btn btn-primary" style="background: var(--civic-violet); border-color: var(--civic-violet);">Back to overview</a>
                </div>
            </div>
            <div class="civic-signal-grid">
                <div class="signal-card">
                    <p class="signal-label">Total missions</p>
                    <div class="signal-value">{{ $stats['total'] }}</div>
                    <p class="small text-muted mb-0">Across every agency workspace.</p>
                </div>
                <div class="signal-card">
                    <p class="signal-label">Open pipeline</p>
                    <div class="signal-value">{{ $stats['open'] }}</div>
                    <p class="small text-muted mb-0">Public-ready briefs seeking suppliers.</p>
                </div>
                <div class="signal-card">
                    <p class="signal-label">In briefing</p>
                    <div class="signal-value">{{ $stats['in_briefing'] }}</div>
                    <p class="small text-muted mb-0">Drafts waiting on final policy notes.</p>
                </div>
                <div class="signal-card">
                    <p class="signal-label">Awarded this quarter</p>
                    <div class="signal-value">{{ $stats['awarded'] }}</div>
                    <p class="small text-muted mb-0">Great for storytelling on the feed.</p>
                </div>
            </div>
        </section>

        <section class="civic-section">
            <div class="section-header">
                <h2 class="section-title">Pipeline board</h2>
                <p class="text-muted mb-0">Drag-and-drop ready columns mapped to your procurement lifecycle.</p>
            </div>
            <div class="pipeline-board">
                @foreach($stageLabels as $stageKey => $label)
                    @php
                        $records = $pipeline->get($stageKey, collect());
                    @endphp
                    <div class="pipeline-column">
                        <header class="pipeline-column__header">
                            <p class="pipeline-column__eyebrow text-uppercase">{{ $label }}</p>
                            <span class="pipeline-column__count">{{ $records->count() }}</span>
                        </header>
                        <div class="pipeline-column__body">
                            @forelse($records as $opportunity)
                                <article class="pipeline-card">
                                    <p class="pipeline-card__eyebrow">{{ $opportunity->agency?->name ?? 'Agency pending' }}</p>
                                    <h3 class="pipeline-card__title">{{ $opportunity->title }}</h3>
                                    <p class="mb-2 text-muted">{{ $opportunity->category ?? 'Civic mission' }} · {{ $opportunity->delivery_region ?? 'National' }}</p>
                                    <p class="mb-1"><i class="fas fa-money-bill-wave"></i> {{ $opportunity->budget_band ?? 'Budget TBD' }}</p>
                                    <p class="mb-1"><i class="fas fa-calendar-day"></i> {{ optional($opportunity->closes_at)->format('M j, Y') ?? 'Timeline in draft' }}</p>
                                    <div class="mt-3 d-flex flex-wrap gap-2">
                                        @if($opportunity->missionBrief)
                                            <button class="btn btn-sm btn-outline-primary" type="button"
                                                data-ai-context-endpoint="{{ route('mission-briefs.ai-context', $opportunity->missionBrief) }}">
                                                <i class="fas fa-robot"></i> Ask Athena
                                            </button>
                                            <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#brief-{{ $opportunity->missionBrief->id }}">
                                                View brief
                                            </button>
                                        @else
                                            <span class="badge bg-light text-dark">Brief drafting</span>
                                        @endif
                                    </div>
                                    @if($opportunity->missionBrief)
                                        <div class="collapse mt-3" id="brief-{{ $opportunity->missionBrief->id }}">
                                            <p class="text-muted small mb-2">{{ $opportunity->missionBrief->headline ?? 'Mission outline' }}</p>
                                            <p class="mb-2">{{ \Illuminate\Support\Str::limit($opportunity->missionBrief->executive_summary, 240) }}</p>
                                            @if(is_array($opportunity->missionBrief->mission_objectives))
                                                <ul class="small text-muted mb-0">
                                                    @foreach(array_slice($opportunity->missionBrief->mission_objectives, 0, 3) as $objective)
                                                        <li>{{ $objective }}</li>
                                                    @endforeach
                                                </ul>
                                            @endif
                                        </div>
                                    @endif
                                </article>
                            @empty
                                <p class="text-muted">No missions in this phase yet.</p>
                            @endforelse
                        </div>
                    </div>
                @endforeach
            </div>
        </section>

        <section class="civic-section">
            <div class="section-header">
                <h2 class="section-title">Compliance trackers</h2>
                <p class="text-muted mb-0">Flight deck for probity, risk, and evidence uploads.</p>
            </div>
            <div class="table-responsive">
                <table class="table table-borderless align-middle">
                    <thead>
                        <tr>
                            <th>Tracker</th>
                            <th>Mission</th>
                            <th>Status</th>
                            <th>Owner</th>
                            <th>Due</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse($compliance as $item)
                            <tr>
                                <td>{{ $item->title }}</td>
                                <td>{{ $item->opportunity?->title ?? 'Pending assignment' }}</td>
                                <td>
                                    <span class="badge {{ $item->status === 'complete' ? 'bg-success' : 'bg-warning text-dark' }}">
                                        {{ \Illuminate\Support\Str::title($item->status) }}
                                    </span>
                                </td>
                                <td>{{ $item->owner?->name ?? 'Unassigned' }}</td>
                                <td>
                                    @if($item->due_at)
                                        <span class="text-muted">{{ $item->due_at->format('M j, Y') }}</span>
                                    @else
                                        <span class="text-muted">TBC</span>
                                    @endif
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="5" class="text-muted">Compliance trackers will appear as soon as your team adds them.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </section>
    </div>
</div>
@endsection

@include('components.ai.mission-brief-launcher', ['aiConciergeUrl' => $aiConciergeUrl])
