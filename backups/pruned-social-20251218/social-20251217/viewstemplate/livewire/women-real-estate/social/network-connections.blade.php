<div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
            <h1 class="text-3xl font-bold text-gray-900">Women's Real Estate Network</h1>
            <p class="mt-1 text-gray-600">Connect with landlords, investors, and fellow househunters</p>
        </div>
    </div>

    <!-- Network Stats -->
    @if(count($stats) > 0)
        <div class="grid gap-4 md:grid-cols-4">
            <div class="rounded-lg border border-gray-200 bg-white p-4">
                <p class="text-sm text-gray-600">Total Connections</p>
                <p class="mt-2 text-3xl font-bold text-gray-900">{{ $stats['total_connections'] ?? 0 }}</p>
            </div>
            <div class="rounded-lg border border-gray-200 bg-white p-4">
                <p class="text-sm text-gray-600">Pending Requests</p>
                <p class="mt-2 text-3xl font-bold text-indigo-600">{{ $stats['pending_requests'] ?? 0 }}</p>
            </div>
            <div class="rounded-lg border border-gray-200 bg-white p-4">
                <p class="text-sm text-gray-600">This Month</p>
                <p class="mt-2 text-3xl font-bold text-gray-900">{{ $stats['new_this_month'] ?? 0 }}</p>
            </div>
            <div class="rounded-lg border border-gray-200 bg-white p-4">
                <p class="text-sm text-gray-600">Network Growth</p>
                <p class="mt-2 text-3xl font-bold text-green-600">+{{ $stats['growth_rate'] ?? 0 }}%</p>
            </div>
        </div>
    @endif

    <!-- Tabs -->
    <div class="border-b border-gray-200">
        <div class="flex gap-8">
            <button
                wire:click="$set('activeTab', 'connections')"
                class="border-b-2 px-1 py-4 text-sm font-medium {{ $activeTab === 'connections' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-700 hover:text-gray-900' }}"
            >
                My Connections ({{ count($connections) }})
            </button>
            <button
                wire:click="$set('activeTab', 'pending')"
                class="border-b-2 px-1 py-4 text-sm font-medium {{ $activeTab === 'pending' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-700 hover:text-gray-900' }}"
            >
                Pending Requests ({{ count($pendingRequests) }})
            </button>
        </div>
    </div>

    <!-- Loading State -->
    @if($isLoading)
        <div class="flex items-center justify-center py-12">
            <div class="text-center">
                <div class="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"></div>
                <p class="mt-4 text-gray-600">Loading connections...</p>
            </div>
        </div>
    @endif

    <!-- Connections Tab -->
    @if($activeTab === 'connections')
        @if(count($connections) > 0)
            <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                @foreach($connections as $connection)
                    <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
                        <!-- Header with Avatar -->
                        <div class="flex items-center gap-4 bg-gradient-to-r from-indigo-50 to-purple-50 p-4">
                            @if($connection['avatar_url'] ?? false)
                                <img
                                    src="{{ $connection['avatar_url'] }}"
                                    alt="{{ $connection['name'] }}"
                                    class="h-12 w-12 rounded-full object-cover"
                                />
                            @else
                                <div class="h-12 w-12 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 font-bold">
                                    {{ substr($connection['name'] ?? 'U', 0, 1) }}
                                </div>
                            @endif
                            <div class="flex-1">
                                <h3 class="font-semibold text-gray-900">{{ $connection['name'] ?? 'Unknown User' }}</h3>
                                <p class="text-xs text-gray-600">{{ $connection['connection_type'] ?? 'Connected' }}</p>
                            </div>
                        </div>

                        <div class="p-4">
                            <!-- Connection Type Badge -->
                            <div class="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                                {{ ucwords(str_replace('_', ' ', $connection['connection_type'] ?? 'Connected')) }}
                            </div>

                            <!-- Status -->
                            <p class="mt-2 text-xs text-gray-600">
                                Connected {{ optional(Carbon\Carbon::parse($connection['connected_at'] ?? now()))->diffForHumans() }}
                            </p>

                            <!-- Bio/Description -->
                            @if($connection['bio'] ?? false)
                                <p class="mt-3 line-clamp-2 text-sm text-gray-600">{{ $connection['bio'] }}</p>
                            @endif

                            <!-- Actions -->
                            <div class="mt-4 flex gap-2">
                                <button
                                    wire:click="blockUser({{ $connection['user_id'] }})"
                                    class="flex-1 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                                >
                                    Block
                                </button>
                                <a
                                    href="{{ route('profile.show', $connection['user_id']) }}"
                                    class="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-indigo-700"
                                >
                                    Profile
                                </a>
                            </div>
                        </div>
                    </div>
                @endforeach
            </div>
        @else
            <div class="rounded-lg border border-gray-200 bg-white p-12 text-center">
                <p class="text-gray-600">No connections yet. Start connecting with other women in real estate!</p>
            </div>
        @endif
    @endif

    <!-- Pending Requests Tab -->
    @if($activeTab === 'pending')
        @if(count($pendingRequests) > 0)
            <div class="space-y-3">
                @foreach($pendingRequests as $request)
                    <div class="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
                        <div class="flex items-center gap-4">
                            @if($request['avatar_url'] ?? false)
                                <img
                                    src="{{ $request['avatar_url'] }}"
                                    alt="{{ $request['name'] }}"
                                    class="h-10 w-10 rounded-full object-cover"
                                />
                            @else
                                <div class="h-10 w-10 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 font-bold">
                                    {{ substr($request['name'] ?? 'U', 0, 1) }}
                                </div>
                            @endif
                            <div>
                                <h3 class="font-semibold text-gray-900">{{ $request['name'] ?? 'Unknown User' }}</h3>
                                <p class="text-xs text-gray-600">Requested {{ now()->parse($request['created_at'] ?? now())->diffForHumans() }}</p>
                            </div>
                        </div>

                        <div class="flex gap-2">
                            <button
                                wire:click="acceptConnection({{ $request['id'] }})"
                                class="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                            >
                                Accept
                            </button>
                            <button
                                wire:click="rejectConnection({{ $request['id'] }})"
                                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Decline
                            </button>
                        </div>
                    </div>
                @endforeach
            </div>
        @else
            <div class="rounded-lg border border-gray-200 bg-white p-12 text-center">
                <p class="text-gray-600">No pending connection requests.</p>
            </div>
        @endif
    @endif
</div>
