@extends('frontend.social.layout')

@php
    $memberLabel = member_label();
    $membersLabel = member_label('members');
@endphp



@section('social-content')
@php
    $totalActiveMembers = $groups->getCollection()->sum('active_member_count');
    $totalRecentJoins = $groups->getCollection()->sum('recent_join_count');
@endphp
<div class="space-y-8">
    <!-- Hero -->
    <div class="facebook-hero rounded-2xl p-10 text-white shadow-xl">
        <div class="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div class="max-w-2xl">
                <div class="inline-flex items-center gap-2 px-3 py-1 bg-white/15 rounded-full uppercase tracking-wide text-xs font-semibold">
                    <i class="fas fa-users"></i>
                    Your Communities
                </div>
                <h1 class="mt-4 text-4xl font-extrabold">Stay in sync with the groups that matter</h1>
                <p class="mt-3 text-white/80 text-lg">Discover professional circles, nurture collaborations, and keep the conversation going—just like your favorite Facebook groups.</p>
            </div>
            <div class="grid gap-4 w-full lg:w-auto sm:grid-cols-3">
                <div class="rounded-xl bg-white/10 backdrop-blur-sm px-5 py-4">
                    <p class="text-xs uppercase text-white/60">Joined</p>
                    <p class="text-3xl font-bold mt-1">{{ $groupsCount ?? 0 }}</p>
                    <p class="text-sm text-white/70">Active memberships</p>
                </div>
                <div class="rounded-xl bg-white/10 backdrop-blur-sm px-5 py-4">
                    <p class="text-xs uppercase text-white/60">Active {{ $membersLabel }}</p>
                    <p class="text-3xl font-bold mt-1">{{ $totalActiveMembers }}</p>
                    <p class="text-sm text-white/70">Connected peers</p>
                </div>
                <div class="rounded-xl bg-white/10 backdrop-blur-sm px-5 py-4">
                    <p class="text-xs uppercase text-white/60">New This Month</p>
                    <p class="text-3xl font-bold mt-1">{{ $totalRecentJoins }}</p>
                    <p class="text-sm text-white/70">Fresh discussions</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Toolbar -->
    <div class="bg-white rounded-2xl shadow-md p-6 border border-slate-100">
        <div class="group-toolbar">
            <div class="relative">
                <span class="absolute inset-y-0 left-4 flex items-center text-slate-400">
                    <i class="fas fa-search"></i>
                </span>
                <input type="text" class="form-control" id="groupSearch" placeholder="Search your groups" onkeyup="searchGroups()">
            </div>
            <div class="flex items-center justify-end gap-3">
                <button type="button" class="group-pill active px-4 py-2 text-sm font-semibold" id="filter-joined" onclick="filterGroups('joined')">
                    <i class="fas fa-user-check mr-2"></i>Joined
                </button>
                <button type="button" class="group-pill px-4 py-2 text-sm font-semibold" id="filter-discover" onclick="filterGroups('discover')">
                    <i class="fas fa-compass mr-2"></i>Discover
                </button>
                <button type="button" class="group-pill px-4 py-2 text-sm font-semibold" id="filter-manage" onclick="filterGroups('manage')">
                    <i class="fas fa-cog mr-2"></i>Manage
                </button>
            </div>
        </div>
        <div class="mt-4 group-filters">
            <span class="group-filter-chip" data-mode="recent" onclick="sortGroups('recent')"><i class="fas fa-bolt mr-1"></i>Most active</span>
            <span class="group-filter-chip inactive" data-mode="members" onclick="sortGroups('members')"><i class="fas fa-users mr-1"></i>{{ $memberLabel }} size</span>
            <span class="group-filter-chip inactive" data-filter="events" onclick="filterGroups('events')"><i class="fas fa-calendar mr-1"></i>Events</span>
            <span class="group-filter-chip inactive" data-filter="private" onclick="filterGroups('private')"><i class="fas fa-lock mr-1"></i>Private</span>
            <button class="ml-auto btn btn-sm btn-gradient" data-bs-toggle="modal" data-bs-target="#aiGroupRecommendationsModal">
                <i class="fas fa-magic mr-2"></i>AI Recommendations
            </button>
            <a href="{{ route('member.social.groups.create') }}" class="btn btn-sm btn-outline-gradient">
                <i class="fas fa-plus mr-2"></i>Create Group
            </a>
        </div>
    </div>

    @php
        $groupCollection = $groups instanceof \Illuminate\Pagination\AbstractPaginator
            ? $groups->getCollection()
            : collect($groups ?? []);
    @endphp

    <!-- Tabs -->
    <ul class="nav nav-tabs bg-white rounded-lg shadow-md" role="tablist">
        <li class="nav-item" role="presentation">
            <button class="nav-link active" id="joined-tab" data-bs-toggle="tab" data-bs-target="#joined" type="button" role="tab">
                <i class="fas fa-door-open mr-2"></i>Joined Groups ({{ $groupCollection->count() }})
            </button>
        </li>
        <li class="nav-item" role="presentation">
            <button class="nav-link" id="discover-tab" data-bs-toggle="tab" data-bs-target="#discover" type="button" role="tab">
                <i class="fas fa-compass mr-2"></i>Discover Groups
            </button>
        </li>
        <li class="nav-item" role="presentation">
            <button class="nav-link" id="recommendations-tab" data-bs-toggle="tab" data-bs-target="#recommendations" type="button" role="tab">
                <i class="fas fa-star mr-2"></i>Recommended (<span id="rec-count">0</span>)
            </button>
        </li>
    </ul>

    <!-- Tab Content -->
    <div class="tab-content">
        <!-- Joined Groups -->
        <div class="tab-pane fade show active" id="joined" role="tabpanel">
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
                @forelse($groupCollection as $group)
                    @php
                        $lastEngagement = $group->last_engagement_at instanceof \Carbon\CarbonInterface
                            ? $group->last_engagement_at
                            : null;
                    @endphp
                    <div class="group-card rounded-2xl bg-white overflow-hidden shadow-sm">
                        <div class="relative h-36 bg-slate-200">
                            @if($group->cover_image)
                                <img src="{{ $group->cover_image }}" alt="{{ $group->name }}" class="w-full h-full object-cover">
                            @else
                                <div class="h-full w-full flex items-center justify-center text-slate-400">
                                    <i class="fas fa-users fa-3x"></i>
                                </div>
                            @endif
                            <div class="absolute inset-x-0 bottom-3 px-4 flex items-center justify-between">
                                <span class="group-signal">
                                    <i class="fas fa-signal"></i>
                                    {{ $group->activity_score ?? 0 }}% active
                                </span>
                                <span class="px-3 py-1 bg-white/90 rounded-full text-xs font-semibold text-slate-700 shadow-sm">
                                    {{ $group->members_count ?? 0 }} {{ $membersLabel }}
                                </span>
                            </div>
                        </div>

                        <div class="p-5 space-y-4">
                            <div class="flex items-start justify-between gap-4">
                                <div>
                                    <h3 class="text-lg font-semibold text-slate-900">{{ $group->name }}</h3>
                                    <p class="mt-1 text-sm text-slate-600 line-clamp-2">{{ $group->description ?? 'Bring your community together with purposeful conversations.' }}</p>
                                </div>
                                <div class="text-right text-xs text-slate-500">
                                    <span class="inline-flex items-center gap-1">
                                        <i class="fas fa-clock"></i>
                                        {{ $lastEngagement ? $lastEngagement->diffForHumans() : 'No recent activity' }}
                                    </span>
                                </div>
                            </div>

                            <div class="group-meta">
                                <span><i class="fas fa-user-plus mr-1 text-slate-400"></i>{{ $group->recent_join_count ?? 0 }} joined recently</span>
                                <span><i class="fas fa-user-friends mr-1 text-slate-400"></i>{{ $group->active_member_count ?? 0 }} active</span>
                                <span><i class="fas fa-globe mr-1 text-slate-400"></i>{{ $group->visibility === 'private' ? 'Private' : 'Public' }}</span>
                            </div>

                            <div class="flex items-center justify-between">
                                <div class="member-avatar-stack flex -space-x-2">
                                    @foreach(($group->members ?? collect())->take(4) as $member)
                                        <img src="{{ $member->user->avatar_url ?? $member->user->image ?? asset('images/default-avatar.png') }}" alt="{{ $member->user->name }}" class="w-9 h-9 rounded-full object-cover" title="{{ $member->user->name }}">
                                    @endforeach
                                    @if(($group->members_count ?? 0) > 4)
                                        <div class="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">+{{ ($group->members_count ?? 0) - 4 }}</div>
                                    @endif
                                </div>
                                <span class="text-xs text-slate-500">Managed by {{ optional($group->creator)->name ?? 'someone in your network' }}</span>
                            </div>

                            <div class="group-card-footer">
                                <a href="{{ route('member.social.groups.show', $group) }}" class="flex-1 btn btn-sm btn-outline-gradient">
                                    <i class="fas fa-comments mr-1"></i>View feed
                                </a>
                                @if($group->created_by === auth()->id())
                                    <a href="{{ route('member.social.groups.edit', $group) }}" class="btn btn-sm btn-outline-secondary" title="Edit group">
                                        <i class="fas fa-pen"></i>
                                    </a>
                                @endif
                                <button class="btn btn-sm btn-outline-danger" onclick="leaveGroup({{ $group->id }})" title="Leave group">
                                    <i class="fas fa-sign-out-alt"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                @empty
                    <div class="col-span-full">
                        <div class="group-empty-state p-12 text-center text-slate-600">
                            <i class="fas fa-users fa-3x text-slate-300 mb-4"></i>
                            <h3 class="text-xl font-semibold text-slate-800">Discover communities that match your interests</h3>
                            <p class="mt-2 text-sm">Start by exploring recommended groups or create your own space for collaboration.</p>
                            <div class="mt-5 flex flex-wrap justify-center gap-3">
                                <button class="btn btn-sm btn-gradient" data-bs-toggle="modal" data-bs-target="#aiGroupRecommendationsModal">
                                    <i class="fas fa-compass mr-2"></i>Browse recommendations
                                </button>
                                <a href="{{ route('member.social.groups.create') }}" class="btn btn-sm btn-outline-gradient">
                                    <i class="fas fa-plus mr-2"></i>Create a group
                                </a>
                            </div>
                        </div>
                    </div>
                @endforelse
            </div>
        </div>

        <!-- Discover Groups -->
        <div class="tab-pane fade" id="discover" role="tabpanel">
            <div class="mt-6 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <div class="flex items-center gap-3 text-slate-600">
                    <span class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                        <i class="fas fa-compass"></i>
                    </span>
                    <div>
                        <h3 class="font-semibold text-slate-900">Fresh groups to explore</h3>
                        <p class="text-sm">We track industries, roles, and peers you follow to uncover new spaces for you.</p>
                    </div>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6" id="discover-container">
                <!-- Populated by AJAX -->
            </div>
        </div>

        <!-- Recommended Groups -->
        <div class="tab-pane fade" id="recommendations" role="tabpanel">
            <div class="mt-6 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <div class="flex items-center gap-3 text-slate-600">
                    <span class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                        <i class="fas fa-magic"></i>
                    </span>
                    <div>
                        <h3 class="font-semibold text-slate-900">AI-powered picks</h3>
                        <p class="text-sm">These suggestions combine shared skills, mutual connections, and industry momentum.</p>
                    </div>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6" id="recommendations-container">
                <!-- Populated by AJAX -->
            </div>
        </div>
    </div>
</div>

<!-- AI Group Recommendations Modal -->
<div class="modal fade" id="aiGroupRecommendationsModal" tabindex="-1">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                <h5 class="modal-title"><i class="fas fa-magic mr-2"></i>AI Group Recommendations</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <div id="rec-loader" class="text-center py-4">
                    <div class="spinner-border text-indigo-600 mb-3" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p>Finding perfect groups based on your interests and connections...</p>
                </div>
                <div id="rec-content" style="display: none;">
                    <!-- Populated by AJAX -->
                </div>
            </div>
        </div>
    </div>
</div>

@push('scripts')
<script src="{{ asset('js/social/groups.js') }}"></script>
<script>
const groupBaseUrl = '{{ url('/member/social/groups') }}';
const groupPills = document.querySelectorAll('.group-pill');
const groupFilterChips = document.querySelectorAll('.group-filter-chip');
const groupMemberLabels = window.memberLabels || {};
const groupMembersLabel = groupMemberLabels.members || 'Members';

// Load recommendations when modal opens
document.getElementById('aiGroupRecommendationsModal').addEventListener('show.bs.modal', function() {
    loadGroupRecommendations();
});

function loadGroupRecommendations() {
    fetch('{{ route("member.social.groups.ai-recommendations") }}')
        .then(response => response.json())
        .then(data => {
            document.getElementById('rec-loader').style.display = 'none';
            document.getElementById('rec-content').style.display = 'block';
            renderGroupRecommendations(data);
            document.getElementById('rec-count').textContent = data.length;
        })
        .catch(error => console.error('Error:', error));
}

function renderGroupRecommendations(groups) {
    const html = groups.map(group => `
        <article class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-lg transition">
            <div class="flex items-start gap-4">
                <div class="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center text-xl">
                    <i class="fas fa-users"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <h6 class="font-semibold text-slate-900 truncate">${group.name}</h6>
                            <p class="text-sm text-slate-600 mt-1 line-clamp-2">${group.description}</p>
                        </div>
                        <span class="group-signal">${group.activity_score}% active</span>
                    </div>
                    <div class="mt-3 flex items-center gap-4 text-xs text-slate-500">
                        <span><i class="fas fa-users mr-1 text-slate-400"></i>${group.members_count} ${groupMembersLabel}</span>
                        <span><i class="fas fa-handshake mr-1 text-slate-400"></i>High overlap</span>
                    </div>
                </div>
            </div>
            <div class="mt-4 flex justify-end">
                <button onclick="joinGroup(${group.id})" class="btn btn-sm btn-gradient">
                    <i class="fas fa-plus mr-1"></i>Join group
                </button>
            </div>
        </article>
    `).join('');
    document.getElementById('rec-content').innerHTML = html;
}

function joinGroup(groupId) {
    fetch(`${groupBaseUrl}/${groupId}/join`, {
        method: 'POST',
        headers: {
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
            'Content-Type': 'application/json'
        }
    }).then(response => response.json())
    .then(() => location.reload());
}

function leaveGroup(groupId) {
    if (confirm('Are you sure you want to leave this group?')) {
        fetch(`${groupBaseUrl}/${groupId}/leave`, {
            method: 'POST',
            headers: {
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
            }
        }).then(() => location.reload());
    }
}

function searchGroups() {
    // AJAX search
}

function filterGroups(scope = '') {
    const pillScopes = ['joined', 'discover', 'manage'];
    if (pillScopes.includes(scope)) {
        groupPills.forEach((pill) => {
            if (!pill.id) return;
            const isActive = pill.id === `filter-${scope}`;
            pill.classList.toggle('active', isActive);
        });
    }

    const matchingChip = Array.from(groupFilterChips).find((chip) => chip.dataset.filter === scope);
    if (matchingChip) {
        setActiveFilterChip(scope);
    } else if (pillScopes.includes(scope) || !scope) {
        setActiveFilterChip('');
    }

    console.debug('filterGroups scope:', scope);
}

function sortGroups(mode = '') {
    setActiveModeChip(mode);
    console.debug('sortGroups mode:', mode);
}

function setActiveModeChip(mode) {
    groupFilterChips.forEach((chip) => {
        if (!chip.dataset.mode) {
            return;
        }
        const isActive = chip.dataset.mode === mode;
        chip.classList.toggle('inactive', !isActive);
    });
}

function setActiveFilterChip(filter) {
    groupFilterChips.forEach((chip) => {
        if (!chip.dataset.filter) {
            return;
        }
        const isActive = filter && chip.dataset.filter === filter;
        chip.classList.toggle('inactive', !isActive);
    });
}

setActiveModeChip('recent');
</script>
@endpush
@endsection

