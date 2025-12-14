@extends('frontend.layouts.master')



@section('contents')
<div class="civic-shell">
    <div class="container">
        <div class="mb-4">
            <p class="text-uppercase text-muted fw-semibold mb-1">Opportunities</p>
            <h1 class="fw-bold" style="color:#2f1f33;">Public sector missions & leadership roles</h1>
            <p class="text-muted">Filter by focus tags, work style, or surface the featured, AI-ranked briefs.</p>
        </div>

        <form method="GET" class="filters-card">
            <div class="row g-3 align-items-end">
                <div class="col-md-4">
                    <label class="form-label" for="tag">Focus tag</label>
                    <select class="form-select" id="tag" name="tag">
                        <option value="">Any tag</option>
                        @foreach($tagOptions as $option)
                            <option value="{{ $option }}" @selected($filters['tag'] === $option)>{{ $option }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="col-md-4">
                    <label class="form-label" for="work_arrangement">Work arrangement</label>
                    <select class="form-select" id="work_arrangement" name="work_arrangement">
                        <option value="">Any arrangement</option>
                        @foreach($workOptions as $option)
                            <option value="{{ $option }}" @selected($filters['work_arrangement'] === $option)>{{ $option }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="col-md-2">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="1" id="featured" name="featured" @checked($filters['featured'])>
                        <label class="form-check-label" for="featured">Featured only</label>
                    </div>
                </div>
                <div class="col-md-2 text-md-end">
                    <button class="btn btn-primary w-100" type="submit" style="background:#a855f7;border-color:#a855f7;">Update</button>
                </div>
            </div>
        </form>

        <div class="opportunity-grid">
            @forelse($opportunities as $opportunity)
                <article class="civic-card">
                    <p class="text-uppercase text-muted small mb-1">{{ $opportunity->agency?->name }}</p>
                    <h2 class="civic-card__title">{{ $opportunity->title }}</h2>
                    <p class="text-muted">{{ $opportunity->summary }}</p>
                    <ul class="list-unstyled small text-muted mb-2">
                        <li><i class="fas fa-map-marker-alt" style="color:#f472b6;"></i> {{ $opportunity->location }}</li>
                        <li><i class="fas fa-briefcase"></i> {{ $opportunity->role_level ?? 'Leadership' }} · {{ $opportunity->work_arrangement ?? 'Hybrid' }}</li>
                        <li><i class="fas fa-calendar"></i> {{ $opportunity->closing_window ?? 'Rolling intake' }}</li>
                    </ul>
                    <div class="d-flex flex-wrap gap-2 mb-3">
                        @foreach(collect($opportunity->tags)->take(4) as $tag)
                            <span class="civic-tag">#{{ \Illuminate\Support\Str::slug($tag, '-') }}</span>
                        @endforeach
                    </div>
                    <div class="d-flex gap-2 flex-wrap">
                        <a class="btn btn-outline-primary" href="{{ route('public-sector.opportunities.show', $opportunity) }}">View brief</a>
                        @if($opportunity->application_url)
                            <a class="btn btn-primary" href="{{ $opportunity->application_url }}" target="_blank" rel="noopener">Apply</a>
                        @endif
                    </div>
                </article>
            @empty
                <p class="text-muted">No opportunities match your filters just yet.</p>
            @endforelse
        </div>

        <div class="mt-4">
            {{ $opportunities->links() }}
        </div>
    </div>
</div>
@endsection

