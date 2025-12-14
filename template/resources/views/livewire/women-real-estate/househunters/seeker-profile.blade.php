<div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
            <h1 class="text-3xl font-bold text-gray-900">Househunter Profile</h1>
            <p class="mt-1 text-gray-600">Set your preferences to find your perfect home</p>
        </div>
        <button
            wire:click="$toggle('showForm')"
            class="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
            @if($showForm)
                Cancel
            @else
                Edit Profile
            @endif
        </button>
    </div>

    <!-- Status Messages -->
    @if($status === 'success')
        <div class="rounded-lg bg-green-50 p-4 text-sm text-green-700">
            {{ $message }}
        </div>
    @elseif($status === 'error')
        <div class="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {{ $message }}
        </div>
    @endif

    <!-- Form -->
    @if($showForm)
        <div class="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
            <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                <!-- Budget -->
                <div>
                    <label class="block text-sm font-medium text-gray-700">Minimum Budget</label>
                    <input
                        type="number"
                        wire:model="preferences.budget_min"
                        placeholder="e.g., 1000"
                        class="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700">Maximum Budget</label>
                    <input
                        type="number"
                        wire:model="preferences.budget_max"
                        placeholder="e.g., 3000"
                        class="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                </div>

                <!-- Bedrooms -->
                <div>
                    <label class="block text-sm font-medium text-gray-700">Bedrooms</label>
                    <input
                        type="number"
                        wire:model="preferences.bedrooms"
                        placeholder="e.g., 2"
                        class="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                </div>

                <!-- Bathrooms -->
                <div>
                    <label class="block text-sm font-medium text-gray-700">Bathrooms</label>
                    <input
                        type="number"
                        wire:model="preferences.bathrooms"
                        placeholder="e.g., 1"
                        class="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                </div>

                <!-- Move-in Date -->
                <div>
                    <label class="block text-sm font-medium text-gray-700">Move-in Date</label>
                    <input
                        type="date"
                        wire:model="preferences.move_in_date"
                        class="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                </div>
            </div>

            <!-- Property Types -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-3">Property Types</label>
                <div class="space-y-2">
                    @foreach(['apartment' => 'Apartment', 'house' => 'House', 'townhouse' => 'Townhouse', 'condo' => 'Condo'] as $value => $label)
                        <label class="flex items-center">
                            <input
                                type="checkbox"
                                wire:model="preferences.property_types"
                                value="{{ $value }}"
                                class="h-4 w-4 rounded border-gray-300"
                            />
                            <span class="ml-2 text-gray-700">{{ $label }}</span>
                        </label>
                    @endforeach
                </div>
            </div>

            <!-- Locations -->
            <div>
                <label class="block text-sm font-medium text-gray-700">Preferred Locations (comma-separated)</label>
                <input
                    type="text"
                    wire:model="preferences.locations"
                    placeholder="e.g., Downtown, Midtown"
                    class="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2"
                />
            </div>

            <!-- Save Button -->
            <button
                wire:click="updateProfile"
                wire:loading.attr="disabled"
                class="w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
                @if($status === 'saving')
                    Saving...
                @else
                    Save Profile
                @endif
            </button>
        </div>
    @else
        <!-- Profile Summary -->
        <div class="rounded-lg border border-gray-200 bg-white p-6">
            <h2 class="text-lg font-semibold text-gray-900">Your Preferences</h2>

            @if(count($preferences) > 0)
                <div class="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                    @if($preferences['budget_min'] ?? false)
                        <div>
                            <p class="text-sm text-gray-600">Min Budget</p>
                            <p class="text-lg font-semibold text-gray-900">${{ number_format($preferences['budget_min']) }}</p>
                        </div>
                    @endif

                    @if($preferences['budget_max'] ?? false)
                        <div>
                            <p class="text-sm text-gray-600">Max Budget</p>
                            <p class="text-lg font-semibold text-gray-900">${{ number_format($preferences['budget_max']) }}</p>
                        </div>
                    @endif

                    @if($preferences['bedrooms'] ?? false)
                        <div>
                            <p class="text-sm text-gray-600">Bedrooms</p>
                            <p class="text-lg font-semibold text-gray-900">{{ $preferences['bedrooms'] }}</p>
                        </div>
                    @endif

                    @if($preferences['bathrooms'] ?? false)
                        <div>
                            <p class="text-sm text-gray-600">Bathrooms</p>
                            <p class="text-lg font-semibold text-gray-900">{{ $preferences['bathrooms'] }}</p>
                        </div>
                    @endif
                </div>
            @else
                <p class="mt-4 text-gray-600">No preferences set yet. Click "Edit Profile" to get started.</p>
            @endif
        </div>
    @endif
</div>
