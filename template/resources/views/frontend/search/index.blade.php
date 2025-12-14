<x-app-layout>
    @php
        $activeType = $type ?? 'jobs';
        $filters = collect($filters ?? []);
        $searchTerm = $filters->get('search');
    @endphp

    <section class="py-12 container">
        <div class="row gy-5 align-items-center">
            <div class="col-lg-6">
                <span class="text-uppercase fw-semibold text-primary">Advanced search</span>
                <h1 class="display-5 fw-bold mt-2">Find opportunities across jobs, members, and companies</h1>
                <p class="text-muted mt-3">Tune the filters, swap between datasets, and bookmark the queries you want to revisit. Results update instantly when the soon-to-be-published routes are wired in.</p>
                <ul class="list-unstyled mt-4 text-muted">
                    <li class="mb-2"><i class="fas fa-filter text-primary me-2"></i>Multi-entity filtering</li>
                    <li class="mb-2"><i class="fas fa-bookmark text-primary me-2"></i>Save searches for later</li>
                    <li><i class="fas fa-bolt text-primary me-2"></i>Faceted insights powered by the AdvancedSearchService</li>
                </ul>
            </div>
            <div class="col-lg-6">
                <div class="card shadow-lg border-0">
                    <div class="card-body p-4">
                        <form method="GET" action="{{ url()->current() }}" class="d-flex flex-column gap-3">
                            <div>
                                <label class="form-label fw-semibold">Search type</label>
                                <div class="btn-group w-100" role="group">
                                    @foreach(['jobs' => 'Jobs', 'candidates' => 'Members', 'companies' => 'Companies'] as $value => $label)
                                        <input type="radio" class="btn-check" name="type" id="type-{{ $value }}" value="{{ $value }}" @checked($activeType === $value)>
                                        <label class="btn btn-outline-primary" for="type-{{ $value }}">{{ $label }}</label>
                                    @endforeach
                                </div>
                            </div>
                            <div>
                                <label class="form-label fw-semibold">Keywords</label>
                                <input type="text" class="form-control form-control-lg" name="search" value="{{ $searchTerm }}" placeholder="Role, skill, company, location...">
                            </div>
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label class="form-label fw-semibold">Location</label>
                                    <input type="text" class="form-control" name="location" value="{{ $filters->get('location') }}" placeholder="Any">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label fw-semibold">Seniority</label>
                                    <select class="form-select" name="seniority">
                                        <option value="">Any level</option>
                                        @foreach(['entry', 'mid', 'senior', 'executive'] as $level)
                                            <option value="{{ $level }}" @selected($filters->get('seniority') === $level)>{{ ucfirst($level) }}</option>
                                        @endforeach
                                    </select>
                                </div>
                            </div>
                            <div class="d-flex justify-content-between align-items-center">
                                <button type="submit" class="btn btn-primary btn-lg">
                                    <i class="fas fa-search me-2"></i>Search {{ ucfirst($activeType) }}
                                </button>
                                <a href="{{ url()->current() }}" class="text-muted">Reset</a>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </section>
</x-app-layout>
