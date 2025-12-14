@php
    $graph = $socialBackbone['graph'] ?? [];
    $communities = $socialBackbone['communities'] ?? [];
    $ownedCommunities = collect($communities['owned'] ?? [])->take(3);
    $managedCommunities = collect($communities['managed'] ?? [])->take(2);
    $mentorshipCohorts = collect(data_get($socialBackbone, 'mentorship.cohorts', []))->take(2);
    $upcomingEvents = collect(data_get($socialBackbone, 'events.upcoming', []))->take(2);
    $pendingInvites = collect(data_get($socialBackbone, 'invites.items', []))->take(3);
    $followersCount = (int) data_get($graph, 'followers.stored', 0);
    $followingCount = (int) data_get($graph, 'following.stored', 0);
    $closeFriendCount = (int) data_get($graph, 'close_friends.count', 0);
    $inviteCount = (int) data_get($socialBackbone, 'invites.pending_count', 0);
    $resourceCount = (int) data_get($socialBackbone, 'resources.uploaded_count', 0);
    $liveRoomCount = (int) data_get($socialBackbone, 'live_rooms.hosted_count', 0);
    $cacheRefreshedAt = data_get($socialBackboneMeta, 'stored_at');
    $cacheExpiresAt = data_get($socialBackboneMeta, 'expires_at');
    $refreshedHuman = $cacheRefreshedAt
        ? \Illuminate\Support\Carbon::parse($cacheRefreshedAt)->diffForHumans()
        : 'moments ago';
    $expiresHuman = $cacheExpiresAt
        ? \Illuminate\Support\Carbon::parse($cacheExpiresAt)->diffForHumans()
        : null;
@endphp

<div class="dashboard-card dashboard-community-card mb-40">
    <div class="dashboard-card-header d-flex justify-content-between align-items-start flex-wrap gap-3">
        <div>
            <p class="dashboard-card-title mb-1">Community snapshot</p>
            <span class="dashboard-card-subtitle">Live view of your network footprint powering feed and onboarding.</span>
        </div>
        <div class="text-muted small text-end">
            <span class="d-block">Refreshed {{ $refreshedHuman }}</span>
            @if($expiresHuman)
                <span class="d-block">Expires {{ $expiresHuman }}</span>
            @endif
        </div>
    </div>
    <div class="dashboard-card-body">
        <div class="row g-4">
            <div class="col-lg-4">
                <ul class="list-unstyled dashboard-stat-list mb-0">
                    <li>
                        <span class="label">Followers</span>
                        <strong>{{ number_format($followersCount) }}</strong>
                    </li>
                    <li>
                        <span class="label">Following</span>
                        <strong>{{ number_format($followingCount) }}</strong>
                    </li>
                    <li>
                        <span class="label">Close friends</span>
                        <strong>{{ number_format($closeFriendCount) }}</strong>
                    </li>
                    <li>
                        <span class="label">Owned communities</span>
                        <strong>{{ number_format(count($communities['owned'] ?? [])) }}</strong>
                    </li>
                    <li>
                        <span class="label">Pending invites</span>
                        <strong>{{ number_format($inviteCount) }}</strong>
                    </li>
                    <li>
                        <span class="label">Resources uploaded</span>
                        <strong>{{ number_format($resourceCount) }}</strong>
                    </li>
                    <li>
                        <span class="label">Live rooms hosted</span>
                        <strong>{{ number_format($liveRoomCount) }}</strong>
                    </li>
                </ul>
            </div>
            <div class="col-lg-4">
                <h4 class="h6 mb-3">Owned communities</h4>
                @forelse($ownedCommunities as $group)
                    <div class="border rounded-3 p-3 mb-3">
                        <div class="d-flex justify-content-between">
                            <strong>{{ $group['name'] }}</strong>
                            <span class="badge bg-light text-dark">{{ ucfirst($group['visibility'] ?? 'private') }}</span>
                        </div>
                        <p class="mb-2 text-muted small">{{ $group['category'] ?? 'Community' }}</p>
                        <dl class="row mb-0 small">
                            <dt class="col-6">Members</dt>
                            <dd class="col-6 text-end">{{ number_format(data_get($group, 'stats.members', 0)) }}</dd>
                            <dt class="col-6">Lists</dt>
                            <dd class="col-6 text-end">{{ number_format(data_get($group, 'stats.lists', 0)) }}</dd>
                            <dt class="col-6">Events</dt>
                            <dd class="col-6 text-end">{{ number_format(data_get($group, 'stats.events', 0)) }}</dd>
                        </dl>
                    </div>
                @empty
                    <div class="dashboard-empty-state">
                        <i class="fas fa-users"></i>
                        <span class="d-block mt-2">Spin up a community to unlock invites and live programming.</span>
                    </div>
                @endforelse
                <a class="btn btn-link p-0" href="{{ route('member.social.groups') }}">
                    Manage communities
                </a>
            </div>
            <div class="col-lg-4">
                <h4 class="h6 mb-3">Invites & upcoming programs</h4>
                @if($pendingInvites->isNotEmpty())
                    <div class="mb-3">
                        <p class="text-muted small mb-1">Pending invites</p>
                        <ul class="list-unstyled mb-0 small">
                            @foreach($pendingInvites as $invite)
                                <li class="mb-2">
                                    <strong>{{ $invite['recipient_email'] ?? 'Private link' }}</strong>
                                    <span class="d-block text-muted">{{ data_get($invite, 'group.name', 'Group invite') }}</span>
                                </li>
                            @endforeach
                        </ul>
                    </div>
                @else
                    <p class="text-muted small">No pending invites right now.</p>
                @endif

                @if($upcomingEvents->isNotEmpty())
                    <div class="mb-3">
                        <p class="text-muted small mb-1">Upcoming events</p>
                        <ul class="list-unstyled mb-0 small">
                            @foreach($upcomingEvents as $event)
                                @php
                                    $eventStartsAt = $event['starts_at'] ?? null;
                                    $startsAtLabel = $eventStartsAt
                                        ? \Illuminate\Support\Carbon::parse($eventStartsAt)->format('d M Y g:ia')
                                        : 'TBC';
                                @endphp
                                <li class="mb-2">
                                    <strong>{{ $event['title'] }}</strong>
                                    <span class="d-block text-muted">{{ $startsAtLabel }}</span>
                                </li>
                            @endforeach
                        </ul>
                    </div>
                @endif

                @if($mentorshipCohorts->isNotEmpty())
                    <div class="mb-3">
                        <p class="text-muted small mb-1">Mentorship cohorts</p>
                        <ul class="list-unstyled mb-0 small">
                            @foreach($mentorshipCohorts as $cohort)
                                <li class="mb-2">
                                    <strong>{{ data_get($cohort, 'cohort.name', 'Mentorship cohort') }}</strong>
                                    <span class="d-block text-muted">Role: {{ ucfirst($cohort['role'] ?? 'member') }}</span>
                                </li>
                            @endforeach
                        </ul>
                    </div>
                @endif

                @if($managedCommunities->isNotEmpty())
                    <div class="mb-2">
                        <p class="text-muted small mb-1">Moderation roster</p>
                        <ul class="list-unstyled mb-0 small">
                            @foreach($managedCommunities as $managed)
                                <li class="mb-2">
                                    <strong>{{ data_get($managed, 'group.name', 'Community') }}</strong>
                                    <span class="d-block text-muted">{{ data_get($managed, 'role.name', 'Moderator') }}</span>
                                </li>
                            @endforeach
                        </ul>
                    </div>
                @endif

                <a class="btn btn-link p-0" href="{{ route('member.social.connections') }}">
                    Visit social hub
                </a>
            </div>
        </div>
    </div>
</div>
