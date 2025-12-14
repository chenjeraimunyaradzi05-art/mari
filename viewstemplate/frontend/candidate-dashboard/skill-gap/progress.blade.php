<x-app-layout>
    @php
        $progressItems = $allProgress instanceof \Illuminate\Pagination\AbstractPaginator ? $allProgress : null;
        $collection = $progressItems?->getCollection() ?? collect($allProgress ?? []);
        $stats = collect($stats ?? []);
    @endphp

    <section class="container py-10">
        <div class="mb-5">
            <p class="text-uppercase text-primary fw-semibold mb-1">Learning progress</p>
            <h1 class="h3 mb-2">Track every resource you are exploring</h1>
            <p class="text-muted mb-0">Summaries supplied by <code>SkillGapService::getLearningStats()</code>.</p>
        </div>

        <div class="row g-4 mb-5">
            <div class="col-md-4">
                <div class="p-4 border rounded-4 h-100">
                    <small class="text-muted text-uppercase">Completed</small>
                    <h2 class="fw-bold">{{ $stats->get('completed', 0) }}</h2>
                </div>
            </div>
            <div class="col-md-4">
                <div class="p-4 border rounded-4 h-100">
                    <small class="text-muted text-uppercase">In progress</small>
                    <h2 class="fw-bold">{{ $stats->get('in_progress', 0) }}</h2>
                </div>
            </div>
            <div class="col-md-4">
                <div class="p-4 border rounded-4 h-100">
                    <small class="text-muted text-uppercase">Time invested</small>
                    <h2 class="fw-bold">{{ $stats->get('total_time_spent', 0) }} min</h2>
                </div>
            </div>
        </div>

        <div class="card border-0 shadow-sm">
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table align-middle mb-0">
                        <thead class="table-light">
                            <tr>
                                <th class="ps-4">Resource</th>
                                <th>Skill</th>
                                <th>Progress</th>
                                <th>Last update</th>
                            </tr>
                        </thead>
                        <tbody>
                            @forelse($collection as $progress)
                                <tr>
                                    <td class="ps-4">
                                        <strong>{{ data_get($progress, 'learningResource.title', 'Learning resource') }}</strong>
                                        <div class="text-muted small">{{ data_get($progress, 'learningResource.type', 'resource') }}</div>
                                    </td>
                                    <td>{{ data_get($progress, 'skill.name') ?? data_get($progress, 'learningResource.skill.name') ?? '—' }}</td>
                                    <td style="width: 220px;">
                                        <div class="progress" style="height: 6px;">
                                            <div class="progress-bar" role="progressbar" style="width: {{ data_get($progress, 'progress_percentage', 0) }}%"></div>
                                        </div>
                                        <small class="text-muted">{{ data_get($progress, 'progress_percentage', 0) }}%</small>
                                    </td>
                                    <td>{{ optional(data_get($progress, 'updated_at'))->diffForHumans() ?? '—' }}</td>
                                </tr>
                            @empty
                                <tr>
                                    <td colspan="4" class="text-center py-5">No learning progress recorded yet.</td>
                                </tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        @if($progressItems)
            <div class="mt-4">
                {{ $progressItems->links() }}
            </div>
        @endif
    </section>
</x-app-layout>
