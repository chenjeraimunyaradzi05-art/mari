<x-app-layout>
    @php
        $skill = $skill ?? null;
        $resources = collect($resources ?? []);
        $progressData = collect($progressData ?? []);
        $filters = collect($filters ?? []);
    @endphp

    <section class="container py-10">
        <div class="d-flex justify-content-between flex-wrap gap-3 mb-5">
            <div>
                <p class="text-uppercase text-primary fw-semibold mb-1">Learning resources</p>
                <h1 class="h3 mb-1">{{ $skill?->name ?? 'Skill focus' }}</h1>
                <p class="text-muted mb-0">Surfacing content via <code>SkillGapService::getLearningResources()</code>.</p>
            </div>
            <a href="{{ route('member.skill-gap.index') }}" class="btn btn-outline-secondary">Back to overview</a>
        </div>

        <form class="row g-3 mb-5" method="GET" action="{{ url()->current() }}">
            <div class="col-md-3">
                <label class="form-label">Type</label>
                <select class="form-select" name="type">
                    <option value="">Any</option>
                    @foreach(['course', 'article', 'video', 'mentor'] as $option)
                        <option value="{{ $option }}" @selected($filters->get('type') === $option)>{{ ucfirst($option) }}</option>
                    @endforeach
                </select>
            </div>
            <div class="col-md-3">
                <label class="form-label">Difficulty</label>
                <select class="form-select" name="difficulty">
                    <option value="">Any</option>
                    @foreach(['beginner', 'intermediate', 'advanced'] as $option)
                        <option value="{{ $option }}" @selected($filters->get('difficulty') === $option)>{{ ucfirst($option) }}</option>
                    @endforeach
                </select>
            </div>
            <div class="col-md-3 d-flex align-items-end">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" name="free" value="1" id="filter-free" @checked($filters->get('free'))>
                    <label class="form-check-label" for="filter-free">Free only</label>
                </div>
            </div>
            <div class="col-md-3 d-flex align-items-end">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" name="certified" value="1" id="filter-certified" @checked($filters->get('certified'))>
                    <label class="form-check-label" for="filter-certified">Certification</label>
                </div>
            </div>
            <div class="col-12">
                <button type="submit" class="btn btn-primary"><i class="fas fa-filter me-2"></i>Apply filters</button>
            </div>
        </form>

        <div class="row g-4">
            @forelse($resources as $resource)
                @php $progress = $progressData->get($resource->id ?? null); @endphp
                <div class="col-md-6 col-lg-4">
                    <div class="p-4 border rounded-4 h-100">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <strong>{{ $resource->title ?? 'Learning resource' }}</strong>
                            <span class="badge bg-primary-subtle text-primary text-uppercase">{{ ucfirst($resource->type ?? 'resource') }}</span>
                        </div>
                        <p class="text-muted mb-3">{{ Str::limit($resource->summary ?? $resource->description ?? 'Description coming soon', 120) }}</p>
                        <ul class="list-unstyled small text-muted mb-3">
                            <li>Difficulty: {{ ucfirst($resource->difficulty ?? 'n/a') }}</li>
                            <li>Provider: {{ $resource->provider ?? '—' }}</li>
                            <li>Duration: {{ $resource->duration ?? 'Flexible' }}</li>
                        </ul>
                        <div class="mt-auto">
                            <div class="progress" style="height: 6px;">
                                <div class="progress-bar" role="progressbar" style="width: {{ $progress->progress_percentage ?? 0 }}%;"></div>
                            </div>
                            <small class="text-muted d-block mt-1">Progress {{ $progress->progress_percentage ?? 0 }}%</small>
                        </div>
                    </div>
                </div>
            @empty
                <div class="col-12">
                    <div class="text-center border rounded-4 py-5">No resources returned for this skill yet.</div>
                </div>
            @endforelse
        </div>
    </section>
</x-app-layout>
