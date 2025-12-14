/**
 * Groups Module
 * Handles group management and community features
 */

const memberLabels = window.memberLabels ?? {};
const membersLabel = memberLabels.members ?? 'Members';

const GroupsModule = {
    /**
     * Initialize groups module
     */
    init() {
        this.setupEventListeners();
        this.loadGroups();
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Search
        const searchInput = document.getElementById('groupSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.search(e.target.value));
        }

        // Filter
        const filter = document.getElementById('categoryFilter');
        if (filter) {
            filter.addEventListener('change', (e) => this.filter(e.target.value));
        }

        // Sort
        const sort = document.getElementById('sortBy');
        if (sort) {
            sort.addEventListener('change', (e) => this.sort(e.target.value));
        }
    },

    /**
     * Load groups
     */
    async loadGroups() {
        try {
            const response = await fetch('/member/groups/data', {
                headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content }
            });
            const data = await response.json();
            this.displayGroups(data.groups);
        } catch (error) {
            console.error('Error loading groups:', error);
        }
    },

    /**
     * Search groups
     */
    async search(query) {
        if (query.length < 2) return;

        try {
            const response = await fetch(`/member/groups/search?q=${encodeURIComponent(query)}`, {
                headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content }
            });
            const results = await response.json();
            this.displayGroups(results);
        } catch (error) {
            console.error('Search error:', error);
        }
    },

    /**
     * Filter groups
     */
    async filter(category) {
        try {
            const response = await fetch(`/member/groups?category=${category}`, {
                headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content }
            });
            const data = await response.json();
            this.displayGroups(data.groups);
        } catch (error) {
            console.error('Filter error:', error);
        }
    },

    /**
     * Sort groups
     */
    async sort(sortBy) {
        try {
            const response = await fetch(`/member/groups?sort=${sortBy}`, {
                headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content }
            });
            const data = await response.json();
            this.displayGroups(data.groups);
        } catch (error) {
            console.error('Sort error:', error);
        }
    },

    /**
     * Display groups
     */
    displayGroups(groups) {
        const container = document.querySelector('.group-grid') || document.getElementById('discover-container');
        if (!container) return;

        container.innerHTML = groups.map(group => `
            <div class="group-card bg-white rounded-lg shadow-md overflow-hidden hover-lift">
                <div class="relative h-32 bg-gradient-to-r from-indigo-400 to-purple-400">
                    ${group.cover_image ? `<img src="${group.cover_image}" alt="${group.name}" class="w-full h-full object-cover">` : ''}
                    <span class="absolute top-3 right-3 px-3 py-1 bg-white rounded-full text-xs font-bold text-indigo-600">
                        ${group.members_count} ${membersLabel}
                    </span>
                </div>
                <div class="p-4">
                    <h5 class="font-bold text-lg text-gray-900">${group.name}</h5>
                    <p class="text-sm text-gray-600 mb-3">${group.description}</p>
                    <button onclick="GroupsModule.joinGroup(${group.id})" class="btn btn-sm btn-gradient w-100">
                        <i class="fas fa-plus mr-1"></i>Join Group
                    </button>
                </div>
            </div>
        `).join('');
    },

    /**
     * Join group
     */
    async joinGroup(groupId) {
        try {
            const response = await fetch(`/member/groups/${groupId}/join`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                alert('Successfully joined the group!');
                location.reload();
            }
        } catch (error) {
            console.error('Error joining group:', error);
        }
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => GroupsModule.init());
} else {
    GroupsModule.init();
}
