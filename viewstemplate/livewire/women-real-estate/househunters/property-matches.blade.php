<div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
            <h1 class="text-3xl font-bold text-gray-900">Your Property Matches</h1>
            <p class="mt-1 text-gray-600">AI-powered recommendations based on your preferences</p>
        </div>
    </div>

    <!-- Loading State -->
    @if($isLoading)
        <div class="flex items-center justify-center py-12">
            <div class="text-center">
                <div class="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"></div>
                <p class="mt-4 text-gray-600">Loading your matches...</p>
            </div>
        </div>
    @elseif(count($matches) > 0)
        <div class="grid gap-6 md:grid-cols-2">
            @foreach($matches as $match)
                <div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow hover:shadow-lg transition-shadow">
                    <!-- Match Score Badge -->
                    <div class="relative">
                        @if($match['images'] && count($match['images']) > 0)
                            <img
                                src="{{ $match['images'][0]['url'] ?? 'https://via.placeholder.com/500x300' }}"
                                alt="{{ $match['title'] }}"
                                class="h-56 w-full object-cover"
                            />
                        @else
                            <div class="h-56 w-full bg-gradient-to-br from-indigo-100 to-purple-100"></div>
                        @endif

                        <!-- Match Score -->
                        <div class="absolute right-4 top-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lg">
                            <div class="text-center">
                                <p class="text-2xl font-bold text-indigo-600">{{ $match['match_score'] ?? 0 }}%</p>
                                <p class="text-xs text-gray-600">Match</p>
                            </div>
                        </div>
                    </div>

                    <div class="p-6">
                        <!-- Title and Price -->
                        <div class="flex items-start justify-between">
                            <div>
                                <h3 class="text-lg font-semibold text-gray-900">{{ $match['title'] ?? 'Untitled' }}</h3>
                                <p class="mt-1 text-sm text-gray-600">📍 {{ $match['location'] ?? 'Location TBD' }}</p>
                            </div>
                            <p class="whitespace-nowrap text-right text-2xl font-bold text-indigo-600">
                                ${{ number_format($match['monthly_rent'] ?? 0) }}<span class="text-sm">/mo</span>
                            </p>
                        </div>

                        <!-- Property Details -->
                        <div class="mt-4 grid grid-cols-3 gap-3">
                            <div class="rounded-lg bg-gray-50 p-3 text-center">
                                <p class="text-xs text-gray-600">Bedrooms</p>
                                <p class="text-lg font-semibold text-gray-900">{{ $match['bedrooms'] ?? '—' }}</p>
                            </div>
                            <div class="rounded-lg bg-gray-50 p-3 text-center">
                                <p class="text-xs text-gray-600">Bathrooms</p>
                                <p class="text-lg font-semibold text-gray-900">{{ $match['bathrooms'] ?? '—' }}</p>
                            </div>
                            <div class="rounded-lg bg-gray-50 p-3 text-center">
                                <p class="text-xs text-gray-600">Type</p>
                                <p class="text-lg font-semibold text-gray-900">{{ ucfirst($match['property_type'] ?? '—') }}</p>
                            </div>
                        </div>

                        <!-- Description -->
                        <p class="mt-4 line-clamp-2 text-sm text-gray-600">
                            {{ $match['description'] ?? 'No description available' }}
                        </p>

                        <!-- Match Reasons -->
                        @if($match['match_reasons'] && count($match['match_reasons']) > 0)
                            <div class="mt-4">
                                <p class="text-xs font-semibold text-gray-700">Why this match:</p>
                                <div class="mt-2 flex flex-wrap gap-1">
                                    @foreach(array_slice($match['match_reasons'], 0, 3) as $reason)
                                        <span class="inline-block rounded-full bg-indigo-100 px-2 py-1 text-xs text-indigo-700">
                                            {{ $reason }}
                                        </span>
                                    @endforeach
                                </div>
                            </div>
                        @endif

                        <!-- Actions -->
                        <div class="mt-6 flex gap-2">
                            <button
                                wire:click="sendInquiry({{ $match['rental_property_id'] }})"
                                class="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-indigo-700"
                            >
                                Send Inquiry
                            </button>
                            <button
                                wire:click="markAsViewed({{ $match['id'] }})"
                                class="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Mark Viewed
                            </button>
                            <button
                                wire:click="rejectMatch({{ $match['id'] }})"
                                class="rounded-lg border border-red-300 px-4 py-2 text-center text-sm font-medium text-red-600 hover:bg-red-50"
                                title="Not interested"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                </div>
            @endforeach
        </div>
    @else
        <div class="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <p class="text-gray-600">No matches found yet. Update your profile preferences to get started!</p>
            <a
                href="{{ route('women.real-estate.househunter-profile') }}"
                class="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
                Set Up Profile
            </a>
        </div>
    @endif
</div>
