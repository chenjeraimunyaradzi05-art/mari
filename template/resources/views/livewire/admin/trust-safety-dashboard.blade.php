<div class="space-y-6" wire:init="load">
    <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
            <h1 class="text-2xl font-semibold">Trust &amp; Safety Control Room</h1>
            <p class="text-sm text-slate-500">AI moderation, community reports, and block lists wired into the prioritized queues.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
            <x-badge primary>Queue: {{ config('social.streams.metrics_queue') }}</x-badge>
            <x-badge warning>Live Flags: {{ number_format($liveFlags ?? 0) }}</x-badge>
            <button class="btn btn-primary btn-sm" wire:click="exportFlagged" wire:loading.attr="disabled">
                <i class="fas fa-download mr-1"></i> Export Flags
            </button>
        </div>
    </div>

    @if($flashMessage)
        <div class="rounded border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
            {{ $flashMessage }}
        </div>
    @endif

    <div class="grid gap-4 md:grid-cols-4">
        <x-panel>
            <h2 class="font-medium">AI Moderation</h2>
            <p class="text-sm text-slate-500">Polls &amp; streams auto-feed AIContentService and surface flagged terms.</p>
            <ul class="mt-3 space-y-1 text-sm">
                <li>Open polls: {{ $openPolls ?? '—' }}</li>
                <li>Flagged streams: {{ $flaggedStreams ?? '—' }}</li>
                <li>Escalations due: {{ $escalationsDue ?? '—' }}</li>
            </ul>
        </x-panel>
        <x-panel>
            <h2 class="font-medium">Community Reports</h2>
            <p class="text-sm text-slate-500">Blends `social_post_reports` with new block list entries.</p>
            <ul class="mt-3 space-y-1 text-sm">
                <li>Reports today: {{ $reportsToday ?? '—' }}</li>
                <li>Block list entries: {{ $blockEntries ?? '—' }}</li>
                <li>Expired suppressions: {{ $expiredBlocks ?? '—' }}</li>
            </ul>
        </x-panel>
        <x-panel>
            <h2 class="font-medium">Queue Health</h2>
            <p class="text-sm text-slate-500">Watch `queue:work-prioritized` for social-feed, analytics, revenue.</p>
            <ul class="mt-3 space-y-1 text-sm">
                <li>social-feed backlog: {{ $queues['social-feed'] ?? '—' }}</li>
                <li>analytics backlog: {{ $queues['analytics'] ?? '—' }}</li>
                <li>revenue backlog: {{ $queues['revenue'] ?? '—' }}</li>
            </ul>
        </x-panel>
        <x-panel id="jobs-location-signal">
            <h2 class="font-medium">Listing Hygiene</h2>
            <p class="text-sm text-slate-500">Jobs lacking country/state/city are mirrored into analytics for ops review.</p>
            <ul class="mt-3 space-y-1 text-sm">
                <li>Missing today: {{ $jobsMissingLocationToday ?? '—' }}</li>
                <li>All-time records: {{ $jobsMissingLocationAllTime ?? '—' }}</li>
                <li>
                    <a class="text-primary underline" href="#jobs-location-signal">Review latest gaps</a>
                </li>
            </ul>
        </x-panel>
    </div>

    <div class="grid gap-6 md:grid-cols-2">
        <x-panel>
            <h3 class="font-semibold">Flagged Assets</h3>
            <table class="mt-3 w-full text-sm">
                <thead>
                    <tr class="text-left text-xs uppercase text-slate-500">
                        <th>Post</th>
                        <th>Reason</th>
                        <th>AI Flags</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse($flaggedPosts ?? [] as $row)
                        <tr class="border-t">
                            <td class="py-2">{{ $row['post_id'] }}</td>
                            <td>{{ $row['reason'] }}</td>
                            <td>{{ implode(', ', $row['flags'] ?? []) }}</td>
                            <td class="space-x-2">
                                <button class="text-emerald-600" wire:click="approvePost({{ $row['post_id'] }})" wire:loading.attr="disabled">Approve</button>
                                <button class="text-rose-600" wire:click="rejectPost({{ $row['post_id'] }})" wire:loading.attr="disabled">Reject</button>
                                <button class="text-primary" wire:click="review({{ $row['post_id'] }})">Open</button>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="4" class="py-4 text-center text-slate-400">All clear.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </x-panel>
        <x-panel>
            <h3 class="font-semibold">Block List Activity</h3>
            <div class="mt-3 space-y-2 text-sm">
                @forelse($blockActivity ?? [] as $entry)
                    <div class="flex items-center justify-between border-b pb-2">
                        <div>
                            <p class="font-medium">{{ $entry['list'] }}</p>
                            <p class="text-xs text-slate-500">{{ $entry['added_by'] }} • {{ $entry['reason'] }}</p>
                        </div>
                        <span class="text-xs text-slate-400">{{ $entry['timestamp'] }}</span>
                    </div>
                @empty
                    <p class="text-slate-400">No new entries in the last 24h.</p>
                @endforelse
            </div>
        </x-panel>
    </div>
</div>
