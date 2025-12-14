@extends('layouts.app')

@section('title', 'Transaction Inbox')

@section('content')
<div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div class="p-6 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
                <p class="text-xs uppercase tracking-wide text-gray-500">Bank Feed Inbox</p>
                <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Categorise Transactions</h1>
            </div>
            <div class="flex flex-wrap gap-3">
                <x-forms.select name="bank_account" label="" :options="$accounts" :selected="$activeAccount" />
                <button class="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-md font-semibold">Import Latest</button>
                @auth
                <div x-data="aiHistoryDrawer({ endpoint: '{{ route('api.v1.money.bank-transactions.ai-contexts') }}', conciergeUrl: '{{ route('ai.concierge') }}', surface: 'transactions_inbox' })" class="relative">
                    <button type="button" class="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm dark:border-gray-600 dark:text-white" @click="toggleDrawer">
                        <i class="fas fa-clock-rotate-left"></i>
                        Recent AI contexts
                    </button>
                    <div x-show="open" x-cloak class="fixed inset-0 z-40">
                        <div class="absolute inset-0 bg-gray-900/40" @click="toggleDrawer"></div>
                        <aside class="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl dark:bg-gray-900">
                            <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                                <div>
                                    <p class="text-xs uppercase tracking-wide text-gray-500">AI contexts</p>
                                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Recent history</h3>
                                </div>
                                <button type="button" class="text-gray-500 hover:text-gray-900" @click="toggleDrawer">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                            <div class="flex h-[calc(100%-112px)] flex-col overflow-hidden">
                                <div class="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                                    <template x-if="loading">
                                        <p class="text-sm text-gray-500">Loading recent contexts…</p>
                                    </template>
                                    <template x-if="error">
                                        <p class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700" x-text="error"></p>
                                    </template>
                                    <template x-if="!loading && !error && contexts.length === 0">
                                        <p class="text-sm text-gray-500">No contexts captured yet. Ask Athena about a selection and they will appear here.</p>
                                    </template>
                                    <template x-for="context in contexts" :key="context.token">
                                        <article class="rounded-2xl border border-gray-200 p-4 text-sm dark:border-gray-800">
                                            <p class="text-xs uppercase tracking-wide text-gray-500">Generated <span x-text="formatTimestamp(context.created_at)"></span></p>
                                            <p class="mt-1 font-semibold text-gray-900 dark:text-white" x-text="`Selection of ${context.selection_total} transactions`"></p>
                                            <p class="mt-1 text-xs text-gray-500" x-text="filtersSummary(context.filters)"></p>
                                            <ul class="mt-3 space-y-1" x-show="context.selection_preview && context.selection_preview.length">
                                                <template x-for="preview in context.selection_preview" :key="preview.id">
                                                    <li class="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                                        <p class="font-semibold text-gray-800 dark:text-white" x-text="preview.description"></p>
                                                        <p class="text-[11px] text-gray-500" x-text="preview.account ?? ''"></p>
                                                    </li>
                                                </template>
                                            </ul>
                                            <div class="mt-3 flex flex-wrap gap-2">
                                                <button type="button" class="inline-flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200" @click="resume(context)">
                                                    <i class="fas fa-arrow-up-right-from-square"></i>
                                                    Re-open with Athena
                                                </button>
                                                <button type="button" class="text-xs text-gray-500 hover:text-gray-800" @click="copyPayload(context)">
                                                    <i class="fas fa-copy"></i>
                                                    Copy payload
                                                </button>
                                            </div>
                                        </article>
                                    </template>
                                </div>
                                <div class="border-t border-gray-200 px-4 py-3 dark:border-gray-800">
                                    <button type="button" class="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-100" @click="fetchContexts(false)">
                                        <i class="fas fa-rotate"></i>
                                        Refresh list
                                    </button>
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
                @endauth
            </div>
        </div>

        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-900/40">
                    <tr>
                        <x-table.th label="Date" />
                        <x-table.th label="Reference" />
                        <x-table.th label="Suggested Category" />
                        <x-table.th label="Amount" align="right" />
                        <x-table.th label="Status" />
                        <x-table.th label="Actions" />
                    </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    @foreach($pendingTransactions as $txn)
                        <tr>
                            <x-table.td>{{ $txn['date']->format('M d') }}</x-table.td>
                            <x-table.td>
                                <p class="font-semibold text-gray-900 dark:text-white">{{ $txn['description'] }}</p>
                                <p class="text-xs text-gray-500">{{ $txn['reference'] }}</p>
                            </x-table.td>
                            <x-table.td>
                                <x-forms.select name="category_id" label="" :options="$categories" :selected="$txn['suggested_category']" />
                            </x-table.td>
                            <x-table.td align="right" class="font-semibold {{ $txn['amount'] < 0 ? 'text-red-600' : 'text-emerald-600' }}">{{ money_format($txn['amount']) }}</x-table.td>
                            <x-table.td>
                                <x-badge :color="$txn['status'] === 'matched' ? 'emerald' : 'neutral'">{{ ucfirst($txn['status']) }}</x-badge>
                            </x-table.td>
                            <x-table.td>
                                <div class="flex gap-2 text-sm">
                                    <button class="text-emerald-600">Accept</button>
                                    <button class="text-gray-500">Split</button>
                                    <button class="text-gray-500">Exclude</button>
                                </div>
                            </x-table.td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </div>
</div>
@endsection

@push('scripts')
<script>
    document.addEventListener('alpine:init', () => {
        Alpine.data('aiHistoryDrawer', ({ endpoint, conciergeUrl, surface = 'bank_inbox' }) => ({
            endpoint,
            conciergeUrl,
            surface,
            open: false,
            loading: false,
            error: '',
            contexts: [],
            trackedOpen: false,
            toggleDrawer() {
                this.open = !this.open;

                if (!this.open) {
                    return;
                }

                const shouldTrack = !this.trackedOpen;

                if (shouldTrack) {
                    this.trackedOpen = true;
                }

                if (this.contexts.length === 0 || shouldTrack) {
                    this.fetchContexts(shouldTrack);
                }
            },
            async fetchContexts(trackOpen = false) {
                this.loading = true;
                this.error = '';

                try {
                    const url = new URL(this.endpoint, window.location.origin);

                    if (trackOpen) {
                        url.searchParams.set('track_open', '1');
                    }

                    if (this.surface) {
                        url.searchParams.set('surface', this.surface);
                    }

                    const response = await fetch(url, {
                        headers: {
                            'Accept': 'application/json',
                        },
                        credentials: 'same-origin',
                    });

                    if (!response.ok) {
                        throw new Error('Unable to load history right now.');
                    }

                    const payload = await response.json();
                    this.contexts = payload.data ?? [];
                } catch (error) {
                    this.error = error.message || 'Unable to load history right now.';
                } finally {
                    this.loading = false;
                }
            },
            resume(context) {
                const url = new URL(this.conciergeUrl, window.location.origin);
                url.searchParams.set('context', 'bank-feed-triage');

                if (context.context_payload) {
                    url.searchParams.set('context_payload', context.context_payload);
                }

                if (context.prompt) {
                    url.searchParams.set('prompt', context.prompt);
                }

                window.location.href = url.toString();
            },
            copyPayload(context) {
                if (!navigator.clipboard || !context.context_payload) {
                    return;
                }

                navigator.clipboard.writeText(context.context_payload).catch(() => {
                    this.error = 'Unable to copy payload on this device.';
                });
            },
            formatTimestamp(value) {
                if (!value) {
                    return 'Earlier today';
                }

                const parsed = new Date(value);

                if (Number.isNaN(parsed.getTime())) {
                    return value;
                }

                return parsed.toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                });
            },
            filtersSummary(filters) {
                if (!filters || Object.keys(filters).length === 0) {
                    return 'No filters captured';
                }

                return Object.entries(filters)
                    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${Array.isArray(value) ? value.join(', ') : value}`)
                    .join(' • ');
            },
        }));
    });
</script>
@endpush
