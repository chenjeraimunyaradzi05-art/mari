/**
 * Connections Module
 * Handles connection management and networking
 */

const ConnectionsModule = {
    /**
     * Initialize connections page
     */
    init() {
        this.setupEventListeners();
        this.loadInitialData();
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Filter buttons
        document.querySelectorAll('.connection-status-filter').forEach(btn => {
            btn.addEventListener('click', () => this.filterByStatus(btn.dataset.status));
        });

        // Search
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.search(e.target.value));
        }

        // Sort
        const sortSelect = document.getElementById('sortBy');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => this.sort(e.target.value));
        }
    },

    /**
     * Load initial data
     */
    async loadInitialData() {
        await aiFeatures.getSuggestedConnections(5);
    },

    /**
     * Search connections
     */
    async search(query) {
        if (query.length < 2) return;

        try {
            const response = await fetch(`/member/connections/search?q=${encodeURIComponent(query)}`, {
                headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content }
            });
            const results = await response.json();
            this.displayConnections(results);
        } catch (error) {
            console.error('Search error:', error);
        }
    },

    /**
     * Filter by status
     */
    async filterByStatus(status) {
        try {
            const response = await fetch(`/member/connections?status=${status}`, {
                headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content }
            });
            const data = await response.json();
            this.displayConnections(data.connections);
        } catch (error) {
            console.error('Filter error:', error);
        }
    },

    /**
     * Sort connections
     */
    async sort(sortBy) {
        try {
            const response = await fetch(`/member/connections?sort=${sortBy}`, {
                headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content }
            });
            const data = await response.json();
            this.displayConnections(data.connections);
        } catch (error) {
            console.error('Sort error:', error);
        }
    },

    /**
     * Display connections
     */
    displayConnections(connections) {
        const container = document.querySelector('.connection-grid');
        if (!container) return;

        container.innerHTML = connections.map(conn => `
            <div class="connection-card">
                <div class="relative">
                    <img src="${conn.cover_image}" alt="Cover" class="w-full h-32 object-cover">
                    <span class="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold
                        ${conn.status === 'connected' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                        ${conn.status.charAt(0).toUpperCase() + conn.status.slice(1)}
                    </span>
                </div>
                <!-- More details -->
            </div>
        `).join('');
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ConnectionsModule.init());
} else {
    ConnectionsModule.init();
}
