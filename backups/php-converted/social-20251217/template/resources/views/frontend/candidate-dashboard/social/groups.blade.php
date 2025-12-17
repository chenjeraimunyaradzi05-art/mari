<x-app-layout>
    @php
        $groupsSource = $groups ?? null;

        if ($groupsSource instanceof \Illuminate\Pagination\AbstractPaginator) {
            $groupsCollection = $groupsSource->getCollection();
        } elseif ($groupsSource instanceof \Illuminate\Support\Collection) {
            $groupsCollection = $groupsSource;
        } elseif (is_array($groupsSource)) {
            $groupsCollection = collect($groupsSource);
        } else {
            $groupsCollection = collect();
        }

        $groupsCollection = $groupsCollection->filter();
        $groupsTotal = $groupsCount ?? $groupsCollection->count();
        $featuredGroup = $groupsCollection->first();
        $featuredGroupName = $featuredGroup->name ?? $featuredGroup->title ?? null;
    @endphp

    <div class="groups-dashboard container py-5 py-md-6">
        <section class="groups-card rounded-4 overflow-hidden">
            <div class="groups-card__inner">
                <header class="groups-card__header">
                    <span class="groups-card__eyebrow">Community</span>
                    <h1 class="groups-card__title">Stay rooted in the circles fueling your growth</h1>
                    <p class="groups-card__subtitle">
                        Keep tabs on the collectives sharing resources, gentle accountability, and warm introductions across your journey.
                    </p>
                    <div class="groups-card__stats">
                        <div class="group-stat">
                            <span class="group-stat__icon"><i class="fas fa-users"></i></span>
                            <div>
                                <p class="group-stat__label">Groups joined</p>
                                <p class="group-stat__value">{{ number_format((int) $groupsTotal) }}</p>
                            </div>
                        </div>
                        <div class="group-stat group-stat--accent">
                            <span class="group-stat__icon"><i class="fas fa-hand-holding-heart"></i></span>
                            <div>
                                <p class="group-stat__label">Featured circle</p>
                                <p class="group-stat__value">
                                    {{ $featuredGroupName ? \Illuminate\Support\Str::limit($featuredGroupName, 24) : 'Curate yours' }}
                                </p>
                            </div>
                        </div>
                    </div>
                </header>

                <div class="groups-card__body">
                    @if ($groupsCollection->isNotEmpty())
                        <div class="group-pill-list">
                            @foreach ($groupsCollection->take(6) as $group)
                                @php
                                    $groupName = $group->name ?? $group->title ?? 'Community';
                                    $groupDescription = $group->description ?? $group->summary ?? null;
                                    $groupRole = $group->pivot->role ?? $group->role ?? null;
                                    $groupJoined = optional($group->pivot->created_at ?? $group->created_at)->diffForHumans(null, true);
                                @endphp
                                <article class="group-pill">
                                    <div class="group-pill__header">
                                        <span class="group-pill__icon"><i class="fas fa-seedling"></i></span>
                                        <div>
                                            <h3 class="group-pill__title">{{ \Illuminate\Support\Str::limit($groupName, 36) }}</h3>
                                            @if ($groupRole || $groupJoined)
                                                <p class="group-pill__meta">
                                                    @if ($groupRole)
                                                        <span>{{ ucfirst($groupRole) }}</span>
                                                    @endif
                                                    @if ($groupRole && $groupJoined)
                                                        <span class="group-pill__separator">&bull;</span>
                                                    @endif
                                                    @if ($groupJoined)
                                                        <span>{{ $groupJoined }} in</span>
                                                    @endif
                                                </p>
                                            @endif
                                        </div>
                                    </div>
                                    @if ($groupDescription)
                                        <p class="group-pill__description">{{ \Illuminate\Support\Str::limit(strip_tags($groupDescription), 140) }}</p>
                                    @endif
                                    <div class="group-pill__actions">
                                        <button type="button" class="chip-btn chip-btn--ghost">
                                            <i class="fas fa-door-open me-2"></i>View circle
                                        </button>
                                    </div>
                                </article>
                            @endforeach
                        </div>
                    @else
                        <div class="empty-state">
                            <div class="empty-state__icon">
                                <i class="fas fa-seedling"></i>
                            </div>
                            <h3 class="empty-state__title">Plant your first circle</h3>
                            <p class="empty-state__subtitle">Discover communities aligned with your vision, or start one and gather your allies.</p>
                            <button type="button" class="chip-btn">
                                <i class="fas fa-compass me-2"></i>Browse thriving groups
                            </button>
                        </div>
                    @endif
                </div>
            </div>
        </section>
    </div>
</x-app-layout>
