<div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
            <h1 class="text-3xl font-bold text-gray-900">Rental Listings</h1>
            <p class="mt-1 text-gray-600">Find your perfect rental property</p>
        </div>
    </div>

    <!-- Filters -->
    <div class="rounded-lg border border-gray-200 bg-white p-6">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div>
                <label class="block text-sm font-medium text-gray-700">Search</label>
                <input
                    type="text"
                    wire:model.live="search"
                    placeholder="Search listings..."
                    class="mt-1 w-full rounded-lg border-gray-300 px-3 py-2 border"
                />
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700">Bedrooms</label>
                <select wire:model.live="bedrooms" class="mt-1 w-full rounded-lg border-gray-300 px-3 py-2 border">
                    <option value="">Any</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4+</option>
                </select>
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700">Bathrooms</label>
                <select wire:model.live="bathrooms" class="mt-1 w-full rounded-lg border-gray-300 px-3 py-2 border">
                    <option value="">Any</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3+</option>
                </select>
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700">Property Type</label>
                <select wire:model.live="type" class="mt-1 w-full rounded-lg border-gray-300 px-3 py-2 border">
                    <option value="">Any</option>
                    <option value="apartment">Apartment</option>
                    <option value="house">House</option>
                    <option value="townhouse">Townhouse</option>
                    <option value="condo">Condo</option>
                </select>
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700">Price</label>
                <select wire:model.live="priceSort" class="mt-1 w-full rounded-lg border-gray-300 px-3 py-2 border">
                    <option value="asc">Low to High</option>
                    <option value="desc">High to Low</option>
                </select>
            </div>
        </div>

        <div class="mt-4 flex gap-2">
            <button
                wire:click="clearFilters"
                class="inline-flex items-center rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
                Clear Filters
            </button>
        </div>
    </div>

    <!-- Listings Grid -->
    @if($isLoading)
        <div class="flex items-center justify-center py-12">
            <div class="text-center">
                <div class="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"></div>
                <p class="mt-4 text-gray-600">Loading listings...</p>
            </div>
        </div>
    @elseif(count($listings) > 0)
        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            @foreach($listings as $listing)
                <div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow hover:shadow-lg transition-shadow">
                    <!-- Image -->
                    @if($listing['images'] && count($listing['images']) > 0)
                        <img
                            src="{{ $listing['images'][0]['url'] ?? 'https://via.placeholder.com/400x300' }}"
                            alt="{{ $listing['title'] }}"
                            class="h-48 w-full object-cover"
                        />
                    @else
                        <div class="h-48 w-full bg-gray-200"></div>
                    @endif

                    <div class="p-4">
                        <!-- Title -->
                        <h3 class="text-lg font-semibold text-gray-900">{{ $listing['title'] ?? 'Untitled' }}</h3>

                        <!-- Price -->
                        <p class="mt-2 text-2xl font-bold text-indigo-600">
                            ${{ number_format($listing['monthly_rent'] ?? 0) }}/mo
                        </p>

                        <!-- Details -->
                        <div class="mt-4 flex items-center gap-4 text-sm text-gray-600">
                            <span>🛏️ {{ $listing['bedrooms'] ?? 0 }} beds</span>
                            <span>🚿 {{ $listing['bathrooms'] ?? 0 }} baths</span>
                        </div>

                        <!-- Description -->
                        <p class="mt-3 line-clamp-2 text-sm text-gray-600">
                            {{ $listing['description'] ?? 'No description available' }}
                        </p>

                        <!-- Location -->
                        <p class="mt-2 text-xs text-gray-500">
                            📍 {{ $listing['location'] ?? 'Location not specified' }}
                        </p>

                        <!-- Actions -->
                        <div class="mt-4 flex gap-2">
                            <a
                                href="{{ route('women.real-estate.rental-details', ['id' => $listing['id']]) }}"
                                class="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-indigo-700"
                            >
                                View Details
                            </a>
                            <button
                                wire:click="$dispatch('showInquiryForm', { rentalId: {{ $listing['id'] }} })"
                                class="flex-1 rounded-lg border border-indigo-600 px-4 py-2 text-center text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                            >
                                Inquire
                            </button>
                        </div>
                    </div>
                </div>
            @endforeach
        </div>
    @else
        <div class="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <p class="text-gray-600">No rental listings found. Try adjusting your filters.</p>
        </div>
    @endif
</div>
