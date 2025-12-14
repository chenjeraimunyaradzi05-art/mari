@extends('frontend.company-dashboard.dashboard')

@section('company_content')
<div class="space-y-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
            <h1 class="text-2xl font-semibold text-slate-900">Advertising Revenue Intelligence</h1>
            <p class="text-sm text-slate-500">Monitor partner-ready placements, revenue velocity, and funnel efficiency in one glance.</p>
        </div>
        <form method="GET" class="flex items-center gap-2">
            <label for="days" class="text-xs text-slate-500 uppercase tracking-wide">Window</label>
            <select id="days" name="days" class="rounded border border-slate-300 text-sm px-3 py-2 focus:border-brand-500 focus:ring-brand-500" onchange="this.form.submit()">
                @foreach([7, 14, 30, 60, 90] as $option)
                    <option value="{{ $option }}" @selected(($summary['window']['days'] ?? 30) == $option)>{{ $option }} days</option>
                @endforeach
            </select>
        </form>
    </div>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded border border-slate-200 bg-white p-4">
            <p class="text-xs uppercase tracking-wide text-slate-500">Gross spend</p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">${{ number_format($summary['totals']['spend'] ?? 0, 2) }}</p>
            <p class="text-xs text-slate-500">{{ $summary['window']['from'] }} → {{ $summary['window']['to'] }}</p>
        </div>
        <div class="rounded border border-slate-200 bg-white p-4">
            <p class="text-xs uppercase tracking-wide text-slate-500">Pipeline value</p>
            <p class="mt-2 text-2xl font-semibold text-emerald-600">${{ number_format($summary['totals']['pipeline_value'] ?? 0, 2) }}</p>
            <p class="text-xs text-slate-500">Partner touchpoints {{ number_format($summary['totals']['partner_touchpoints'] ?? 0) }}</p>
        </div>
        <div class="rounded border border-slate-200 bg-white p-4">
            <p class="text-xs uppercase tracking-wide text-slate-500">CTR / CPM</p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">{{ number_format($summary['totals']['ctr'] ?? 0, 2) }}%</p>
            <p class="text-xs text-slate-500">CPM ${{ number_format($summary['totals']['cpm'] ?? 0, 2) }}</p>
        </div>
        <div class="rounded border border-slate-200 bg-white p-4">
            <p class="text-xs uppercase tracking-wide text-slate-500">CPC / CPL</p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">${{ number_format($summary['totals']['cpc'] ?? 0, 2) }}</p>
            <p class="text-xs text-slate-500">CPL ${{ number_format($summary['totals']['cpl'] ?? 0, 2) }}</p>
        </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-3">
        <div class="rounded border border-slate-200 bg-white p-6 lg:col-span-2">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <p class="text-xs uppercase tracking-wide text-slate-500">Daily velocity</p>
                    <h2 class="text-xl font-semibold text-slate-900">Spend & CTR trend</h2>
                </div>
                <span class="text-xs text-slate-400">Last {{ count($dailyTrend) }} days</span>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-slate-200 text-sm">
                    <thead>
                        <tr class="text-xs uppercase tracking-wide text-slate-500">
                            <th class="px-4 py-2 text-left">Date</th>
                            <th class="px-4 py-2 text-right">Spend</th>
                            <th class="px-4 py-2 text-right">Impr.</th>
                            <th class="px-4 py-2 text-right">Clicks</th>
                            <th class="px-4 py-2 text-right">CTR</th>
                            <th class="px-4 py-2 text-right">Pipeline</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        @forelse($dailyTrend as $row)
                            <tr>
                                <td class="px-4 py-2 text-slate-600">{{ $row['report_date'] ?? '—' }}</td>
                                <td class="px-4 py-2 text-right">${{ number_format($row['spend'] ?? 0, 2) }}</td>
                                <td class="px-4 py-2 text-right">{{ number_format($row['impressions'] ?? 0) }}</td>
                                <td class="px-4 py-2 text-right">{{ number_format($row['clicks'] ?? 0) }}</td>
                                <td class="px-4 py-2 text-right">{{ number_format($row['ctr'] ?? 0, 2) }}%</td>
                                <td class="px-4 py-2 text-right">${{ number_format($row['pipeline_value'] ?? 0, 2) }}</td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="6" class="px-4 py-6 text-center text-slate-500">No reconciled data in this window yet.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
        <div class="rounded border border-slate-200 bg-white p-6 space-y-4">
            <div>
                <p class="text-xs uppercase tracking-wide text-slate-500">Readiness breakdown</p>
                <h2 class="text-xl font-semibold text-slate-900">{{ $readinessBreakdown['total'] ?? 0 }} slots</h2>
            </div>
            <dl class="space-y-3 text-sm">
                <div class="flex items-center justify-between">
                    <dt class="text-slate-500">Approved</dt>
                    <dd class="text-emerald-600 font-semibold">{{ $readinessBreakdown['approved'] ?? 0 }}</dd>
                </div>
                <div class="flex items-center justify-between">
                    <dt class="text-slate-500">Pending review</dt>
                    <dd class="text-amber-600 font-semibold">{{ $readinessBreakdown['pending'] ?? 0 }}</dd>
                </div>
                <div class="flex items-center justify-between">
                    <dt class="text-slate-500">Blocked / rejected</dt>
                    <dd class="text-rose-600 font-semibold">{{ $readinessBreakdown['blocked'] ?? 0 }}</dd>
                </div>
            </dl>
            <p class="text-xs text-slate-500">Use the Ad Slot Readiness view to resolve pending reviews and unlock new inventory.</p>
        </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
        <div class="rounded border border-slate-200 bg-white p-6">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <p class="text-xs uppercase tracking-wide text-slate-500">High-performing placements</p>
                    <h2 class="text-xl font-semibold text-slate-900">Top slots</h2>
                </div>
                <span class="text-xs text-slate-400">Sorted by spend</span>
            </div>
            <div class="space-y-4">
                @forelse($topSlots as $slot)
                    <div class="rounded border border-slate-200 p-4">
                        <div class="flex items-start justify-between">
                            <div>
                                <p class="text-sm font-semibold text-slate-900">{{ $slot['name'] }}</p>
                                <p class="text-xs text-slate-500">{{ $slot['surface'] }} · {{ strtoupper($slot['slot_key']) }}</p>
                            </div>
                            <span class="text-xs rounded-full px-3 py-1 {{ $slot['status'] === 'approved' ? 'bg-emerald-50 text-emerald-700' : ($slot['status'] === 'rejected' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700') }}">
                                {{ ucfirst($slot['status']) }}
                            </span>
                        </div>
                        <dl class="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-600">
                            <div>
                                <dt class="text-slate-500">Spend</dt>
                                <dd class="text-slate-900 font-semibold">${{ number_format($slot['spend'], 2) }}</dd>
                            </div>
                            <div>
                                <dt class="text-slate-500">Pipeline</dt>
                                <dd class="text-slate-900 font-semibold">${{ number_format($slot['pipeline_value'], 2) }}</dd>
                            </div>
                            <div>
                                <dt class="text-slate-500">CTR</dt>
                                <dd>{{ number_format($slot['ctr'], 2) }}%</dd>
                            </div>
                            <div>
                                <dt class="text-slate-500">Leads</dt>
                                <dd>{{ number_format($slot['qualified_leads']) }}</dd>
                            </div>
                        </dl>
                        <p class="mt-3 text-xs text-slate-500">Avg partners {{ number_format($slot['avg_partner_count'], 1) }}</p>
                    </div>
                @empty
                    <p class="text-sm text-slate-500">No slot delivery recorded for this window.</p>
                @endforelse
            </div>
        </div>
        <div class="rounded border border-slate-200 bg-white p-6">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <p class="text-xs uppercase tracking-wide text-slate-500">Revenue guardrails</p>
                    <h2 class="text-xl font-semibold text-slate-900">Playbook</h2>
                </div>
            </div>
            <ol class="space-y-4 text-sm text-slate-700 list-decimal list-inside">
                <li>Keep CPM above ${{ number_format(($summary['totals']['cpm'] ?? 0) * 1.2, 2) }} by rotating guardian-approved creatives every 48h.</li>
                <li>Maintain partner density ≥ {{ number_format($summary['avg_partner_density'] ?? 0, 1) }} by inviting net-new sectors (finance, automotive, wellbeing).</li>
                <li>Escalate slots with CTR &lt; 1% to creative ops for refresh before the next reconciliation run.</li>
                <li>Use the Ad Slot Readiness report to unblock pending placements and upsell premium hero inventory.</li>
            </ol>
            <p class="mt-4 text-xs text-slate-500">These guardrails keep revenue predictable while protecting women-first brand safety.</p>
        </div>
    </div>
</div>
@endsection
