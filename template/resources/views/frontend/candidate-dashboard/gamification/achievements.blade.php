<x-app-layout>
    @php
        $earned = collect($earnedBadges ?? []);
        $available = collect($availableBadges ?? []);
    @endphp

    <section class="container py-10">
        <div class="mb-5">
            <p class="text-uppercase text-primary fw-semibold mb-1">Achievements</p>
            <h1 class="h3 mb-2">Celebrate the badges you've unlocked</h1>
            <p class="text-muted mb-0">Data is populated by <code>CandidateBadge</code> and <code>Badge::active()</code>.</p>
        </div>

        <div class="mb-6">
            <h2 class="h5 mb-3">Earned badges</h2>
            <div class="row g-4">
                @forelse($earned as $badge)
                    <div class="col-md-6 col-lg-4">
                        <div class="p-4 border rounded-4 h-100">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <strong>{{ data_get($badge, 'badge.name', 'Badge') }}</strong>
                                <span class="badge bg-success-subtle text-success">{{ data_get($badge, 'badge.category', 'General') }}</span>
                            </div>
                            <p class="text-muted mb-3">{{ data_get($badge, 'badge.description', 'No description provided.') }}</p>
                            <small class="text-muted">Earned {{ optional(data_get($badge, 'earned_at')) instanceof \Carbon\CarbonInterface ? data_get($badge, 'earned_at')->diffForHumans() : (data_get($badge, 'earned_at') ?? 'recently') }}</small>
                        </div>
                    </div>
                @empty
                    <div class="col-12">
                        <div class="text-center border rounded-4 py-5">No badges yet. Complete actions to earn your first one.</div>
                    </div>
                @endforelse
            </div>
        </div>

        <div>
            <h2 class="h5 mb-3">Badges to pursue</h2>
            <div class="row g-4">
                @forelse($available as $badge)
                    <div class="col-md-6 col-lg-4">
                        <div class="p-4 border rounded-4 h-100 bg-light">
                            <strong class="d-block mb-1">{{ data_get($badge, 'name', 'Badge') }}</strong>
                            <p class="text-muted mb-2">{{ data_get($badge, 'description', 'Complete upcoming challenges to unlock this.') }}</p>
                            <small class="text-muted">Rarity: {{ ucfirst(data_get($badge, 'rarity', 'standard')) }}</small>
                        </div>
                    </div>
                @empty
                    <div class="col-12">
                        <div class="text-center border rounded-4 py-5">All available badges are already earned. New badges will appear here automatically.</div>
                    </div>
                @endforelse
            </div>
        </div>
    </section>
</x-app-layout>
