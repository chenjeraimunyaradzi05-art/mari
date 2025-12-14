<div class="space-y-6" wire:init="load">
    <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
            <h1 class="text-2xl font-semibold">Ad Review Console</h1>
            <p class="text-sm text-slate-500">Sponsored creatives, commerce bindings, and AI risk scores.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>AI Observer • polls/live streams</span>
            <span>Commerce Thread Bindings</span>
            <button class="btn btn-primary btn-sm" wire:click="exportSponsored" wire:loading.attr="disabled">
                <i class="fas fa-download mr-1"></i> Export Sponsored
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
            <p class="text-xs uppercase text-slate-500">Pending Creatives</p>
            <p class="text-3xl font-semibold">{{ $metrics['pending_creatives'] ?? '—' }}</p>
        </x-panel>
        <x-panel>
            <p class="text-xs uppercase text-slate-500">Flagged Risk</p>
            <p class="text-3xl font-semibold text-rose-600">{{ $metrics['flagged_risk'] ?? '—' }}</p>
        </x-panel>
        <x-panel>
            <p class="text-xs uppercase text-slate-500">QA Hold Collections</p>
            <p class="text-3xl font-semibold text-amber-500">{{ $metrics['qa_hold_collections'] ?? '—' }}</p>
        </x-panel>
        <x-panel>
            <p class="text-xs uppercase text-slate-500">Live Campaigns</p>
            <p class="text-3xl font-semibold text-emerald-600">{{ $metrics['live_campaigns'] ?? '—' }}</p>
        </x-panel>
    </section>

    <section class="grid gap-6 md:grid-cols-2">
        <x-panel>
            <h2 class="font-semibold">Review Queue</h2>
            <table class="mt-3 w-full text-sm">
                <thead>
                    <tr class="text-left text-xs uppercase text-slate-500">
                        <th>Type</th>
                        <th>Reference</th>
                        <th>Status</th>
                        <th>Submitted</th>
                        <th class="text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse($reviewQueue ?? [] as $item)
                        <tr class="border-t">
                            <td class="py-2">{{ $item['type'] }}</td>
                            <td>{{ $item['reference'] }}</td>
                            <td>{{ ucfirst($item['status']) }}</td>
                            <td>{{ $item['submitted_at'] }}</td>
                            <td class="space-x-2 text-right text-xs">
                                @if(($item['entity'] ?? null) === 'post')
                                    <button class="text-emerald-600" wire:click="approveCreative({{ $item['id'] }})" wire:loading.attr="disabled">Approve</button>
                                    <button class="text-rose-600" wire:click="rejectCreative({{ $item['id'] }})" wire:loading.attr="disabled">Reject</button>
                                    <button class="text-primary" wire:click="openPost({{ $item['id'] }})">Open</button>
                                @else
                                    <button class="text-emerald-600" wire:click="publishProduct({{ $item['id'] }})" wire:loading.attr="disabled">Publish</button>
                                    <button class="text-amber-600" wire:click="holdProduct({{ $item['id'] }})" wire:loading.attr="disabled">Hold</button>
                                    <button class="text-primary" wire:click="openProduct({{ $item['id'] }})">Open</button>
                                @endif
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="5" class="py-4 text-center text-slate-400">Queue is clear.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </x-panel>
        <x-panel>
            <h2 class="font-semibold">AI Risk Breakdown</h2>
            <ul class="mt-4 space-y-2 text-sm">
                @foreach($riskBreakdown ?? [] as $risk => $count)
                    <li class="flex items-center justify-between">
                        <span class="uppercase text-slate-500">{{ $risk }}</span>
                        <span class="font-semibold">{{ $count }}</span>
                    </li>
                @endforeach
            </ul>
        </x-panel>
    </section>

    <section class="grid gap-6 md:grid-cols-2">
        <x-panel>
            <h2 class="font-semibold">Sponsored Inventory</h2>
            <ul class="mt-3 space-y-3 text-sm">
                @forelse($sponsoredInventory ?? [] as $post)
                    <li class="rounded border border-slate-200 p-3">
                        <div class="flex items-center justify-between text-xs uppercase text-slate-500">
                            <span>{{ $post['post_type'] }} • Post #{{ $post['post_id'] }}</span>
                            <span>{{ strtoupper($post['status']) }}</span>
                        </div>
                        <p class="text-slate-600">{{ implode(', ', $post['tags']) ?: 'No AI tags' }}</p>
                        <p class="text-xs text-slate-400">Risk: {{ strtoupper($post['risk'] ?? 'unknown') }} • {{ $post['published_at'] }}</p>
                        <div class="mt-2 space-x-2 text-xs">
                            <button class="text-emerald-600" wire:click="approveCreative({{ $post['post_id'] }})" wire:loading.attr="disabled">Approve</button>
                            <button class="text-rose-600" wire:click="rejectCreative({{ $post['post_id'] }})" wire:loading.attr="disabled">Reject</button>
                            <button class="text-primary" wire:click="openPost({{ $post['post_id'] }})">Open</button>
                        </div>
                    </li>
                @empty
                    <li class="text-slate-400">No sponsored posts loaded.</li>
                @endforelse
            </ul>
        </x-panel>
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
    </section>
</div>
