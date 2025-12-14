@extends('frontend.company-dashboard.dashboard')

@section('company_content')
<div
    class="space-y-6"
    x-data="orgCampaignDetail({
        campaignId: {{ $campaignId }},
        orgPageId: {{ $orgPageId }},
        initialCampaign: @json($initialCampaign)
    })"
    x-init="init()"
>
    @if (session('status'))
        <div class="px-4 py-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded">
            {{ session('status') }}
        </div>
    @endif

    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-3">
                <h1 class="text-2xl font-semibold text-slate-900" x-text="campaign?.name ?? 'Campaign'"></h1>
                <span class="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full" :class="statusBadge(campaign?.status)" x-text="statusLabel"></span>
            </div>
            <p class="text-sm text-slate-500">
                <span x-text="objectiveLabel"></span>
                <span class="mx-1">•</span>
                <span x-text="lastUpdated"></span>
            </p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
            <button
                type="button"
                class="inline-flex items-center px-3 py-2 text-xs font-semibold rounded border border-slate-200 text-slate-600 hover:text-slate-800"
                @click="runAction('pause')"
                x-show="campaign?.status === 'active'"
                :disabled="statusBusy"
            >Pause delivery</button>
            <button
                type="button"
                class="inline-flex items-center px-3 py-2 text-xs font-semibold rounded border border-emerald-200 text-emerald-600 hover:text-emerald-700"
                @click="runAction('resume')"
                x-show="campaign?.status === 'paused'"
                :disabled="statusBusy"
            >Resume delivery</button>
            <button
                type="button"
                class="inline-flex items-center px-3 py-2 text-xs font-semibold rounded border border-slate-200 text-slate-600 hover:text-slate-800"
                @click="runAction('complete')"
                x-show="['active','paused'].includes(campaign?.status)"
                :disabled="statusBusy"
            >Mark completed</button>
            <a href="{{ route('company.advertising.campaigns.edit', ['campaign' => $campaignId]) }}" class="inline-flex items-center px-3 py-2 text-xs font-semibold rounded border border-slate-200 text-slate-600 hover:bg-slate-50">Edit</a>
            <form action="{{ route('company.advertising.campaigns.destroy', ['campaign' => $campaignId]) }}" method="POST" onsubmit="return confirm('Delete this campaign?');" class="inline-flex">
                @csrf
                @method('DELETE')
                <button type="submit" class="inline-flex items-center px-3 py-2 text-xs font-semibold rounded border border-rose-200 text-rose-600 hover:bg-rose-50">Delete</button>
            </form>
        </div>
    </div>

    <template x-if="error">
        <div class="px-4 py-3 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded" x-text="error"></div>
    </template>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div class="space-y-6 xl:col-span-2">
            <div class="bg-white shadow rounded p-6 space-y-6">
                <div class="grid gap-4 md:grid-cols-3">
                    <div>
                        <p class="text-xs uppercase tracking-wide text-slate-500">Spend to date</p>
                        <p class="mt-1 text-2xl font-semibold text-slate-900" x-text="formatCurrencyFromCents(campaign?.spent_cents)"></p>
                        <p class="text-xs text-slate-500">Budget <span x-text="formatCurrencyFromCents(campaign?.budget_cents)"></span></p>
                    </div>
                    <div>
                        <p class="text-xs uppercase tracking-wide text-slate-500">Billing model</p>
                        <p class="mt-1 text-2xl font-semibold text-slate-900" x-text="billingModelLabel"></p>
                        <p class="text-xs text-slate-500" x-text="campaign?.billing_model ? campaign.billing_model.toUpperCase() : '—'"></p>
                    </div>
                    <div>
                        <p class="text-xs uppercase tracking-wide text-slate-500">Creatives</p>
                        <p class="mt-1 text-2xl font-semibold text-slate-900" x-text="campaign?.creatives_count ?? 0"></p>
                        <p class="text-xs text-slate-500">Live assets connected</p>
                    </div>
                </div>
                <dl class="grid gap-6 md:grid-cols-2 text-sm text-slate-700">
                    <div>
                        <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Schedule</dt>
                        <dd class="mt-1">
                            <p>
                                <span class="font-medium text-slate-900" x-text="formatDate(campaign?.start_on) ?? 'Flexible'" ></span>
                                <span class="text-slate-500" x-show="!campaign?.start_on">No start date</span>
                            </p>
                            <p class="text-xs text-slate-500" x-show="campaign?.end_on">Ends <span x-text="formatDate(campaign?.end_on)"></span></p>
                        </dd>
                    </div>
                    <div>
                        <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Organization page</dt>
                        <dd class="mt-1">
                            <p class="font-medium text-slate-900" x-text="campaign?.page?.name ?? 'Unassigned'"></p>
                            <template x-if="campaign?.page?.slug">
                                <a :href="`/org/${campaign.page.slug}`" target="_blank" class="text-xs text-brand-600 hover:underline">View public page</a>
                            </template>
                        </dd>
                    </div>
                </dl>
            </div>

            <div class="bg-white shadow rounded p-6 space-y-6">
                <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 class="text-lg font-semibold text-slate-900">Performance</h2>
                        <p class="text-xs text-slate-500" x-text="metricsRangeLabel"></p>
                    </div>
                    <div class="flex flex-wrap items-center gap-3 text-xs">
                        <label for="metrics-days" class="text-slate-500">Range</label>
                        <select id="metrics-days" x-model.number="metricsDays" @change="fetchMetrics(metricsDays)" class="rounded border border-slate-300 px-3 py-1.5 focus:border-brand-500 focus:ring-brand-500">
                            <option value="7">7 days</option>
                            <option value="30">30 days</option>
                            <option value="60">60 days</option>
                            <option value="90">90 days</option>
                        </select>
                        <a href="{{ route('company.advertising.campaigns.metrics.create', ['campaign' => $campaignId]) }}" class="inline-flex items-center px-3 py-1.5 rounded bg-brand-600 text-white font-semibold">Log metrics</a>
                        <a href="{{ route('company.advertising.campaigns.metrics.index', ['campaign' => $campaignId]) }}" class="inline-flex items-center px-3 py-1.5 rounded border border-slate-200 text-slate-600 font-semibold">View log</a>
                    </div>
                </div>

                <template x-if="metricsLoading">
                    <p class="text-sm text-slate-500">Loading metrics…</p>
                </template>
                <template x-if="!metricsLoading && !metricsSummary">
                    <p class="text-sm text-slate-500">No metrics recorded for this period yet.</p>
                </template>
                <div x-show="!metricsLoading && metricsSummary" class="space-y-6" x-cloak>
                    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div class="rounded border border-slate-200 p-4">
                            <p class="text-xs text-slate-500 uppercase tracking-wide">Impressions</p>
                            <p class="mt-2 text-xl font-semibold text-slate-900" x-text="formatNumber(metricsSummary?.totals?.impressions)"></p>
                            <p class="text-xs text-slate-500">Clicks <span x-text="formatNumber(metricsSummary?.totals?.clicks)"></span></p>
                        </div>
                        <div class="rounded border border-slate-200 p-4">
                            <p class="text-xs text-slate-500 uppercase tracking-wide">Leads</p>
                            <p class="mt-2 text-xl font-semibold text-slate-900" x-text="formatNumber(metricsSummary?.totals?.leads)"></p>
                            <p class="text-xs text-slate-500">Conversions <span x-text="formatNumber(metricsSummary?.totals?.conversions)"></span></p>
                        </div>
                        <div class="rounded border border-slate-200 p-4">
                            <p class="text-xs text-slate-500 uppercase tracking-wide">CTR</p>
                            <p class="mt-2 text-xl font-semibold text-slate-900" x-text="formatPercent(metricsSummary?.totals?.ctr)"></p>
                            <p class="text-xs text-slate-500">Conv. rate <span x-text="formatPercent(metricsSummary?.totals?.conversion_rate)"></span></p>
                        </div>
                        <div class="rounded border border-slate-200 p-4">
                            <p class="text-xs text-slate-500 uppercase tracking-wide">Spend</p>
                            <p class="mt-2 text-xl font-semibold text-slate-900" x-text="formatCurrencyFromCents(metricsSummary?.totals?.cost_cents)"></p>
                            <p class="text-xs text-slate-500">Avg CPC <span x-text="formatCurrencyFromCents(metricsSummary?.totals?.avg_cpc_cents)"></span></p>
                        </div>
                    </div>

                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-slate-200 text-xs">
                            <thead class="bg-slate-50 text-slate-500 uppercase tracking-wide">
                                <tr>
                                    <th class="px-3 py-2 text-left">Date</th>
                                    <th class="px-3 py-2 text-right">Impr.</th>
                                    <th class="px-3 py-2 text-right">Clicks</th>
                                    <th class="px-3 py-2 text-right">Leads</th>
                                    <th class="px-3 py-2 text-right">Spend</th>
                                    <th class="px-3 py-2 text-right">CTR</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100 text-slate-700">
                                <template x-for="metric in metrics" :key="metric.date">
                                    <tr>
                                        <td class="px-3 py-2" x-text="formatDate(metric.date)"></td>
                                        <td class="px-3 py-2 text-right" x-text="formatNumber(metric.impressions)"></td>
                                        <td class="px-3 py-2 text-right" x-text="formatNumber(metric.clicks)"></td>
                                        <td class="px-3 py-2 text-right" x-text="formatNumber(metric.leads)"></td>
                                        <td class="px-3 py-2 text-right" x-text="formatCurrencyFromCents(metric.cost_cents)"></td>
                                        <td class="px-3 py-2 text-right" x-text="formatPercent(metric.impressions ? metric.clicks / metric.impressions : 0)"></td>
                                    </tr>
                                </template>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="bg-white shadow rounded p-6 space-y-6">
                <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 class="text-lg font-semibold text-slate-900">Homepage slot insights</h2>
                        <p class="text-xs text-slate-500" x-text="slotInsightsPeriodLabel()"></p>
                    </div>
                    <div class="flex flex-wrap items-center gap-3 text-xs">
                        <label for="slot-range" class="text-slate-500">Range</label>
                        <select id="slot-range" x-model.number="slotInsightsDays" @change="fetchSlotInsights(slotInsightsDays)" class="rounded border border-slate-300 px-3 py-1.5 focus:border-brand-500 focus:ring-brand-500">
                            <option value="7">7 days</option>
                            <option value="14">14 days</option>
                            <option value="30">30 days</option>
                            <option value="60">60 days</option>
                        </select>
                    </div>
                </div>

                <template x-if="slotInsightsLoading">
                    <p class="text-sm text-slate-500">Loading slot insights…</p>
                </template>
                <template x-if="slotInsightsError">
                    <p class="text-sm text-rose-600" x-text="slotInsightsError"></p>
                </template>

                <div x-show="!slotInsightsLoading && slotInsights" class="space-y-6" x-cloak>
                    <div class="grid gap-4 md:grid-cols-3">
                        <div class="rounded border border-slate-200 p-4">
                            <p class="text-xs text-slate-500 uppercase tracking-wide">Total impressions</p>
                            <p class="mt-2 text-xl font-semibold text-slate-900" x-text="formatNumber(slotInsights?.totals?.impressions)"></p>
                            <p class="text-xs text-slate-500">Clicks <span x-text="formatNumber(slotInsights?.totals?.clicks)"></span></p>
                        </div>
                        <div class="rounded border border-slate-200 p-4">
                            <p class="text-xs text-slate-500 uppercase tracking-wide">Average CTR</p>
                            <p class="mt-2 text-xl font-semibold text-slate-900" x-text="formatPercent(slotInsights?.totals?.ctr ?? 0)"></p>
                            <p class="text-xs text-slate-500">All homepage placements</p>
                        </div>
                        <div class="rounded border border-slate-200 p-4">
                            <p class="text-xs text-slate-500 uppercase tracking-wide">Active slots</p>
                            <p class="mt-2 text-xl font-semibold text-slate-900" x-text="slotInsights?.slots?.length ?? 0"></p>
                            <p class="text-xs text-slate-500">With recorded traffic</p>
                        </div>
                    </div>

                    <template x-if="slotInsights?.top_slot">
                        <div class="rounded-lg border border-slate-200 bg-slate-50 p-4 md:flex md:items-center md:justify-between md:gap-6">
                            <div class="space-y-1">
                                <p class="text-xs uppercase tracking-wide text-slate-500">Top performing slot</p>
                                <div class="flex flex-wrap items-center gap-2">
                                    <h3 class="text-lg font-semibold text-slate-900" x-text="slotInsights.top_slot.label"></h3>
                                    <span class="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Leader</span>
                                    <template x-if="slotInsights.top_slot.trend">
                                        <span class="text-xs font-medium" :class="trendClass(slotInsights.top_slot.trend)" x-text="trendLabel(slotInsights.top_slot.trend)"></span>
                                    </template>
                                </div>
                                <p class="text-xs text-slate-600">
                                    <span x-text="`${formatNumber(slotInsights.top_slot.impressions)} impressions`"></span>
                                    ·
                                    <span x-text="`${formatNumber(slotInsights.top_slot.clicks)} clicks`"></span>
                                    ·
                                    <span x-text="`CTR ${formatPercent(slotInsights.top_slot.ctr)}`"></span>
                                </p>
                            </div>
                            <div class="mt-4 md:mt-0 text-right">
                                <p class="text-xs text-slate-500">Traffic share</p>
                                <p class="text-2xl font-semibold text-slate-900" x-text="formatPercent(slotInsights.top_slot.share ?? 0)"></p>
                                <p class="text-[11px] text-slate-500">of tracked slot impressions</p>
                            </div>
                        </div>
                    </template>

                    <template x-if="slotInsights?.alerts?.length">
                        <div class="space-y-3">
                            <h3 class="text-sm font-semibold text-slate-900">Alerts</h3>
                            <ul class="space-y-2">
                                <template x-for="(alert, index) in slotInsights.alerts" :key="`${alert.slot}-${index}`">
                                    <li class="flex items-start gap-3 rounded border border-slate-100 px-3 py-2">
                                        <span class="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full" :class="alertBadgeClass(alert.severity)" x-text="alert.label"></span>
                                        <p class="text-sm text-slate-700" x-text="alert.message"></p>
                                    </li>
                                </template>
                            </ul>
                        </div>
                    </template>

                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-slate-200 text-xs">
                            <thead class="bg-slate-50 text-slate-500 uppercase tracking-wide">
                                <tr>
                                    <th class="px-3 py-2 text-left">Slot</th>
                                    <th class="px-3 py-2 text-right">Impr.</th>
                                    <th class="px-3 py-2 text-right">Clicks</th>
                                    <th class="px-3 py-2 text-right">CTR</th>
                                    <th class="px-3 py-2 text-right">Share</th>
                                    <th class="px-3 py-2 text-right">Trend</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100 text-slate-700">
                                <template x-for="slot in slotInsights?.slots ?? []" :key="slot.slot">
                                    <tr>
                                        <td class="px-3 py-2 font-medium text-slate-900" x-text="slot.label"></td>
                                        <td class="px-3 py-2 text-right" x-text="formatNumber(slot.impressions)"></td>
                                        <td class="px-3 py-2 text-right" x-text="formatNumber(slot.clicks)"></td>
                                        <td class="px-3 py-2 text-right" x-text="formatPercent(slot.ctr)"></td>
                                        <td class="px-3 py-2 text-right">
                                            <div class="flex items-center justify-end gap-2 text-xs">
                                                <span class="font-semibold text-slate-700" x-text="formatPercent(slot.share ?? 0)"></span>
                                                <div class="relative h-1.5 w-24 rounded-full bg-slate-200">
                                                    <div class="absolute inset-y-0 left-0 rounded-full bg-brand-500" :style="`width: ${slotShareWidth(slot)}%`"></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="px-3 py-2 text-right">
                                            <span :class="trendClass(slot.trend)" x-text="trendLabel(slot.trend)"></span>
                                        </td>
                                    </tr>
                                </template>
                            </tbody>
                        </table>
                    </div>
                </div>

                <template x-if="!slotInsightsLoading && !slotInsights">
                    <p class="text-sm text-slate-500">No slot activity recorded for this window yet.</p>
                </template>
            </div>

            <div class="bg-white shadow rounded p-6 space-y-5">
                <div class="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h2 class="text-lg font-semibold text-slate-900">Creatives</h2>
                        <p class="text-xs text-slate-500">Assets attached to this campaign.</p>
                    </div>
                    <a href="{{ route('company.advertising.campaigns.creatives.create', ['campaign' => $campaignId]) }}" class="inline-flex items-center px-3 py-2 text-xs font-semibold rounded bg-brand-600 text-white">Add creative</a>
                </div>
                <template x-if="creativesLoading">
                    <p class="text-sm text-slate-500">Loading creatives…</p>
                </template>
                <template x-if="!creativesLoading && creatives.length === 0">
                    <p class="text-sm text-slate-500">No creatives linked yet. Add at least one approved asset before launching.</p>
                </template>
                <div class="space-y-4" x-show="creatives.length" x-cloak>
                    <template x-for="creative in creatives" :key="creative.id">
                        <div class="border border-slate-200 rounded p-4 space-y-3">
                            <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div class="space-y-1">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <p class="text-sm font-semibold text-slate-900" x-text="creative.caption || creative.media?.type?.toUpperCase() || 'Creative'"></p>
                                        <span class="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-slate-100 text-slate-600" x-text="creative.format?.toUpperCase() || creative.media?.type?.toUpperCase()"></span>
                                        <span class="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full" :class="statusBadge(creative.status)" x-text="statusCopy(creative.status)"></span>
                                    </div>
                                    <p class="text-xs text-slate-500" x-text="creative.cta ? `CTA: ${creative.cta}` : ''"></p>
                                </div>
                                <div class="text-xs text-slate-500">
                                    Updated <span x-text="formatDateTime(creative.updated_at)"></span>
                                </div>
                            </div>
                            <div class="grid gap-3 md:grid-cols-2">
                                <template x-if="creative.media?.thumbnail_url">
                                    <img :src="creative.media.thumbnail_url" alt="Creative preview" class="rounded border border-slate-200 object-cover max-h-48">
                                </template>
                                <div class="text-xs text-slate-600 space-y-1">
                                    <p><span class="font-semibold">Destination:</span> <span x-text="creative.deeplink || creative.meta?.url || '—'"></span></p>
                                    <p><span class="font-semibold">Deep link:</span> <span x-text="creative.deeplink || '—'"></span></p>
                                    <p><span class="font-semibold">Media:</span> <span x-text="creative.media?.type?.toUpperCase() || '—'"></span></p>
                                </div>
                            </div>
                        </div>
                    </template>
                </div>
            </div>
        </div>

        <div class="space-y-6">
            <div class="bg-white shadow rounded p-6 space-y-5">
                <div class="flex items-center justify-between">
                    <h2 class="text-base font-semibold text-slate-900">Delivery health</h2>
                    <span class="inline-flex items-center px-2.5 py-1 text-[11px] font-semibold rounded-full" :class="statusBadge(healthStatusKey)">
                        <span x-text="healthStatusLabel"></span>
                    </span>
                </div>
                <div>
                    <p class="text-xs text-slate-500">Budget consumption</p>
                    <div class="mt-2 h-2 rounded bg-slate-100">
                        <div class="h-full rounded bg-brand-500" :style="`width: ${pacingProgress}%`"></div>
                    </div>
                    <div class="mt-2 flex justify-between text-xs text-slate-500">
                        <span x-text="formatCurrencyFromCents(campaign?.spent_cents)"></span>
                        <span x-text="formatCurrencyFromCents(campaign?.budget_cents)"></span>
                    </div>
                </div>
                <dl class="grid gap-4 text-sm text-slate-700">
                    <div class="flex items-center justify-between">
                        <dt class="text-slate-500">Remaining budget</dt>
                        <dd class="font-semibold" x-text="formatCurrencyFromCents(campaign?.pacing?.remaining_cents)"></dd>
                    </div>
                    <div class="flex items-center justify-between">
                        <dt class="text-slate-500">Lifetime progress</dt>
                        <dd class="font-semibold" x-text="`${pacingProgress}%`"></dd>
                    </div>
                    <div class="flex items-center justify-between">
                        <dt class="text-slate-500">Campaign window</dt>
                        <dd class="font-semibold" x-text="scheduleRange"></dd>
                    </div>
                </dl>
            </div>

            <div class="bg-white shadow rounded p-6 space-y-5">
                <h2 class="text-base font-semibold text-slate-900">Audience & optimisation</h2>
                <div class="space-y-4">
                    <div>
                        <p class="text-xs uppercase tracking-wide text-slate-500">Targeting</p>
                        <template x-if="targetingEntries.length === 0">
                            <p class="mt-2 text-sm text-slate-500">No targeting rules configured.</p>
                        </template>
                        <ul class="mt-2 space-y-2" x-show="targetingEntries.length" x-cloak>
                            <template x-for="(rule, index) in targetingEntries" :key="index">
                                <li class="text-sm text-slate-700"><span class="font-semibold" x-text="rule.label"></span>: <span x-text="rule.value"></span></li>
                            </template>
                        </ul>
                    </div>
                    <div>
                        <p class="text-xs uppercase tracking-wide text-slate-500">Optimisation</p>
                        <template x-if="optimisationEntries.length === 0">
                            <p class="mt-2 text-sm text-slate-500">No optimisation levers captured.</p>
                        </template>
                        <ul class="mt-2 space-y-2" x-show="optimisationEntries.length" x-cloak>
                            <template x-for="(item, index) in optimisationEntries" :key="index">
                                <li class="text-sm text-slate-700"><span class="font-semibold" x-text="item.label"></span>: <span x-text="item.value"></span></li>
                            </template>
                        </ul>
                    </div>
                </div>
            </div>

            <div class="bg-white shadow rounded p-6 space-y-4 text-sm text-slate-700">
                <h2 class="text-base font-semibold text-slate-900">Meta</h2>
                <dl class="space-y-3">
                    <div class="flex items-center justify-between">
                        <dt class="text-slate-500">Campaign ID</dt>
                        <dd class="font-semibold" x-text="campaign?.id"></dd>
                    </div>
                    <div class="flex items-center justify-between">
                        <dt class="text-slate-500">Org page ID</dt>
                        <dd class="font-semibold" x-text="campaign?.org_page_id"></dd>
                    </div>
                    <div class="flex items-center justify-between">
                        <dt class="text-slate-500">Created</dt>
                        <dd class="font-semibold" x-text="formatDateTime(campaign?.created_at)"></dd>
                    </div>
                    <div class="flex items-center justify-between">
                        <dt class="text-slate-500">Last update</dt>
                        <dd class="font-semibold" x-text="formatDateTime(campaign?.updated_at)"></dd>
                    </div>
                </dl>
            </div>
        </div>
    </div>
</div>
@endsection
