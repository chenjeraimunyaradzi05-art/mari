<x-app-layout>
    @php
        $searches = collect($searches ?? []);
    @endphp

    <section class="container py-10">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-5">
            <div>
                <p class="text-uppercase text-primary fw-semibold mb-1">Saved searches</p>
                <h1 class="h3 mb-0">Queries you can re-run with one click</h1>
                <p class="text-muted mb-0">This page renders the payload returned by <code>AdvancedSearchService::getSavedSearches()</code>.</p>
            </div>
            <a href="{{ route('member.dashboard') }}" class="btn btn-outline-secondary">
                <i class="fas fa-arrow-left me-2"></i>Back
            </a>
        </div>

        <div class="card shadow-sm border-0">
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table align-middle mb-0">
                        <thead class="table-light">
                            <tr>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Filters</th>
                                <th>Created</th>
                                <th class="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            @forelse($searches as $search)
                                <tr>
                                    <td class="fw-semibold">{{ data_get($search, 'name', 'Untitled search') }}</td>
                                    <td>{{ ucfirst(data_get($search, 'type', 'jobs')) }}</td>
                                    <td>
                                        <div class="d-flex flex-wrap gap-2">
                                            @foreach((array) data_get($search, 'filters', []) as $key => $value)
                                                <span class="badge bg-light text-dark">
                                                    {{ Str::title(str_replace('_', ' ', $key)) }}: {{ is_array($value) ? implode(', ', $value) : $value }}
                                                </span>
                                            @endforeach
                                        </div>
                                    </td>
                                    <td>{{ optional(data_get($search, 'created_at')) instanceof \Carbon\CarbonInterface ? data_get($search, 'created_at')->diffForHumans() : (data_get($search, 'created_at') ?? '—') }}</td>
                                    <td class="text-end">
                                        <button type="button" class="btn btn-sm btn-outline-primary" disabled>
                                            <i class="fas fa-sync me-1"></i>Re-run
                                        </button>
                                    </td>
                                </tr>
                            @empty
                                <tr>
                                    <td colspan="5" class="text-center py-5">
                                        <p class="lead mb-1">No saved searches yet</p>
                                        <p class="text-muted mb-0">Call <code>AdvancedSearchController::saveSearch</code> to populate this table.</p>
                                    </td>
                                </tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </section>
</x-app-layout>
