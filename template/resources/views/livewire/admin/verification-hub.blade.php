<div class="space-y-5" wire:init="load">
    <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
            <h1 class="text-2xl font-semibold">Verification Hub</h1>
            <p class="text-sm text-slate-500">Unifies profile + organization verification queues.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Reviewer roles: {{ implode(', ', config('social.verification.reviewer_roles', [])) }}</span>
            <span>Notifications: {{ implode(', ', config('social.verification.notification_roles', [])) }}</span>
            <button class="btn btn-primary btn-sm" wire:click="exportQueue" wire:loading.attr="disabled">
                <i class="fas fa-download mr-1"></i> Export Pending
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
            <p class="text-xs uppercase text-slate-500">Pending</p>
            <p class="text-2xl font-semibold">{{ $metrics['pending'] ?? '—' }}</p>
        </x-panel>
        <x-panel>
            <p class="text-xs uppercase text-slate-500">Escalated</p>
            <p class="text-2xl font-semibold text-amber-600">{{ $metrics['escalated'] ?? '—' }}</p>
        </x-panel>
        <x-panel>
            <p class="text-xs uppercase text-slate-500">Approved (24h)</p>
            <p class="text-2xl font-semibold text-emerald-600">{{ $metrics['approved_24h'] ?? '—' }}</p>
        </x-panel>
        <x-panel>
            <p class="text-xs uppercase text-slate-500">AI Fallbacks</p>
            <p class="text-2xl font-semibold text-rose-600">{{ $metrics['ai_fallbacks'] ?? '—' }}</p>
        </x-panel>
    </section>

    <section class="grid gap-6 md:grid-cols-2">
        <x-panel>
            <h2 class="font-semibold">Open Reviews</h2>
            <table class="mt-3 w-full text-sm">
                <thead>
                    <tr class="text-left text-xs uppercase text-slate-500">
                        <th>Profile</th>
                        <th>Status</th>
                        <th>Submitted</th>
                        <th>Reviewer</th>
                        <th class="text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse($openReviews ?? [] as $item)
                        <tr class="border-t">
                            <td class="py-2">{{ $item['profile'] }}</td>
                            <td>{{ ucfirst($item['status']) }}</td>
                            <td>{{ $item['submitted_at'] }}</td>
                            <td>{{ $item['reviewer'] ?? 'Unassigned' }}</td>
                            <td class="space-x-2 text-right text-xs">
                                <button class="text-emerald-600" wire:click="approveVerification({{ $item['id'] }})" wire:loading.attr="disabled">Approve</button>
                                <button class="text-amber-600" wire:click="requestMoreInfo({{ $item['id'] }})" wire:loading.attr="disabled">More Info</button>
                                <button class="text-rose-600" wire:click="rejectVerification({{ $item['id'] }})" wire:loading.attr="disabled">Reject</button>
                                <button class="text-primary" wire:click="review({{ $item['id'] }})">Open</button>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="5" class="py-4 text-center text-slate-400">Nothing pending 🎉</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </x-panel>
        <x-panel>
            <h2 class="font-semibold">Automation Alerts</h2>
            <ul class="mt-3 space-y-2 text-sm">
                @forelse($automationAlerts ?? [] as $alert)
                    <li class="rounded border border-slate-200 p-3">
                        <p class="font-medium">{{ $alert['title'] }}</p>
                        <p class="text-xs text-slate-500">{{ $alert['details'] }}</p>
                    </li>
                @empty
                    <li class="text-slate-400">No alerts.</li>
                @endforelse
            </ul>
        </x-panel>
    </section>
</div>
