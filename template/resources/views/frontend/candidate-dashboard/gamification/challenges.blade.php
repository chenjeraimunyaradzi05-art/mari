<x-app-layout>
    @php
        $activeChallenges = collect($activeChallenges ?? []);
        $completedChallenges = collect($completedChallenges ?? []);
        $availableChallenges = collect($availableChallenges ?? []);
    @endphp

    <section class="container py-10">
        <div class="mb-5">
            <p class="text-uppercase text-primary fw-semibold mb-1">Challenges</p>
            <h1 class="h3 mb-2">Stay in flow with mindful quests</h1>
            <p class="text-muted mb-0">The controller feeds three collections: active, completed, and available challenges.</p>
        </div>

        <div class="row g-4 mb-6">
            <div class="col-md-6">
                <div class="p-4 border rounded-4 h-100">
                    <p class="text-muted text-uppercase small mb-1">Active</p>
                    <h2 class="fw-bold">{{ $activeChallenges->count() }}</h2>
                </div>
            </div>
            <div class="col-md-6">
                <div class="p-4 border rounded-4 h-100">
                    <p class="text-muted text-uppercase small mb-1">Completed (last 10)</p>
                    <h2 class="fw-bold">{{ $completedChallenges->count() }}</h2>
                </div>
            </div>
        </div>

        <h2 class="h5 mb-3">In progress</h2>
        <div class="row g-4 mb-6">
            @forelse($activeChallenges as $challenge)
                <div class="col-md-6 col-lg-4">
                    <div class="p-4 border rounded-4 h-100">
                        <strong class="d-block mb-1">{{ data_get($challenge, 'challenge.title', 'Challenge') }}</strong>
                        <p class="text-muted mb-2">{{ data_get($challenge, 'challenge.description', 'Keep pushing!') }}</p>
                        <small class="text-muted">Progress: {{ data_get($challenge, 'progress_percentage', 0) }}%</small>
                    </div>
                </div>
            @empty
                <div class="col-12">
                    <div class="text-center border rounded-4 py-5">No active challenges right now.</div>
                </div>
            @endforelse
        </div>

        <h2 class="h5 mb-3">Completed</h2>
        <div class="row g-4 mb-6">
            @forelse($completedChallenges as $challenge)
                <div class="col-md-6">
                    <div class="p-4 border rounded-4 bg-light h-100">
                        <div class="d-flex justify-content-between">
                            <strong>{{ data_get($challenge, 'challenge.title', 'Challenge') }}</strong>
                            <span class="badge bg-success">Done</span>
                        </div>
                        <p class="text-muted mb-2">{{ data_get($challenge, 'challenge.description', 'Description coming soon') }}</p>
                        <small class="text-muted">Completed {{ optional(data_get($challenge, 'completed_at'))->diffForHumans() ?? 'recently' }}</small>
                    </div>
                </div>
            @empty
                <div class="col-12">
                    <div class="text-center border rounded-4 py-5">Finish a challenge to see it here.</div>
                </div>
            @endforelse
        </div>

        <h2 class="h5 mb-3">Available challenges</h2>
        <div class="row g-4">
            @forelse($availableChallenges as $challenge)
                <div class="col-md-6 col-lg-4">
                    <div class="p-4 border rounded-4 h-100">
                        <strong class="d-block mb-1">{{ data_get($challenge, 'title', 'Challenge') }}</strong>
                        <p class="text-muted mb-2">{{ data_get($challenge, 'description', 'Accept the challenge to unlock guidance.') }}</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="badge bg-primary-subtle text-primary text-uppercase">{{ ucfirst(data_get($challenge, 'difficulty', 'standard')) }}</span>
                            <button class="btn btn-sm btn-outline-primary" disabled>
                                <i class="fas fa-rocket me-1"></i>Join soon
                            </button>
                        </div>
                    </div>
                </div>
            @empty
                <div class="col-12">
                    <div class="text-center border rounded-4 py-5">All challenges are already in progress. Fresh ones will appear here.</div>
                </div>
            @endforelse
        </div>
    </section>
</x-app-layout>
