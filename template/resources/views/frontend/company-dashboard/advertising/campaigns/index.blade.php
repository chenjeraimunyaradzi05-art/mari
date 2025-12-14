@extends('frontend.company-dashboard.dashboard')

@section('company_content')
<div
    class="space-y-6"
    x-data="orgCampaignsTable({
        orgPages: @json($orgPages),
        defaultOrgPageId: @json($defaultOrgPageId),
        routes: {
            segments: '{{ route('company.advertising.segments.index') }}',
            create: '{{ route('company.advertising.campaigns.create') }}',
            view: '{{ url('company/advertising/campaigns') }}'
        }
    })"
    x-init="init()"
>
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
            <h1 class="text-2xl font-semibold text-slate-900">Advertising Campaigns</h1>
            <p class="text-sm text-slate-500">Track, manage, and optimize every organization page from one place.</p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
            <template x-if="hasOrgPages()">
                <div class="flex items-center gap-2">
                    <label for="org-page" class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Org page</label>
                    <select id="org-page" x-model.number="selectedPageId" class="rounded border border-slate-300 text-sm px-3 py-2 focus:border-brand-500 focus:ring-brand-500">
                        <template x-for="page in pages" :key="page.id">
                            <option :value="page.id" x-text="page.name"></option>
                        </template>
                    </select>
                </div>
            </template>
            <a :href="routes.segments" class="text-sm text-brand-600 hover:text-brand-700">
                Manage audience segments
            </a>
            <a :href="routes.create" class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded hover:bg-brand-700">
                <span class="mr-2">&#43;</span> New campaign
            </a>
        </div>
    </div>

    <div x-show="!hasOrgPages()" class="bg-white border border-dashed border-slate-200 rounded p-6 text-center" x-cloak>
        <p class="text-sm text-slate-600">You do not have an organization page yet. Publish a page to unlock advertising insights.</p>
    </div>

    <div x-show="hasOrgPages()" class="space-y-6" x-cloak>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div class="rounded border border-slate-200 bg-white p-4">
                <p class="text-xs uppercase tracking-wide text-slate-500">Active Campaigns</p>
                <p class="mt-2 text-2xl font-semibold text-slate-900" x-text="overview?.campaigns?.active ?? 0"></p>
                <p class="text-xs text-slate-500">Total <span x-text="overview?.campaigns?.total ?? 0"></span></p>
            </div>
            <div class="rounded border border-slate-200 bg-white p-4">
                <p class="text-xs uppercase tracking-wide text-slate-500">Monthly Spend</p>
                <p class="mt-2 text-2xl font-semibold text-slate-900" x-text="formatCurrencyFromCents(overview?.metrics?.values?.cost_cents)"></p>
                <p class="text-xs text-slate-500" x-text="overviewPeriod"></p>
            </div>
            <div class="rounded border border-slate-200 bg-white p-4">
                <p class="text-xs uppercase tracking-wide text-slate-500">Leads This Month</p>
                <p class="mt-2 text-2xl font-semibold text-slate-900" x-text="overview?.leads?.month ?? 0"></p>
                <p class="text-xs text-slate-500">Lifetime <span x-text="overview?.leads?.total ?? 0"></span></p>
            </div>
            <div class="rounded border border-slate-200 bg-white p-4">
                <p class="text-xs uppercase tracking-wide text-slate-500">Impressions</p>
                <p class="mt-2 text-2xl font-semibold text-slate-900" x-text="formatNumber(overview?.metrics?.values?.impressions)"></p>
                <p class="text-xs text-slate-500">Clicks <span x-text="formatNumber(overview?.metrics?.values?.clicks)"></span></p>
            </div>
        </div>

        <div class="bg-white shadow rounded p-4 space-y-4">
            <div class="flex flex-wrap gap-3">
                <div class="flex-1 min-w-[200px]">
                    <label class="sr-only" for="campaign-search">Search</label>
                    <input id="campaign-search" type="search" placeholder="Search campaigns" x-model.debounce.500ms="filters.q" @input.debounce.500ms="fetchCampaigns()" class="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-brand-500">
                </div>
                <div>
                    <label class="sr-only" for="status-filter">Status</label>
                    <select id="status-filter" x-model="filters.status" @change="fetchCampaigns()" class="rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-brand-500">
                        <option value="">All statuses</option>
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
                <div>
                    <label class="sr-only" for="objective-filter">Objective</label>
                    <select id="objective-filter" x-model="filters.objective" @change="fetchCampaigns()" class="rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-brand-500">
                        <option value="">All objectives</option>
                        <option value="reach">Reach</option>
                        <option value="traffic">Traffic</option>
                        <option value="leads">Leads</option>
                        <option value="applications">Applications</option>
                    </select>
                </div>
            </div>
        </div>

        <div class="bg-white shadow rounded">
            <template x-if="error">
                <div class="px-6 py-4 text-sm text-rose-600" x-text="error"></div>
            </template>
            <template x-if="loading">
                <div class="px-6 py-8 text-center text-sm text-slate-500">Loading campaigns…</div>
            </template>
            <template x-if="!loading && campaigns.length === 0">
                <div class="px-6 py-10 text-center text-sm text-slate-500">
                    No campaigns found. Adjust filters or create your first campaign.
                </div>
            </template>
            <div x-show="!loading && campaigns.length" class="overflow-x-auto" x-cloak>
                <table class="min-w-full divide-y divide-slate-200">
                    <thead class="bg-slate-50">
                        <tr class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <th class="px-6 py-3 text-left">Campaign</th>
                            <th class="px-6 py-3 text-left">Objective</th>
                            <th class="px-6 py-3 text-left">Status</th>
                            <th class="px-6 py-3 text-left">Spend</th>
                            <th class="px-6 py-3 text-left">Performance</th>
                            <th class="px-6 py-3 text-right"></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 text-sm text-slate-700">
                        <template x-for="campaign in campaigns" :key="campaign.id">
                            <tr>
                                <td class="px-6 py-4 align-top">
                                    <div class="font-semibold text-slate-900" x-text="campaign.name"></div>
                                    <div class="text-xs text-slate-500" x-text="formatDate(campaign.updated_at)"></div>
                                </td>
                                <td class="px-6 py-4 align-top" x-text="campaign.objective_label"></td>
                                <td class="px-6 py-4 align-top">
                                    <span class="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full" :class="statusBadge(campaign.status)" x-text="campaign.status_label"></span>
                                </td>
                                <td class="px-6 py-4 align-top">
                                    <div class="text-slate-900 font-semibold" x-text="formatCurrencyFromCents(campaign.spent_cents)"></div>
                                    <div class="text-xs text-slate-500" x-text="'Budget ' + formatCurrencyFromCents(campaign.budget_cents)"></div>
                                    <div class="mt-2 h-2 rounded bg-slate-100">
                                        <div class="h-full rounded bg-brand-500" :style="`width: ${Math.min(100, Math.round((campaign.pacing?.progress ?? 0) * 100))}%`"></div>
                                    </div>
                                </td>
                                <td class="px-6 py-4 align-top">
                                    <div class="flex flex-col gap-1 text-xs">
                                        <span><strong class="text-slate-700">Impr.</strong> <span x-text="formatNumber(campaign.metrics_summary?.impressions)"></span></span>
                                        <span><strong class="text-slate-700">Clicks</strong> <span x-text="formatNumber(campaign.metrics_summary?.clicks)"></span></span>
                                        <span><strong class="text-slate-700">Leads</strong> <span x-text="formatNumber(campaign.metrics_summary?.leads)"></span></span>
                                    </div>
                                </td>
                                <td class="px-6 py-4 align-top text-right">
                                    <div class="flex justify-end gap-3">
                                        <button type="button" class="text-xs font-medium text-slate-500 hover:text-slate-700" @click="changeStatus(campaign, 'pause')" x-show="campaign.status === 'active'" :disabled="isActionBusy(campaign.id)">Pause</button>
                                        <button type="button" class="text-xs font-medium text-emerald-600 hover:text-emerald-700" @click="changeStatus(campaign, 'resume')" x-show="campaign.status === 'paused'" :disabled="isActionBusy(campaign.id)">Resume</button>
                                        <button type="button" class="text-xs font-medium text-slate-500 hover:text-slate-700" @click="changeStatus(campaign, 'complete')" x-show="['active','paused'].includes(campaign.status)" :disabled="isActionBusy(campaign.id)">Complete</button>
                                        <a :href="viewUrl(campaign)" class="text-sm font-medium text-brand-600 hover:text-brand-700">View</a>
                                    </div>
                                </td>
                            </tr>
                        </template>
                    </tbody>
                </table>
            </div>

            <div class="px-6 py-4 border-t border-slate-200" x-show="pagination" x-cloak>
                <div class="flex items-center justify-between text-sm">
                    <button type="button" class="inline-flex items-center px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:text-slate-800 disabled:opacity-40" :disabled="!pagination?.prev" @click="goTo(pagination.prev)">Previous</button>
                    <p class="text-slate-500">Page <span class="font-semibold text-slate-900" x-text="pagination?.current_page ?? 1"></span> of <span x-text="pagination?.last_page ?? 1"></span></p>
                    <button type="button" class="inline-flex items-center px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:text-slate-800 disabled:opacity-40" :disabled="!pagination?.next" @click="goTo(pagination.next)">Next</button>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection
