<div class="space-y-6" wire:init="load">
    <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
            <h1 class="text-2xl font-semibold">Revenue Ops Center</h1>
            <p class="text-sm text-slate-500">Commerce orders, payouts, and warehouse exports tied to new queues.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Analytics queue • {{ config('queue.connections.redis.queue', 'default') }}</span>
            <button class="btn btn-primary btn-sm" wire:click="exportOrders" wire:loading.attr="disabled">
                <i class="fas fa-download mr-1"></i> Export Orders
            </button>
        </div>
    </header>

    @if($flashMessage)
        <div class="rounded border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
            {{ $flashMessage }}
        </div>
    @endif

    <section class="grid gap-4 md:grid-cols-4">
        <x-panel>
            <p class="text-xs uppercase text-slate-500">Orders (24h)</p>
            <p class="text-3xl font-semibold">{{ $kpis['orders_24h'] ?? '—' }}</p>
        </x-panel>
        <x-panel>
            <p class="text-xs uppercase text-slate-500">GMV (24h)</p>
            <p class="text-3xl font-semibold">${{ number_format($kpis['gmv_24h'] ?? 0, 2) }}</p>
        </x-panel>
        <x-panel>
            <p class="text-xs uppercase text-slate-500">Tips (24h)</p>
            <p class="text-3xl font-semibold text-emerald-600">${{ number_format($kpis['tips_24h'] ?? 0, 2) }}</p>
        </x-panel>
        <x-panel>
            <p class="text-xs uppercase text-slate-500">Active Channels</p>
            <p class="text-3xl font-semibold">{{ $kpis['active_channels'] ?? '—' }}</p>
        </x-panel>
    </section>

    <section class="grid gap-6 md:grid-cols-2">
        <x-panel>
            <h2 class="font-semibold">Recent Payout Batches</h2>
            <ul class="mt-3 space-y-2 text-sm">
                @forelse($payouts ?? [] as $batch)
                    <li class="rounded border border-slate-200 p-3">
                        <div class="flex items-center justify-between">
                            <span class="font-medium">{{ $batch['channel'] }}</span>
                            <span class="text-xs uppercase text-slate-500">{{ strtoupper($batch['status']) }}</span>
                        </div>
                        <p class="text-slate-600">{{ $batch['amount'] }}</p>
                        <p class="text-xs text-slate-400">Payout {{ $batch['payout_date'] }}</p>
                        <div class="mt-2 space-x-2 text-xs">
                            <button class="text-emerald-600" wire:click="markPayoutSent({{ $batch['id'] }})" wire:loading.attr="disabled">Mark Sent</button>
                            <button class="text-amber-600" wire:click="retryPayout({{ $batch['id'] }})" wire:loading.attr="disabled">Retry</button>
                        </div>
                    </li>
                @empty
                    <li class="text-slate-400">No payout batches recorded yet.</li>
                @endforelse
            </ul>
        </x-panel>
        <x-panel>
            <h2 class="font-semibold">Order Timeline (7d)</h2>
            <table class="mt-3 w-full text-sm">
                <thead>
                    <tr class="text-left text-xs uppercase text-slate-500">
                        <th>Day</th>
                        <th>Orders</th>
                        <th>GMV</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse($orderTimeline ?? [] as $row)
                        <tr class="border-t">
                            <td class="py-2">{{ $row['day'] }}</td>
                            <td>{{ $row['orders'] }}</td>
                            <td>${{ number_format($row['total'], 2) }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="3" class="py-4 text-center text-slate-400">No orders captured yet.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </x-panel>
    </section>

    <section class="grid gap-6 md:grid-cols-2">
        <x-panel>
            <h2 class="font-semibold">Automation Health</h2>
            <ul class="mt-3 space-y-2 text-sm">
                @forelse($jobStatus ?? [] as $job)
                    <li class="rounded border border-slate-200 p-3">
                        <div class="flex items-center justify-between">
                            <span class="font-medium">{{ $job['name'] }}</span>
                            <span class="text-xs uppercase text-slate-500">{{ $job['status'] }}</span>
                        </div>
                        <p class="text-xs text-slate-500">{{ $job['details'] }}</p>
                    </li>
                @empty
                    <li class="text-slate-400">No automation telemetry yet.</li>
                @endforelse
            </ul>
        </x-panel>
        <x-panel>
            <h2 class="font-semibold">Top Channels (7d)</h2>
            <table class="mt-3 w-full text-sm">
                <thead>
                    <tr class="text-left text-xs uppercase text-slate-500">
                        <th>Channel</th>
                        <th>Owner</th>
                        <th>GMV</th>
                        <th class="text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse($topChannels ?? [] as $channel)
                        <tr class="border-t">
                            <td class="py-2">{{ $channel['channel'] }}</td>
                            <td>{{ $channel['owner'] }}</td>
                            <td>${{ number_format($channel['week_total'], 2) }}</td>
                            <td class="text-right">
                                <button class="text-primary text-xs" wire:click="openChannel({{ $channel['channel_id'] }})">Open</button>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="4" class="py-4 text-center text-slate-400">No commerce activity yet.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </x-panel>
    </section>
</div>
