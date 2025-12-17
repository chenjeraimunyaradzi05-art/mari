<div id="graphContactsPanel" class="rounded-3xl border border-blue-100 bg-white/95 p-6 shadow-md shadow-blue-100/50">
    <div class="flex items-start justify-between gap-3">
        <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-blue-500">Contact graph</p>
            <h4 class="text-xl font-semibold text-slate-900">Warm connections</h4>
            <p class="mt-1 text-sm text-slate-500">Synced address book contacts that are ready for invites.</p>
        </div>
        <div class="text-3xl font-black text-blue-600" id="graph-contact-count">--</div>
    </div>

    <dl class="mt-4 grid grid-cols-2 gap-4">
        <div>
            <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Reachable</dt>
            <dd class="text-2xl font-bold text-indigo-600" id="graph-reachable-count">--</dd>
        </div>
        <div>
            <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">New this week</dt>
            <dd class="text-2xl font-bold text-emerald-600" id="graph-new-count">--</dd>
        </div>
    </dl>

    <ul class="mt-5 space-y-3" data-graph-contacts>
        <li class="text-sm text-slate-500">Fetching your latest contacts...</li>
    </ul>

    <a
        href="{{ route('member.social.connections') }}"
        class="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200/70 transition hover:from-indigo-600 hover:to-blue-600"
    >
        Manage contacts
        <i class="fas fa-arrow-right"></i>
    </a>
</div>

<div class="rounded-3xl border border-indigo-100 bg-white/95 p-6 shadow-md shadow-indigo-100/40">
    <div class="flex items-center justify-between">
        <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">Recommendations</p>
            <h4 class="text-lg font-semibold text-slate-900">Likely to say yes</h4>
        </div>
        <button
            type="button"
            class="rounded-full border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
            data-graph-refresh
        >
            Refresh
        </button>
    </div>

    <ul class="mt-4 space-y-3" data-graph-recommendations>
        <li class="text-sm text-slate-500">Looking for warm introductions...</li>
    </ul>

    <a
        href="{{ route('member.social.connections.discover') }}"
        class="mt-4 inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-700"
    >
        Explore all recommendations
        <i class="fas fa-arrow-up-right ml-2"></i>
    </a>
</div>

@push('scripts')
<script>
(function () {
    const panel = document.getElementById('graphContactsPanel');
    if (!panel) {
        return;
    }

    const contactsList = panel.querySelector('[data-graph-contacts]');
    const recommendationsList = document.querySelector('[data-graph-recommendations]');
    const refreshButton = document.querySelector('[data-graph-refresh]');
    const contactCountEl = document.getElementById('graph-contact-count');
    const reachableCountEl = document.getElementById('graph-reachable-count');
    const newCountEl = document.getElementById('graph-new-count');

    const request = async (url) => {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
        });

        if (!response.ok) {
            throw new Error('Request failed');
        }

        return response.json();
    };

    const fmtDate = (value) => {
        if (!value) {
            return null;
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return null;
        }

        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const renderContactList = (contacts) => {
        if (!Array.isArray(contacts) || contacts.length === 0) {
            contactsList.innerHTML = '<li class="text-sm text-slate-500">Sync contacts to unlock smart invitations.</li>';
            return;
        }

        contactsList.innerHTML = contacts.slice(0, 3).map((contact) => {
            const name = contact.full_name || contact.given_name || contact.family_name || 'Contact';
            const email = contact.email || '';
            const phone = contact.phone || '';
            const channel = email ? email : phone;
            const lastInteraction = fmtDate(contact.last_interacted_at) || 'Recently';

            return `
                <li class="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                    <div>
                        <p class="text-sm font-semibold text-slate-900">${name}</p>
                        <p class="text-xs text-slate-500">${channel || 'Channel pending'} · ${lastInteraction}</p>
                    </div>
                    <span class="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Warm</span>
                </li>
            `;
        }).join('');
    };

    const renderRecommendations = (items) => {
        if (!recommendationsList) {
            return;
        }

        if (!Array.isArray(items) || items.length === 0) {
            recommendationsList.innerHTML = '<li class="text-sm text-slate-500">We will surface new recommendations as soon as we have enough signal.</li>';
            return;
        }

        recommendationsList.innerHTML = items.slice(0, 4).map((item) => {
            const name = item.name || 'Future teammate';
            const channel = item.email || item.phone || 'Invite link';
            const tags = Array.isArray(item.tags) ? item.tags.slice(0, 2) : [];
            const chip = tags.length ? tags.map((tag) => `<span class="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">${tag}</span>`).join(' ') : '<span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Warm intro</span>';

            return `
                <li class="rounded-2xl border border-indigo-50 bg-gradient-to-r from-white to-indigo-50/60 p-3">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <p class="font-semibold text-slate-900">${name}</p>
                            <p class="text-xs text-slate-500">${channel}</p>
                        </div>
                        <button type="button" class="rounded-full border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50" onclick="window.location.href='{{ route('member.social.connections.discover') }}'">Invite</button>
                    </div>
                    <div class="mt-2 flex flex-wrap gap-2">${chip}</div>
                </li>
            `;
        }).join('');
    };

    const populateContacts = async () => {
        try {
            const payload = await request('/api/v1/social/graph/contacts?per_page=6');
            const contacts = payload.data || [];
            const meta = payload.meta || {};
            const total = meta.total ?? contacts.length;

            contactCountEl.textContent = total;
            const reachable = contacts.filter((contact) => contact.email || contact.phone).length;
            reachableCountEl.textContent = reachable;

            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            const newCount = contacts.filter((contact) => {
                if (!contact.last_interacted_at) {
                    return false;
                }
                const ts = Date.parse(contact.last_interacted_at);
                return !Number.isNaN(ts) && ts >= sevenDaysAgo;
            }).length;
            newCountEl.textContent = newCount;

            renderContactList(contacts);
        } catch (error) {
            contactsList.innerHTML = '<li class="text-sm text-rose-500">Unable to load contacts. Please try again later.</li>';
        }
    };

    const populateRecommendations = async () => {
        if (!recommendationsList) {
            return;
        }

        try {
            const payload = await request('/api/v1/social/graph/recommendations?limit=6');
            renderRecommendations(payload.data || []);
        } catch (error) {
            recommendationsList.innerHTML = '<li class="text-sm text-rose-500">Unable to load recommendations right now.</li>';
        }
    };

    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            refreshButton.classList.add('animate-pulse');
            populateRecommendations().finally(() => refreshButton.classList.remove('animate-pulse'));
        });
    }

    populateContacts();
    populateRecommendations();
})();
</script>
@endpush
