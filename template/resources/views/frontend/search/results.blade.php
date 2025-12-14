<x-app-layout>
    @php
        $activeType = $type ?? 'jobs';
        $filters = collect($filters ?? []);
        $facets = collect($facets ?? []);

        $paginator = $results instanceof \Illuminate\Pagination\AbstractPaginator ? $results : null;
        $items = $paginator?->items() ?? (is_iterable($results ?? null) ? $results : []);
        $items = collect($items);
    @endphp

    <section class="container py-10">
        <div class="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
            <div>
                <p class="text-uppercase fw-semibold text-primary mb-1">Results</p>
                <h1 class="h2 mb-2">{{ $items->count() }} {{ Str::plural($activeType, $items->count()) }} found</h1>
                <p class="text-muted mb-0">Showing data provided by <code>AdvancedSearchService</code>. Once the API endpoints are wired, this page renders the real payload.</p>
            </div>
            <a href="{{ route('member.dashboard') }}" class="btn btn-outline-secondary">
                <i class="fas fa-arrow-left me-2"></i>Back to workspace
            </a>
        </div>

        <div class="row gx-5">
            <aside class="col-lg-3 mb-5 mb-lg-0">
                <div class="card shadow-sm border-0">
                    <div class="card-body">
                        <h6 class="text-uppercase text-muted">Filters</h6>
                        <dl class="mb-0">
                            @forelse($filters as $key => $value)
                                @if(filled($value))
                                    <div class="mb-2">
                                        <dt class="small text-muted">{{ Str::title(str_replace('_', ' ', $key)) }}</dt>
                                        <dd class="fw-semibold">{{ is_array($value) ? implode(', ', $value) : $value }}</dd>
                                    </div>
                                @endif
                            @empty
                                <p class="text-muted mb-0">No filters applied.</p>
                            @endforelse
                        </dl>
                        <div class="mt-3">
                            <span class="text-muted small text-uppercase d-block mb-2">Facets</span>
                            @forelse($facets as $facet => $options)
                                <div class="mb-3">
                                    <strong class="d-block">{{ Str::title(str_replace('_', ' ', $facet)) }}</strong>
                                    <ul class="list-unstyled small text-muted mb-0">
                                        @foreach(collect($options)->take(4) as $label => $count)
                                            <li>{{ $label }} <span class="badge bg-light text-dark">{{ $count }}</span></li>
                                        @endforeach
                                    </ul>
                                </div>
                            @empty
                                <p class="text-muted mb-0">Facet data will appear once the service responds.</p>
                            @endforelse
                        </div>
                    </div>
                </div>
            </aside>

            <div class="col-lg-9">
                <div class="d-flex flex-column gap-4">
                    @forelse($items as $result)
                        <article class="p-4 border rounded-4 shadow-sm">
                            <div class="d-flex justify-content-between flex-wrap gap-3">
                                <div>
                                    <h3 class="h5 mb-1">{{ data_get($result, 'title', 'Untitled '.$activeType) }}</h3>
                                    <p class="mb-0 text-muted">{{ data_get($result, 'subtitle') ?? data_get($result, 'company') ?? 'No context provided' }}</p>
                                </div>
                                <span class="badge bg-primary-subtle text-primary text-uppercase">{{ ucfirst($activeType) }}</span>
                            </div>
                            @if($summary = data_get($result, 'summary'))
                                <p class="mt-3 mb-0">{{ Str::limit($summary, 220) }}</p>
                            @endif
                            <div class="mt-3 d-flex flex-wrap gap-2">
                                @foreach((array) data_get($result, 'highlights', []) as $highlight)
                                    <span class="badge bg-light text-dark">{{ $highlight }}</span>
                                @endforeach
                            </div>
                        </article>
                    @empty
                        <div class="text-center py-5 border rounded-4">
                            <i class="fas fa-search fa-2x text-primary mb-3"></i>
                            <p class="lead mb-1">No results yet</p>
                            <p class="text-muted">When the API returns records, they will render here automatically.</p>
                        </div>
                    @endforelse
                </div>

                @if($paginator)
                    <div class="mt-5">
                        {{ $paginator->withQueryString()->links() }}
                    </div>
                @endif
            </div>
        </div>
    </section>
</x-app-layout>
