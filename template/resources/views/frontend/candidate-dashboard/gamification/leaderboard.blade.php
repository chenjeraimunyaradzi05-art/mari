<x-app-layout>
    @php
        $entries = collect($leaderboard ?? []);
        $myStats = collect($myStats ?? []);
        $period = $type ?? 'all_time';
        $statsArray = $myStats->toArray();
        $rankValue = data_get($statsArray, 'rank', $myStats->get('rank', '—'));
        $scoreValue = data_get($statsArray, 'points.total', 0);
        $challengesCompleted = data_get($statsArray, 'challenges.completed', 0);
        $badgesEarned = data_get($statsArray, 'badges.earned', 0);
    @endphp

    <section class="container py-10">
        <div class="d-flex justify-content-between flex-wrap gap-3 mb-5">
            <div>
                <p class="text-uppercase text-primary fw-semibold mb-1">Leaderboard</p>
                <h1 class="h3 mb-1">{{ $entries->count() }} trailblazers</h1>
                <p class="text-muted mb-0">This screen renders whatever <code>GamificationService::getLeaderboard()</code> hands back.</p>
            </div>
            <div class="btn-group" role="group">
                @foreach(['daily' => 'Daily', 'weekly' => 'Weekly', 'all_time' => 'All time'] as $value => $label)
                    <button type="button" class="btn btn-outline-primary @if($period === $value) active @endif" disabled>{{ $label }}</button>
                @endforeach
            </div>
        </div>

        <div class="row g-4 mb-5">
            <div class="col-md-6 col-lg-4">
                <div class="p-4 border rounded-4 h-100">
                    <p class="text-muted text-uppercase small mb-1">Your rank</p>
                    <h2 class="fw-bold">#{{ $rankValue }}</h2>
                    <p class="mb-0 text-muted">Score {{ number_format($scoreValue) }}</p>
                </div>
            </div>
            <div class="col-md-6 col-lg-4">
                <div class="p-4 border rounded-4 h-100">
                    <p class="text-muted text-uppercase small mb-1">Challenges completed</p>
                    <h2 class="fw-bold">{{ number_format($challengesCompleted) }}</h2>
                </div>
            </div>
            <div class="col-md-6 col-lg-4">
                <div class="p-4 border rounded-4 h-100">
                    <p class="text-muted text-uppercase small mb-1">Badges</p>
                    <h2 class="fw-bold">{{ number_format($badgesEarned) }}</h2>
                </div>
            </div>
        </div>

        <div class="card border-0 shadow-sm">
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table align-middle mb-0">
                        <thead class="table-light">
                                <tr>
                                <th class="ps-4">Rank</th>
                                <th>Member</th>
                                <th>Score</th>
                                <th>Streak</th>
                            </tr>
                        </thead>
                        <tbody>
                            @forelse($entries as $entry)
                                <tr>
                                    <td class="ps-4 fw-bold">#{{ data_get($entry, 'rank', '—') }}</td>
                                    <td>
                                        <div class="d-flex align-items-center gap-3">
                                            <div class="rounded-circle bg-primary-subtle text-primary fw-bold d-inline-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                                                {{ strtoupper(substr(data_get($entry, 'name', 'A'), 0, 1)) }}
                                            </div>
                                            <div>
                                                <div class="fw-semibold">{{ data_get($entry, 'name', 'Athena member') }}</div>
                                                <div class="text-muted small">{{ data_get($entry, 'title', 'Role not provided') }}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>{{ number_format(data_get($entry, 'score', 0)) }}</td>
                                    <td>{{ data_get($entry, 'streak_days', 0) }} days</td>
                                </tr>
                            @empty
                                <tr>
                                    <td colspan="4" class="text-center py-5">No leaderboard entries yet.</td>
                                </tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </section>
</x-app-layout>
