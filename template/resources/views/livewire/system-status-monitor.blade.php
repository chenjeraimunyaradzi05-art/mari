<div wire:poll.2s class="p-6 bg-white rounded-lg shadow-md border border-gray-200">
    <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-800">
            <i class="fas fa-server mr-2 text-indigo-500"></i> System Monitor
        </h3>
        <span class="px-2 py-1 text-xs font-bold text-green-800 bg-green-100 rounded-full animate-pulse">
            Live
        </span>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="p-4 bg-gray-50 rounded-lg">
            <p class="text-sm text-gray-500">Server Time</p>
            <p class="text-xl font-mono font-bold text-gray-900">{{ $serverTime }}</p>
        </div>
        <div class="p-4 bg-gray-50 rounded-lg">
            <p class="text-sm text-gray-500">Memory Usage</p>
            <p class="text-xl font-mono font-bold text-indigo-600">{{ $memoryUsage }}</p>
        </div>
        <div class="p-4 bg-gray-50 rounded-lg">
            <p class="text-sm text-gray-500">Active Load</p>
            <div class="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                <div class="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style="width: {{ $randomMetric }}%"></div>
            </div>
            <p class="text-xs text-right mt-1 text-gray-500">{{ $randomMetric }}%</p>
        </div>
    </div>

    <div class="flex items-center justify-between pt-4 border-t border-gray-100">
        <div class="text-sm text-gray-500">
            Updates automatically every 2 seconds.
            <span class="ml-2">Refreshed: <strong>{{ $refreshCount }}</strong> times manually.</span>
        </div>
        <button wire:click="refresh" wire:loading.attr="disabled" class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors">
            <span wire:loading.remove>Refresh Now</span>
            <span wire:loading><i class="fas fa-spinner fa-spin"></i> Updating...</span>
        </button>
    </div>
</div>
