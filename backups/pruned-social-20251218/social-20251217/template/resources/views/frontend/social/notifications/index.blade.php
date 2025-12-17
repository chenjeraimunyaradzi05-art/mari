@extends('frontend.social.layout')

@section('social-content')
@php
    $memberLabel = member_label();
    $membersLabel = member_label('members');
@endphp
<div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
            <h2 class="text-3xl font-bold text-gray-900">Notifications & Invites</h2>
            <p class="text-gray-600 mt-1">Stay updated with your {{ strtolower($membersLabel) }} network</p>
        </div>
        <div class="flex gap-3">
            <button class="btn btn-outline-secondary" onclick="markAllAsRead()">
                <i class="fas fa-check-double mr-2"></i>Mark All as Read
            </button>
            <button class="btn btn-outline-danger" onclick="clearAll()">
                <i class="fas fa-trash mr-2"></i>Clear All
            </button>
        </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-lg shadow-md p-4">
        <div class="flex gap-3 flex-wrap align-items-center">
            <button class="filter-btn active" data-filter="all">
                <i class="fas fa-bell mr-2"></i>All
                <span class="filter-count" data-filter-count="all">0</span>
            </button>
            <button class="filter-btn" data-filter="connections">
                <i class="fas fa-link mr-2"></i>Connections
                <span class="filter-count" data-filter-count="connections">0</span>
            </button>
            <button class="filter-btn" data-filter="posts">
                <i class="fas fa-newspaper mr-2"></i>Posts
                <span class="filter-count" data-filter-count="posts">0</span>
            </button>
            <button class="filter-btn" data-filter="groups">
                <i class="fas fa-users mr-2"></i>Groups
                <span class="filter-count" data-filter-count="groups">0</span>
            </button>
            <button class="filter-btn" data-filter="messages">
                <i class="fas fa-envelope mr-2"></i>Messages
                <span class="filter-count" data-filter-count="messages">0</span>
            </button>
            <button class="filter-btn" data-filter="invites">
                <i class="fas fa-envelope-open mr-2"></i>Invites
                <span class="filter-count" data-filter-count="invites">0</span>
            </button>
            <div class="filter-search">
                <i class="fas fa-search filter-search-icon"></i>
                <input type="search" id="notifications-search" class="filter-search-input" placeholder="Search notifications...">
            </div>
            <button type="button" class="filter-toggle" id="notifications-unread-toggle" aria-pressed="false">
                <i class="fas fa-eye-slash mr-2"></i>
                <span class="filter-toggle-label">Unread Only</span>
            </button>
        </div>
        <div id="notifications-status" class="notification-status-alert d-none" role="status" aria-live="polite"></div>
    </div>

    <!-- Tabs -->
    <ul class="nav nav-tabs bg-white rounded-lg shadow-md" role="tablist">
        <li class="nav-item" role="presentation">
            <button class="nav-link active" id="notifications-tab" data-bs-toggle="tab" data-bs-target="#notifications" type="button" role="tab">
                <i class="fas fa-bell mr-2"></i>Notifications (<span id="notif-count">0</span>)
            </button>
        </li>
        <li class="nav-item" role="presentation">
            <button class="nav-link" id="invites-tab" data-bs-toggle="tab" data-bs-target="#invites" type="button" role="tab">
                <i class="fas fa-inbox mr-2"></i>{{ $memberLabel }} Invites (<span id="invites-count">0</span>)
            </button>
        </li>
        <li class="nav-item" role="presentation">
            <button class="nav-link" id="group-invites-tab" data-bs-toggle="tab" data-bs-target="#group-invites" type="button" role="tab">
                <i class="fas fa-door-open mr-2"></i>Group Invites (<span id="group-invites-count">0</span>)
            </button>
        </li>
        <li class="nav-item" role="presentation">
            <button class="nav-link" id="request-center-tab" data-bs-toggle="tab" data-bs-target="#request-center" type="button" role="tab">
                <i class="fas fa-envelope-open-text mr-2"></i>Request Center (<span data-request-center-count>0</span>)
            </button>
        </li>
    </ul>

    <!-- Tab Content -->
    <div class="tab-content">
        <!-- Notifications -->
        <div class="tab-pane fade show active" id="notifications" role="tabpanel">
            <div class="space-y-3 mt-6" id="notifications-container">
                @forelse($notifications ?? [] as $notification)
                <div class="notification-item bg-white rounded-lg shadow-md p-4 border-l-4 border-indigo-600 {{ $notification->read_at ? 'opacity-75' : '' }}"
                    data-notification-id="{{ $notification->id }}"
                    data-category="{{ strtolower($notification->data['category'] ?? 'general') }}"
                    data-unread="{{ $notification->read_at ? '0' : '1' }}">
                        <div class="flex gap-4">
                            <img src="{{ $notification->data['avatar_url'] ?? 'https://via.placeholder.com/48' }}"
                                 alt="Notification" class="w-12 h-12 rounded-full object-cover flex-shrink-0">

                            <div class="flex-1">
                                <div class="flex items-start justify-between gap-2">
                                    <div>
                                        <h6 class="font-bold text-gray-900">{{ $notification->data['title'] ?? 'Notification' }}</h6>
                                        <p class="text-sm text-gray-700 mt-1">{{ $notification->data['message'] ?? '' }}</p>
                                    </div>
                                    <div class="text-right flex-shrink-0">
                                        @if(!$notification->read_at)
                                            <span class="badge bg-indigo-600 mb-2">New</span>
                                        @endif
                                        <small class="text-gray-600 block">
                                            {{ $notification->created_at->diffForHumans() }}
                                        </small>
                                    </div>
                                </div>

                                <!-- Notification Actions -->
                                <div class="flex gap-2 mt-3">
                                    @if($notification->data['action_url'] ?? false)
                                        <a href="{{ $notification->data['action_url'] }}" class="btn btn-sm btn-gradient">
                                            <i class="fas fa-arrow-right mr-1"></i>{{ $notification->data['action_label'] ?? 'View' }}
                                        </a>
                                    @endif
                                    <button class="btn btn-sm btn-outline-secondary" onclick="dismissNotification({{ $notification->id }})">
                                        <i class="fas fa-times mr-1"></i>Dismiss
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                @empty
                    <div class="bg-gray-50 rounded-lg p-12 text-center">
                        <i class="fas fa-inbox text-4xl text-gray-300 mb-4"></i>
                        <p class="text-gray-600">No notifications yet</p>
                    </div>
                @endforelse
            </div>

            <div class="mt-6 text-center">
                <button id="notifications-load-more" class="btn btn-outline-primary">
                    <i class="fas fa-spinner fa-spin mr-2 d-none" id="notifications-load-more-spinner"></i>
                    <span id="notifications-load-more-label">Load More</span>
                </button>
            </div>
        </div>

        <!-- Connection Invites -->
        <div class="tab-pane fade" id="invites" role="tabpanel">
            <div class="space-y-3 mt-6" id="invites-container">
                @forelse($connectionInvites ?? [] as $invite)
                    <div class="invite-card bg-white rounded-lg shadow-md p-4 border-l-4 border-green-600">
                        <div class="flex gap-4">
                            <img src="{{ $invite->sender->avatar_url ?? 'https://via.placeholder.com/48' }}"
                                 alt="{{ $invite->sender->name }}" class="w-12 h-12 rounded-full object-cover flex-shrink-0">

                            <div class="flex-1">
                                <h6 class="font-bold text-gray-900">{{ $invite->sender->name }}</h6>
                                <p class="text-sm text-gray-600">
                                    {{ $invite->sender->candidate?->headline ?? 'Professional' }}
                                </p>
                                <small class="text-gray-500">{{ $invite->created_at->diffForHumans() }}</small>

                                <!-- Mutual Connections Count -->
                                <div class="mt-2 text-sm">
                                    <i class="fas fa-link text-indigo-600 mr-2"></i>
                                    <span class="text-indigo-600 font-medium">
                                        {{ count($invite->mutualConnections()) }} mutual connections
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div class="flex gap-2 mt-4">
                            <button class="flex-1 btn btn-sm btn-gradient"
                                    onclick="acceptInvite({{ $invite->id }}, 'connection')">
                                <i class="fas fa-check mr-1"></i>Accept
                            </button>
                            <button class="flex-1 btn btn-sm btn-outline-danger"
                                    onclick="rejectInvite({{ $invite->id }}, 'connection')">
                                <i class="fas fa-times mr-1"></i>Decline
                            </button>
                        </div>
                    </div>
                @empty
                    <div class="bg-gray-50 rounded-lg p-12 text-center">
                        <i class="fas fa-inbox text-4xl text-gray-300 mb-4"></i>
                        <p class="text-gray-600">No pending connection invites</p>
                    </div>
                @endforelse
            </div>
        </div>

        <!-- Group Invites -->
        <div class="tab-pane fade" id="group-invites" role="tabpanel">
            <div class="space-y-3 mt-6" id="group-invites-container">
                @forelse($groupInvites ?? [] as $invite)
                    <div class="invite-card bg-white rounded-lg shadow-md p-4 border-l-4 border-purple-600">
                        <div class="flex gap-4">
                            <div class="w-12 h-12 rounded-lg bg-gradient-to-r from-indigo-400 to-purple-400 flex items-center justify-center text-white font-bold flex-shrink-0">
                                {{ substr($invite->group->name, 0, 2) }}
                            </div>

                            <div class="flex-1">
                                <h6 class="font-bold text-gray-900">{{ $invite->group->name }}</h6>
                                <p class="text-sm text-gray-600">
                                    Invited by <strong>{{ $invite->invitedBy->name }}</strong>
                                </p>
                                <p class="text-sm text-gray-600 mt-1">{{ $invite->group->description }}</p>
                                <small class="text-gray-500">{{ $invite->created_at->diffForHumans() }}</small>

                                <!-- Group Stats -->
                                <div class="mt-2 flex gap-4 text-xs text-gray-600">
                                    <span><i class="fas fa-users mr-1"></i>{{ $invite->group->members_count ?? 0 }} {{ $membersLabel }}</span>
                                    <span><i class="fas fa-fire mr-1"></i>{{ $invite->group->activity_score ?? 0 }}% activity</span>
                                </div>
                            </div>
                        </div>

                        <div class="flex gap-2 mt-4">
                            <button class="flex-1 btn btn-sm btn-gradient"
                                    onclick="acceptInvite({{ $invite->id }}, 'group')">
                                <i class="fas fa-check mr-1"></i>Join Group
                            </button>
                            <button class="flex-1 btn btn-sm btn-outline-danger"
                                    onclick="rejectInvite({{ $invite->id }}, 'group')">
                                <i class="fas fa-times mr-1"></i>Decline
                            </button>
                        </div>
                    </div>
                @empty
                    <div class="bg-gray-50 rounded-lg p-12 text-center">
                        <i class="fas fa-inbox text-4xl text-gray-300 mb-4"></i>
                        <p class="text-gray-600">No pending group invites</p>
                    </div>
                @endforelse
            </div>
        </div>

        <!-- Request Center -->
        <div class="tab-pane fade" id="request-center" role="tabpanel">
            <div class="space-y-4 mt-6"
                 data-request-center
                 data-request-center-fetch="{{ route('api.v1.messaging.requests.index') }}"
                 data-request-center-approve="{{ route('api.v1.messaging.requests.approve', '__REQUEST__') }}"
                 data-request-center-decline="{{ route('api.v1.messaging.requests.decline', '__REQUEST__') }}"
                 data-request-center-status="pending"
                 data-request-center-per-page="10">
                <div class="bg-white rounded-lg shadow-md p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div class="btn-group" role="group" aria-label="Request filters">
                        <button type="button" class="btn btn-sm btn-outline-primary active" data-request-filter="pending" aria-pressed="true">
                            <i class="fas fa-hourglass-half mr-1"></i>Pending
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-primary" data-request-filter="approved" aria-pressed="false">
                            <i class="fas fa-check mr-1"></i>Approved
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-primary" data-request-filter="declined" aria-pressed="false">
                            <i class="fas fa-times mr-1"></i>Declined
                        </button>
                    </div>
                    <div class="flex gap-2">
                        <button type="button" class="btn btn-sm btn-outline-secondary" data-request-center-refresh>
                            <i class="fas fa-sync mr-1"></i>Refresh
                        </button>
                    </div>
                </div>

                <div class="bg-white rounded-lg border border-dashed border-indigo-200 p-4 flex items-center gap-3" data-request-center-loading hidden>
                    <i class="fas fa-spinner fa-spin text-indigo-500"></i>
                    <div>
                        <p class="font-semibold text-gray-900">Syncing your inbox…</p>
                        <p class="text-sm text-gray-600">Pulling the latest introductions and message requests.</p>
                    </div>
                </div>

                <div class="alert alert-danger d-none" role="alert" data-request-center-error></div>

                <div class="bg-gray-50 rounded-lg p-8 text-center" data-request-center-empty hidden>
                    <i class="fas fa-inbox text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-600 mb-2">No message requests in this view</p>
                    <p class="text-sm text-gray-500">Once someone outside your circle reaches out, their note will appear here for review.</p>
                </div>

                <div class="space-y-3" data-request-center-list></div>

                <div class="text-center" data-request-center-pagination>
                    <button type="button" class="btn btn-outline-primary d-none" data-request-center-load-more>
                        <i class="fas fa-spinner fa-spin mr-2 d-none" data-request-center-load-more-spinner></i>
                        <span data-request-center-load-more-label>Load more</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>



@push('scripts')
<script>
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
const notificationsState = {
    container: null,
    countEl: null,
    loadMoreBtn: null,
    loadMoreLabel: null,
    loadMoreSpinner: null,
    perPage: 15,
    page: 1,
    lastPage: 1,
    loading: false,
    activeFilter: 'all',
    categoryFilter: null,
    searchTerm: '',
    filterCounts: {},
    summary: null,
    showUnreadOnly: false,
    unreadToggle: null,
    statusEl: null,
    statusTimer: null,
    currentAbortController: null,
};

const notificationPreferencesStorageKey = 'notifications.preferences.v1';

function loadNotificationPreferences() {
    if (typeof window === 'undefined' || !window?.localStorage) {
        return null;
    }

    try {
        const raw = window.localStorage.getItem(notificationPreferencesStorageKey);
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }

        return parsed;
    } catch (error) {
        console.warn('Failed to load notification preferences from storage:', error);
        return null;
    }
}

function persistNotificationPreferences(overrides = {}) {
    if (typeof window === 'undefined' || !window?.localStorage) {
        return;
    }

    try {
        const snapshot = {
            filter: notificationsState.activeFilter,
            category: notificationsState.categoryFilter,
            searchTerm: notificationsState.searchTerm,
            showUnreadOnly: notificationsState.showUnreadOnly,
            page: notificationsState.page,
            perPage: notificationsState.perPage,
            ...overrides,
        };

        window.localStorage.setItem(notificationPreferencesStorageKey, JSON.stringify(snapshot));
    } catch (error) {
        console.warn('Failed to persist notification preferences:', error);
    }
}

const filterCategoryMap = {
    all: [],
    invites: ['org_invite'],
    connections: ['connection'],
    posts: ['post'],
    groups: ['group'],
    messages: ['message'],
};

const filterLabelMap = {
    all: 'All',
    connections: 'Connection',
    posts: 'Post',
    groups: 'Group',
    messages: 'Message',
    invites: 'Invite',
};

function getFilterLabel(filterKey) {
    if (!filterKey) {
        return filterLabelMap.all;
    }

    const normalized = String(filterKey).toLowerCase();
    return filterLabelMap[normalized] ?? normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveCategoryFilter(filterKey) {
    if (filterKey === 'all' || !filterKey) {
        return null;
    }

    const mapped = filterCategoryMap[filterKey];
    if (Array.isArray(mapped) && mapped.length > 0) {
        return mapped[0];
    }

    return filterKey;
}

function debounce(fn, delay = 300) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

function ensureNotificationState() {
    if (!notificationsState.container) {
        notificationsState.container = document.getElementById('notifications-container');
    }
    if (!notificationsState.countEl) {
        notificationsState.countEl = document.getElementById('notif-count');
    }
    if (!notificationsState.loadMoreBtn) {
        notificationsState.loadMoreBtn = document.getElementById('notifications-load-more');
        notificationsState.loadMoreLabel = document.getElementById('notifications-load-more-label');
        notificationsState.loadMoreSpinner = document.getElementById('notifications-load-more-spinner');
        if (notificationsState.loadMoreBtn) {
            notificationsState.loadMoreBtn.classList.add('d-none');
        }
    }

    if (!notificationsState.filterCounts || Object.keys(notificationsState.filterCounts).length === 0) {
        notificationsState.filterCounts = {};
        document.querySelectorAll('[data-filter-count]').forEach((element) => {
            const key = element.dataset.filterCount;
            if (!key) {
                return;
            }

            notificationsState.filterCounts[key] = element;
            if (key !== 'all') {
                element.classList.add('d-none');
            }
        });
    }

    if (!notificationsState.unreadToggle) {
        notificationsState.unreadToggle = document.getElementById('notifications-unread-toggle');
        if (notificationsState.unreadToggle) {
            notificationsState.unreadToggle.setAttribute('aria-pressed', notificationsState.showUnreadOnly ? 'true' : 'false');
            notificationsState.unreadToggle.classList.toggle('active', notificationsState.showUnreadOnly);
        }
    }
    if (!notificationsState.statusEl) {
        notificationsState.statusEl = document.getElementById('notifications-status');
    }
    return Boolean(notificationsState.container);
}

function setUnreadOnlyState(active) {
    const normalized = Boolean(active);
    notificationsState.showUnreadOnly = normalized;

    if (notificationsState.unreadToggle) {
        notificationsState.unreadToggle.setAttribute('aria-pressed', normalized ? 'true' : 'false');
        notificationsState.unreadToggle.classList.toggle('active', normalized);
    }
}

function toggleUnreadOnly(forceState) {
    ensureNotificationState();
    const nextState = typeof forceState === 'boolean' ? forceState : !notificationsState.showUnreadOnly;
    setUnreadOnlyState(nextState);
    notificationsState.page = 1;
    applyNotificationFilter();
    persistNotificationPreferences({ page: 1 });
    loadNotifications(1).catch(() => {});
}

function clearNotificationStatus() {
    if (notificationsState.statusTimer) {
        clearTimeout(notificationsState.statusTimer);
        notificationsState.statusTimer = null;
    }

    if (!notificationsState.statusEl) {
        return;
    }

    notificationsState.statusEl.textContent = '';
    notificationsState.statusEl.classList.add('d-none');
    notificationsState.statusEl.classList.remove('notification-status-error', 'notification-status-loading');
}

function showNotificationStatus(message, { type = 'info', persist = false, timeout = 5000 } = {}) {
    if (!ensureNotificationState() || !notificationsState.statusEl) {
        return;
    }

    if (notificationsState.statusTimer) {
        clearTimeout(notificationsState.statusTimer);
        notificationsState.statusTimer = null;
    }

    const element = notificationsState.statusEl;
    element.textContent = message;
    element.classList.remove('d-none', 'notification-status-error', 'notification-status-loading');

    if (type === 'error') {
        element.classList.add('notification-status-error');
    } else if (type === 'loading') {
        element.classList.add('notification-status-loading');
    }

    if (!persist) {
        notificationsState.statusTimer = window.setTimeout(() => {
            clearNotificationStatus();
        }, timeout);
    }
}

function setNotificationLoading(isLoading) {
    notificationsState.loading = isLoading;
    if (isLoading) {
        showNotificationStatus('Loading notifications…', { type: 'loading', persist: true });
    } else {
        clearNotificationStatus();
    }
}

const notificationMetaLabelMap = {
    invitee_email: 'Invitee',
    channel: 'Channel',
    invite_reason: 'Reason',
    inviter_name: 'Inviter',
    page_name: 'Page',
};

function formatMetaValue(key, value) {
    if (value === null || value === undefined) {
        return '';
    }
    if (key === 'channel') {
        return String(value).toUpperCase();
    }
    return String(value);
}

function buildMetaBadges(meta) {
    if (!meta || typeof meta !== 'object') {
        return [];
    }

    return Object.entries(meta)
        .filter(([, value]) => value !== null && value !== undefined && value !== '')
        .map(([key, value]) => {
            const derivedLabel = notificationMetaLabelMap[key] ?? key.replace(/_/g, ' ');
            const label = derivedLabel.replace(/\b\w/g, (char) => char.toUpperCase());
            return `<span class="notification-meta-badge">${escapeHtml(label)}: ${escapeHtml(formatMetaValue(key, value))}</span>`;
        });
}

function sumCategoryTotals(categoryStats, keys) {
    if (!categoryStats || typeof categoryStats !== 'object') {
        return 0;
    }

    const entries = Object.entries(categoryStats);
    if (!Array.isArray(keys) || keys.length === 0) {
        return entries.reduce((total, [, stats]) => total + Number(stats?.total ?? 0), 0);
    }

    const normalizedKeys = keys.map((key) => key.toLowerCase());
    return entries.reduce((total, [category, stats]) => {
        const lower = category.toLowerCase();
        const matches = normalizedKeys.some((target) => lower === target || lower.startsWith(`${target}.`));
        if (!matches) {
            return total;
        }

        return total + Number(stats?.total ?? 0);
    }, 0);
}

function updateCountsFromSummary(summary) {
    if (!summary || !ensureNotificationState()) {
        return;
    }

    if (notificationsState.countEl && typeof summary.total === 'number') {
        notificationsState.countEl.textContent = summary.total;
    }

    const categories = summary.categories ?? {};
    Object.entries(notificationsState.filterCounts || {}).forEach(([filterKey, element]) => {
        if (!element) {
            return;
        }

        let value;
        if (filterKey === 'all') {
            value = summary.total ?? 0;
        } else {
            const categoryKeys = filterCategoryMap[filterKey] ?? [filterKey];
            value = sumCategoryTotals(categories, Array.isArray(categoryKeys) ? categoryKeys : [categoryKeys]);
        }

        element.textContent = value;
        if (filterKey !== 'all') {
            element.classList.toggle('d-none', value === 0);
        } else {
            element.classList.remove('d-none');
        }
    });

    if (notificationsState.unreadToggle) {
        const labelEl = notificationsState.unreadToggle.querySelector('.filter-toggle-label');
        if (labelEl) {
            const unreadCount = Number(summary.unread ?? 0);
            labelEl.textContent = unreadCount > 0 ? `Unread Only (${unreadCount})` : 'Unread Only';
        }
    }
}

async function loadNotificationSummary() {
    if (!ensureNotificationState()) {
        return null;
    }

    try {
        const response = await fetch('/api/v1/notifications/summary', {
            headers: { 'Accept': 'application/json' },
            credentials: 'same-origin',
        });

        if (!response.ok) {
            throw new Error(`Failed to load notification summary (${response.status})`);
        }

        const summary = await response.json();
        notificationsState.summary = summary;
        updateCountsFromSummary(summary);

        // Ensure unread toggle reflects current state (aria + active class)
        try {
            setUnreadOnlyState(Boolean(notificationsState.showUnreadOnly));
        } catch (e) {
            // defensive: setUnreadOnlyState may not be defined in some contexts
        }
        return summary;
    } catch (error) {
        console.error('Error loading notification summary:', error);
        return null;
    }
}

function updateEmptyState(visibleCount) {
    if (!notificationsState.container) {
        return;
    }

    const placeholder = notificationsState.container.querySelector('.notification-empty-indicator');

    if (visibleCount === 0) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = buildEmptyStateMarkup().trim();
        const nextPlaceholder = wrapper.firstElementChild || wrapper;

        if (placeholder) {
            placeholder.replaceWith(nextPlaceholder);
        } else {
            notificationsState.container.appendChild(nextPlaceholder);
        }
    } else if (placeholder) {
        placeholder.remove();
    }
}

function applyNotificationFilter() {
    if (!ensureNotificationState()) {
        return;
    }

    const filter = notificationsState.activeFilter || 'all';
    const items = notificationsState.container.querySelectorAll('.notification-item');
    if (items.length === 0) {
        updateEmptyState(0);
        return;
    }

    const allowed = filterCategoryMap[filter] ?? (filter === 'all' ? [] : [filter]);
    let visibleCount = 0;

    items.forEach((item) => {
        const category = (item.getAttribute('data-category') || 'general').toLowerCase();
        const match = filter === 'all' || allowed.some((value) => {
            const lookup = value.toLowerCase();
            return category === lookup || category.startsWith(`${lookup}.`);
        });
        const passesUnread = !notificationsState.showUnreadOnly || item.getAttribute('data-unread') === '1';
        const visible = match && passesUnread;
        item.style.display = visible ? '' : 'none';
        if (visible) {
            visibleCount += 1;
        }
    });

    updateEmptyState(visibleCount);
}

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function buildEmptyStateMarkup() {
    const filterKey = notificationsState.activeFilter || 'all';
    const filterLabel = getFilterLabel(filterKey);
    const searchTerm = (notificationsState.searchTerm || '').trim();
    const hasSearch = searchTerm !== '';
    const isFiltered = filterKey !== 'all';
    const hasUnreadFilter = Boolean(notificationsState.showUnreadOnly);

    const descriptors = [];
    if (hasUnreadFilter) {
        descriptors.push('unread');
    }
    if (isFiltered) {
        descriptors.push(filterLabel.toLowerCase());
    }

    const descriptorText = descriptors.length > 0 ? `${descriptors.join(' ')} ` : '';

    let title;
    let subtitle;

    if (hasSearch) {
        title = `No ${descriptorText}notifications match '${searchTerm}'`;
        if (hasUnreadFilter) {
            subtitle = 'Everything matching your search is already read. Clear filters to review earlier activity.';
        } else {
            subtitle = 'Check your spelling or try a different keyword.';
        }
    } else if (descriptors.length > 0) {
        title = `No ${descriptorText}notifications yet`;
        subtitle = hasUnreadFilter
            ? 'You are all caught up. Switch off the unread filter to review earlier notifications.'
            : 'When something happens here we will notify you right away.';
    } else {
        title = 'No notifications yet';
        subtitle = 'You will be notified when new activity arrives.';
    }

    const actions = [];

    if (hasSearch) {
        actions.push('<button type="button" class="btn btn-sm btn-outline-secondary" onclick="clearNotificationSearch()"><i class="fas fa-times-circle mr-1"></i>Clear Search</button>');
    }

    if (isFiltered) {
        actions.push('<button type="button" class="btn btn-sm btn-outline-primary" onclick="resetNotificationFilter()"><i class="fas fa-list mr-1"></i>View All</button>');
    }

    if (hasUnreadFilter) {
        actions.push('<button type="button" class="btn btn-sm btn-outline-primary" onclick="toggleUnreadOnly(false)"><i class="fas fa-eye mr-1"></i>Show Read & Unread</button>');
    }

    const actionsMarkup = actions.length ? `<div class="mt-4 flex flex-wrap gap-2 justify-center">${actions.join('')}</div>` : '';

    return `
        <div class="notification-empty-indicator bg-gray-50 rounded-lg p-12 text-center">
            <i class="fas fa-inbox text-4xl text-gray-300 mb-4"></i>
            <p class="text-gray-800 font-semibold mb-1">${escapeHtml(title)}</p>
            <p class="text-gray-600">${escapeHtml(subtitle)}</p>
            ${actionsMarkup}
        </div>
    `;
}

function formatRelativeTime(timestamp) {
    if (!timestamp) {
        return '';
    }

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const diffInSeconds = Math.round((date.getTime() - Date.now()) / 1000);
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    const divisions = [
        { amount: 60, name: 'second' },
        { amount: 60, name: 'minute' },
        { amount: 24, name: 'hour' },
        { amount: 7, name: 'day' },
        { amount: 4.34524, name: 'week' },
        { amount: 12, name: 'month' },
        { amount: Number.POSITIVE_INFINITY, name: 'year' },
    ];

    let duration = diffInSeconds;
    for (const division of divisions) {
        if (Math.abs(duration) < division.amount) {
            return rtf.format(Math.round(duration), division.name);
        }
        duration /= division.amount;
    }

    return '';
}

async function markNotificationsAsRead({ ids = [], scope = null } = {}) {
    const hasIds = Array.isArray(ids) && ids.length > 0;
    if (!hasIds && !scope) {
        return Promise.resolve();
    }

    const payload = scope ? { scope } : { notification_ids: ids };

    try {
        const response = await fetch('/api/v1/notifications/read', {
            method: 'POST',
            headers: {
                'X-CSRF-TOKEN': csrfToken,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Failed to mark notifications as read (${response.status})`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        throw error;
    }
}

async function deleteNotifications({ ids = [], scope = null } = {}) {
    const hasIds = Array.isArray(ids) && ids.length > 0;
    if (!hasIds && !scope) {
        return Promise.resolve();
    }

    const params = new URLSearchParams();
    if (scope) {
        params.append('scope', scope);
    }

    const url = params.toString() ? `/api/v1/notifications?${params.toString()}` : '/api/v1/notifications';

    const options = {
        method: 'DELETE',
        headers: {
            'X-CSRF-TOKEN': csrfToken,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        credentials: 'same-origin',
    };

    if (hasIds && !scope) {
        options.body = JSON.stringify({ notification_ids: ids });
    }

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            throw new Error(`Failed to delete notifications (${response.status})`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error deleting notifications:', error);
        throw error;
    }
}

function toggleLoadMore(visible) {
    if (!notificationsState.loadMoreBtn) {
        return;
    }

    notificationsState.loadMoreBtn.classList.toggle('d-none', !visible);
}

function setLoadMoreLoading(isLoading) {
    if (!notificationsState.loadMoreBtn) {
        return;
    }

    notificationsState.loadMoreBtn.disabled = isLoading;
    if (notificationsState.loadMoreSpinner) {
        notificationsState.loadMoreSpinner.classList.toggle('d-none', !isLoading);
    }
    if (notificationsState.loadMoreLabel) {
        notificationsState.loadMoreLabel.textContent = isLoading ? 'Loading...' : 'Load More';
    }
}

function buildNotificationHtml(notification) {
    const summary = notification.summary || {};
    const unread = Boolean(notification.unread);
    const avatarUrl = notification.data?.avatar_url || 'https://via.placeholder.com/48';
    const title = summary.title || notification.data?.title || 'Notification';
    const body = summary.body || notification.data?.message || '';
    const timestamp = summary.timestamp || notification.created_at || null;
    const link = summary.link || notification.data?.action_url || null;
    const actionLabel = notification.data?.action_label || 'View';
    const relativeTime = formatRelativeTime(timestamp) || '';
    const category = (summary.category || 'general').toString();
    const categoryKey = category.toLowerCase();
    const categoryAttr = categoryKey.replace(/\s+/g, '_');
    const categoryLabel = category.replace(/[_-]/g, ' ');
    const categoryBadgeLabel = categoryLabel.replace(/\b\w/g, (char) => char.toUpperCase());
    const metaBadges = buildMetaBadges(summary.meta || {});
    if (categoryKey !== 'general') {
        metaBadges.unshift(`<span class="notification-meta-badge notification-meta-badge-category">${escapeHtml(categoryBadgeLabel)}</span>`);
    }
    const metaMarkup = metaBadges.length ? `<div class="notification-meta">${metaBadges.join('')}</div>` : '';

    const badgeMarkup = unread ? '<span class="badge bg-indigo-600 mb-2">New</span>' : '';
    const actionButton = link
        ? `<a href="${escapeHtml(link)}" class="btn btn-sm btn-gradient">
                <i class="fas fa-arrow-right mr-1"></i>${escapeHtml(actionLabel)}
           </a>`
        : '';

    return `
        <div class="notification-item bg-white rounded-lg shadow-md p-4 border-l-4 border-indigo-600 ${unread ? '' : 'opacity-75'}"
             data-notification-id="${notification.id}"
             data-category="${escapeHtml(categoryAttr)}"
             data-unread="${unread ? '1' : '0'}">
            <div class="flex gap-4">
                <img src="${escapeHtml(avatarUrl)}"
                     alt="Notification" class="w-12 h-12 rounded-full object-cover flex-shrink-0">
                <div class="flex-1">
                    <div class="flex items-start justify-between gap-2">
                        <div>
                            <h6 class="font-bold text-gray-900">${escapeHtml(title)}</h6>
                            <p class="text-sm text-gray-700 mt-1">${escapeHtml(body)}</p>
                        </div>
                        <div class="text-right flex-shrink-0">
                            ${badgeMarkup}
                            <small class="text-gray-600 block">${relativeTime}</small>
                        </div>
                    </div>

                    <div class="flex gap-2 mt-3">
                        ${actionButton}
                        <button class="btn btn-sm btn-outline-secondary" onclick="dismissNotification(${notification.id})">
                            <i class="fas fa-times mr-1"></i>Dismiss
                        </button>
                    </div>
                    ${metaMarkup}
                </div>
            </div>
        </div>
    `;
}

function renderNotifications(notifications, { append = false } = {}) {
    if (!ensureNotificationState()) {
        return;
    }

    if (!Array.isArray(notifications) || notifications.length === 0) {
        if (!append) {
            notificationsState.container.innerHTML = buildEmptyStateMarkup();
        } else {
            applyNotificationFilter();
        }
        return;
    }

    const markup = notifications
        .map(buildNotificationHtml)
        .join('');

    if (append) {
        notificationsState.container.insertAdjacentHTML('beforeend', markup);
    } else {
        notificationsState.container.innerHTML = markup;
    }

    applyNotificationFilter();
}

function updatePaginationControls(payload) {
    if (!notificationsState.loadMoreBtn) {
        return;
    }

    const current = Number(payload.current_page ?? 1);
    const last = Number(payload.last_page ?? 1);
    notificationsState.page = current;
    notificationsState.lastPage = last;

    const hasMore = current < last;
    toggleLoadMore(hasMore);
    persistNotificationPreferences();
}

async function loadNotifications(page = 1, { append = false } = {}) {
    if (!ensureNotificationState()) {
        return null;
    }

    if (notificationsState.currentAbortController) {
        notificationsState.currentAbortController.abort();
    }

    const controller = new AbortController();
    notificationsState.currentAbortController = controller;
    notificationsState.loading = true;

    const shouldShowStatus = !append;
    if (shouldShowStatus) {
        setNotificationLoading(true);
    } else {
        clearNotificationStatus();
    }
    setLoadMoreLoading(true);

    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('per_page', String(notificationsState.perPage));

    if (notificationsState.categoryFilter) {
        params.set('category', notificationsState.categoryFilter);
    }

    if (notificationsState.searchTerm) {
        params.set('search', notificationsState.searchTerm);
    }

    if (notificationsState.showUnreadOnly) {
        params.set('unread_only', '1');
    }

    try {
        const response = await fetch(`/api/v1/notifications?${params.toString()}`, {
            headers: { 'Accept': 'application/json' },
            credentials: 'same-origin',
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`Failed to load notifications (${response.status})`);
        }

        const payload = await response.json();

        if (controller.signal.aborted) {
            return null;
        }

        notificationsState.lastPayload = payload;

        const data = payload.data || [];
        if (!append && page > 1 && data.length === 0 && Number(payload.total ?? 0) > 0) {
            return await loadNotifications(payload.last_page ?? 1, { append: false });
        }

        renderNotifications(data, { append });
        updatePaginationControls(payload);

        if (!append) {
            await loadNotificationSummary();
        }

        clearNotificationStatus();

        return payload;
    } catch (error) {
        if (error?.name === 'AbortError') {
            return null;
        }

        console.error('Error loading notifications:', error);
        showNotificationStatus('Unable to load notifications. Please try again.', { type: 'error' });
        throw error;
    } finally {
        if (notificationsState.currentAbortController === controller) {
            notificationsState.currentAbortController = null;
            if (shouldShowStatus) {
                setNotificationLoading(false);
            } else {
                notificationsState.loading = false;
            }
            setLoadMoreLoading(false);
        }
    }
}

function loadMoreNotifications() {
    if (notificationsState.loading) {
        return;
    }

    const nextPage = Math.min(notificationsState.page + 1, notificationsState.lastPage);
    if (nextPage <= notificationsState.page) {
        return;
    }

    loadNotifications(nextPage, { append: true }).catch(() => {});
}

function acceptInvite(inviteId, type) {
    const endpoint = type === 'connection' ? '/member/invites/connection' : '/member/invites/group';

    fetch(`${endpoint}/${inviteId}/accept`, {
        method: 'POST',
        headers: {
            'X-CSRF-TOKEN': csrfToken,
            'Content-Type': 'application/json'
        }
    }).then(() => location.reload());
}

function rejectInvite(inviteId, type) {
    const endpoint = type === 'connection' ? '/member/invites/connection' : '/member/invites/group';

    fetch(`${endpoint}/${inviteId}/reject`, {
        method: 'POST',
        headers: {
            'X-CSRF-TOKEN': csrfToken,
            'Content-Type': 'application/json'
        }
    }).then(() => location.reload());
}

function dismissNotification(notificationId) {
    deleteNotifications({ ids: [notificationId] })
        .finally(() => {
            loadNotifications(1).catch(() => {});
        });
}

function markAllAsRead() {
    markNotificationsAsRead({ scope: 'unread' })
        .finally(() => {
            loadNotifications(1).catch(() => {});
        });
}

function clearAll() {
    if (confirm('Are you sure you want to clear all notifications?')) {
        deleteNotifications({ scope: 'all' })
            .finally(() => {
                loadNotifications(1).catch(() => {});
            });
    }
}

function clearNotificationSearch() {
    notificationsState.searchTerm = '';
    notificationsState.page = 1;

    if (notificationsState.searchInput) {
        notificationsState.searchInput.value = '';
        notificationsState.searchInput.focus();
    }

    persistNotificationPreferences({ page: 1 });
    loadNotifications(1).catch(() => {});
}

function resetNotificationFilter() {
    const allButton = document.querySelector('.filter-btn[data-filter="all"]');
    if (allButton) {
        allButton.click();
        return;
    }

    notificationsState.activeFilter = 'all';
    notificationsState.categoryFilter = null;
    notificationsState.page = 1;
    applyNotificationFilter();
    persistNotificationPreferences({ page: 1 });
    loadNotifications(1).catch(() => {});
}

document.addEventListener('DOMContentLoaded', () => {
    const storedPreferences = loadNotificationPreferences();
    if (storedPreferences) {
        if (typeof storedPreferences.filter === 'string' && storedPreferences.filter.trim() !== '') {
            notificationsState.activeFilter = storedPreferences.filter.trim();
            notificationsState.categoryFilter = resolveCategoryFilter(notificationsState.activeFilter);
        }

        if (typeof storedPreferences.searchTerm === 'string') {
            notificationsState.searchTerm = storedPreferences.searchTerm;
        }

        if (typeof storedPreferences.showUnreadOnly !== 'undefined') {
            notificationsState.showUnreadOnly = Boolean(storedPreferences.showUnreadOnly);
        }

        if (typeof storedPreferences.perPage === 'number' && storedPreferences.perPage > 0) {
            notificationsState.perPage = storedPreferences.perPage;
        }

        if (typeof storedPreferences.page === 'number' && storedPreferences.page > 0) {
            notificationsState.page = storedPreferences.page;
        }
    }

    if (ensureNotificationState()) {
        setUnreadOnlyState(notificationsState.showUnreadOnly);
    }

    const filterButtons = Array.from(document.querySelectorAll('.filter-btn'));
    if (filterButtons.length > 0) {
        const desiredFilter = notificationsState.activeFilter || 'all';
        let activeButton = filterButtons.find((btn) => btn.dataset.filter === desiredFilter);
        if (!activeButton) {
            activeButton = filterButtons.find((btn) => btn.dataset.filter === 'all') || filterButtons[0];
            notificationsState.activeFilter = activeButton?.dataset.filter || 'all';
            notificationsState.categoryFilter = resolveCategoryFilter(notificationsState.activeFilter);
        }

        filterButtons.forEach((btn) => btn.classList.toggle('active', btn === activeButton));
    }

    if (notificationsState.loadMoreBtn) {
        notificationsState.loadMoreBtn.addEventListener('click', loadMoreNotifications);
    }

    filterButtons.forEach((btn) => {
        btn.addEventListener('click', function () {
            filterButtons.forEach((b) => b.classList.remove('active'));
            this.classList.add('active');

            const filter = this.dataset.filter || 'all';
            notificationsState.activeFilter = filter;
            notificationsState.categoryFilter = resolveCategoryFilter(filter);
            notificationsState.page = 1;

            applyNotificationFilter();
            persistNotificationPreferences({ page: 1 });
            loadNotifications(1).catch(() => {});
        });
    });

    const searchInput = document.getElementById('notifications-search');
    if (searchInput) {
        notificationsState.searchInput = searchInput;
        if (notificationsState.searchTerm) {
            searchInput.value = notificationsState.searchTerm;
        }

        const debouncedSearch = debounce((value) => {
            notificationsState.searchTerm = value.trim();
            notificationsState.page = 1;
            persistNotificationPreferences({ page: 1 });
            loadNotifications(1).catch(() => {});
        }, 400);

        const handleSearchEvent = (event) => {
            debouncedSearch(event.target.value || '');
        };

        searchInput.addEventListener('input', handleSearchEvent);
        searchInput.addEventListener('search', handleSearchEvent);
    }

    if (notificationsState.unreadToggle) {
        notificationsState.unreadToggle.addEventListener('click', () => {
            toggleUnreadOnly();
        });
    }

    applyNotificationFilter();

    if (ensureNotificationState()) {
        loadNotifications(notificationsState.page || 1).catch(() => loadNotificationSummary());
    }
});
</script>
@endpush
@endsection

