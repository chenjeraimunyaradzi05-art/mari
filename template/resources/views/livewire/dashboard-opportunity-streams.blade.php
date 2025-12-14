@php
    $streamMeta = [
        'jobs' => ['label' => 'Roles to Watch', 'icon' => 'fas fa-briefcase'],
        'apprenticeships' => ['label' => 'Apprenticeships', 'icon' => 'fas fa-user-graduate'],
        'courses' => ['label' => 'Courses & Learning', 'icon' => 'fas fa-graduation-cap'],
        'mentorship' => ['label' => 'Mentorship Matches', 'icon' => 'fas fa-hands-helping'],
        'creator_earnings' => ['label' => 'Creator Earnings', 'icon' => 'fas fa-chart-line'],
    ];
@endphp

<div class="dashboard-card mb-40 opportunity-streams-card">
    <div class="dashboard-card-header flex-wrap">
        <div>
            <p class="dashboard-card-title mb-1">Opportunity Streams</p>
            <span class="dashboard-card-subtitle">Curated signals across roles, learning, and monetisation.</span>
        </div>
        <div class="ms-auto d-flex gap-2">
            <button type="button" class="btn btn-sm opportunity-streams-toggle" wire:click="expandAll">Expand all</button>
            <button type="button" class="btn btn-sm opportunity-streams-toggle" wire:click="collapseAll">Collapse all</button>
        </div>
    </div>
    <div class="dashboard-card-body">
        @if (empty($streams))
            <div class="dashboard-empty-state">
                <i class="fas fa-compass"></i>
                <span>Momentum streams will appear once recommendations are generated for your persona.</span>
            </div>
        @else
            <div class="row g-3">
                @foreach ($streams as $key => $items)
                    @php
                        $meta = $streamMeta[$key] ?? ['label' => \Illuminate\Support\Str::headline((string) $key), 'icon' => 'fas fa-sparkles'];
                        $visibleItems = $this->visibleItems($key);
                        $isExpanded = $expanded[$key] ?? false;
                    @endphp
                    <div class="col-md-6" wire:key="stream-{{ $key }}">
                        <div class="opportunity-stream-column h-100">
                            <div class="opportunity-stream-heading">
                                <span class="opportunity-stream-icon"><i class="{{ $meta['icon'] }}"></i></span>
                                <span class="opportunity-stream-label">{{ $meta['label'] }}</span>
                                <button type="button" class="btn btn-sm ms-auto opportunity-streams-toggle" wire:click="toggle('{{ $key }}')">
                                    {{ $isExpanded ? 'Show fewer' : 'Show more' }}
                                </button>
                            </div>

                            <ul class="opportunity-stream-list">
                                @foreach ($visibleItems as $index => $item)
                                    @php
                                        $title = \Illuminate\Support\Arr::get($item, 'title')
                                            ?? \Illuminate\Support\Arr::get($item, 'name')
                                            ?? 'Opportunity';
                                        $summary = \Illuminate\Support\Arr::get($item, 'summary')
                                            ?? \Illuminate\Support\Arr::get($item, 'description');
                                        $ctaUrl = \Illuminate\Support\Arr::get($item, 'cta.url')
                                            ?? \Illuminate\Support\Arr::get($item, 'url');
                                        $ctaLabel = \Illuminate\Support\Arr::get($item, 'cta.label') ?? 'View';
                                        $metaBadge = \Illuminate\Support\Arr::get($item, 'meta.badge');
                                    @endphp
                                    <li class="opportunity-stream-item" wire:key="stream-{{ $key }}-{{ $index }}">
                                        <span class="opportunity-stream-title">{{ $title }}</span>
                                        @if ($summary)
                                            <p class="opportunity-stream-summary mb-1">{{ $summary }}</p>
                                        @endif
                                        <div class="d-flex align-items-center gap-2">
                                            @if ($metaBadge)
                                                <span class="opportunity-stream-badge">{{ $metaBadge }}</span>
                                            @endif
                                            @if ($ctaUrl)
                                                <a href="{{ $ctaUrl }}" class="opportunity-stream-link">{{ $ctaLabel }} <i class="fas fa-arrow-right ms-1"></i></a>
                                            @endif
                                        </div>
                                    </li>
                                @endforeach

                                @if (! $isExpanded && count($items) > count($visibleItems))
                                    <li class="opportunity-stream-item opportunity-stream-item--more" wire:key="stream-{{ $key }}-more">
                                        <button type="button" class="btn btn-link p-0 opportunity-stream-link" wire:click="toggle('{{ $key }}')">
                                            View {{ count($items) - count($visibleItems) }} more
                                        </button>
                                    </li>
                                @endif
                            </ul>
                        </div>
                    </div>
                @endforeach
            </div>
        @endif
    </div>
</div>



