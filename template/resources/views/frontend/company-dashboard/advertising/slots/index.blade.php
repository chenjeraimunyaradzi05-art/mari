@extends('frontend.company-dashboard.dashboard')

@section('company_content')
@php
    $totalSlots = $slots->count();
    $readySlots = $slots->where('brand_safety_status', 'approved')->where('is_active', true)->count();
    $pendingSlots = $slots->where('brand_safety_status', 'pending')->count();
    $blockedSlots = $slots->where('brand_safety_status', 'rejected')->count();
@endphp
<div class="space-y-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
            <h1 class="text-2xl font-semibold text-slate-900">Ad Slot Readiness</h1>
            <p class="text-sm text-slate-500">Track which placements are open, what formats they require, and how brand safety reviews are trending.</p>
        </div>
        <div class="flex flex-wrap gap-2 text-xs text-slate-500">
            <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Approved
            </span>
            <span class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-amber-700">
                <span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span> Pending review
            </span>
            <span class="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-rose-600">
                <span class="h-1.5 w-1.5 rounded-full bg-rose-500"></span> Blocked
            </span>
        </div>
    </div>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded border border-slate-200 bg-white p-4">
            <p class="text-xs uppercase tracking-wide text-slate-500">Total slots</p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">{{ $totalSlots }}</p>
            <p class="text-xs text-slate-500">{{ $readySlots }} currently eligible</p>
        </div>
        <div class="rounded border border-slate-200 bg-white p-4">
            <p class="text-xs uppercase tracking-wide text-slate-500">Ready for campaigns</p>
            <p class="mt-2 text-2xl font-semibold text-emerald-600">{{ $readySlots }}</p>
            <p class="text-xs text-slate-500">Brand safety cleared + active</p>
        </div>
        <div class="rounded border border-slate-200 bg-white p-4">
            <p class="text-xs uppercase tracking-wide text-slate-500">Pending review</p>
            <p class="mt-2 text-2xl font-semibold text-amber-600">{{ $pendingSlots }}</p>
            <p class="text-xs text-slate-500">Need compliance evidence</p>
        </div>
        <div class="rounded border border-slate-200 bg-white p-4">
            <p class="text-xs uppercase tracking-wide text-slate-500">Blocked / rejected</p>
            <p class="mt-2 text-2xl font-semibold text-rose-600">{{ $blockedSlots }}</p>
            <p class="text-xs text-slate-500">Escalate with Partnerships</p>
        </div>
    </div>

    <div class="bg-white shadow rounded">
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200">
                <thead class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                        <th class="px-6 py-3 text-left">Slot</th>
                        <th class="px-6 py-3 text-left">Formats & targeting</th>
                        <th class="px-6 py-3 text-left">Brand safety</th>
                        <th class="px-6 py-3 text-left">Latest delivery</th>
                        <th class="px-6 py-3 text-left">Readiness actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-sm text-slate-700">
                    @forelse($slots as $slot)
                        @php
                            $snapshot = $slot['snapshot'] ?? null;
                            $statusClass = match($slot['brand_safety_status']) {
                                'approved' => 'bg-emerald-50 text-emerald-700',
                                'rejected' => 'bg-rose-50 text-rose-600',
                                default => 'bg-amber-50 text-amber-700',
                            };
                        @endphp
                        <tr>
                            <td class="px-6 py-4 align-top">
                                <div class="font-semibold text-slate-900">{{ $slot['name'] }}</div>
                                <p class="text-xs text-slate-500">{{ strtoupper($slot['channel']) }} · {{ $slot['surface'] }}</p>
                                <p class="text-xs text-slate-500">Key: {{ $slot['key'] }}</p>
                            </td>
                            <td class="px-6 py-4 align-top">
                                <p class="text-xs font-semibold text-slate-500">Formats</p>
                                <div class="flex flex-wrap gap-1 mt-1">
                                    @forelse($slot['allowed_formats'] as $format)
                                        <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{{ str_replace('_', ' ', $format) }}</span>
                                    @empty
                                        <span class="text-xs text-slate-400">All live formats</span>
                                    @endforelse
                                </div>
                                <p class="mt-3 text-xs font-semibold text-slate-500">Targeting</p>
                                <div class="text-xs text-slate-600 space-y-1">
                                    @if(!empty($slot['targeting_rules']['roles']))
                                        <p><span class="font-semibold">Roles:</span> {{ implode(', ', array_map('ucwords', $slot['targeting_rules']['roles'])) }}</p>
                                    @endif
                                    @if(!empty($slot['targeting_rules']['intents']))
                                        <p><span class="font-semibold">Intents:</span> {{ implode(', ', array_map('ucwords', $slot['targeting_rules']['intents'])) }}</p>
                                    @endif
                                    @if(!empty($slot['targeting_rules']['regions']))
                                        <p><span class="font-semibold">Regions:</span> {{ implode(', ', array_map('strtoupper', $slot['targeting_rules']['regions'])) }}</p>
                                    @endif
                                </div>
                            </td>
                            <td class="px-6 py-4 align-top">
                                <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold {{ $statusClass }}">
                                    {{ $slot['brand_safety_label'] }}
                                </span>
                                <p class="mt-2 text-xs text-slate-500">{{ $slot['review_required'] ? 'Review required' : 'Auto-approved' }}</p>
                                @if($slot['review_notes'])
                                    <p class="mt-2 text-xs text-slate-500">{{ $slot['review_notes'] }}</p>
                                @endif
                                @if($slot['guardrails'])
                                    <p class="mt-3 text-xs font-semibold text-slate-500">Guardrails</p>
                                    <ul class="mt-1 space-y-1 text-xs text-slate-600">
                                        @foreach($slot['guardrails'] as $key => $value)
                                            @php
                                                $label = ucwords(str_replace('_', ' ', $key));
                                                $valueText = is_array($value) ? implode(', ', array_map('ucwords', $value)) : ($value ? 'Yes' : 'No');
                                            @endphp
                                            <li><span class="font-semibold">{{ $label }}:</span> {{ $valueText }}</li>
                                        @endforeach
                                    </ul>
                                @endif
                            </td>
                            <td class="px-6 py-4 align-top">
                                @if($snapshot)
                                    <p class="text-sm font-semibold text-slate-900">{{ number_format($snapshot['impressions'] ?? 0) }} impr.</p>
                                    <p class="text-xs text-slate-500">Clicks {{ number_format($snapshot['clicks'] ?? 0) }} · Spend ${{ number_format(($snapshot['spend_cents'] ?? 0)/100, 2) }}</p>
                                    <p class="text-xs text-slate-500">Partners {{ $snapshot['partner_count'] ?? 0 }}</p>
                                    <p class="text-xs text-slate-400 mt-2">Last synced {{ $snapshot['report_date'] ?? '—' }}</p>
                                @else
                                    <p class="text-xs text-slate-400">No reconciled delivery yet.</p>
                                @endif
                            </td>
                            <td class="px-6 py-4 align-top">
                                @php
                                    $formatList = $slot['allowed_formats'];
                                    $formatMessage = empty($formatList)
                                        ? 'all approved formats'
                                        : implode(', ', array_map('ucwords', $formatList));
                                @endphp
                                <ul class="list-disc pl-5 text-xs text-slate-600 space-y-1">
                                    @if(($slot['brand_safety_status'] ?? 'pending') !== 'approved')
                                        <li>Upload compliance evidence for {{ $slot['name'] }}.</li>
                                    @endif
                                    <li>Ensure creatives include {{ $formatMessage }}.</li>
                                    @if($snapshot && ($snapshot['impressions'] ?? 0) > 0)
                                        <li>CTR {{ $snapshot['impressions'] ? round(($snapshot['clicks'] ?? 0)/max(1,$snapshot['impressions']) * 100, 2) : 0 }}% vs target 1.5%.</li>
                                    @else
                                        <li>Schedule creative flight to capture baseline metrics.</li>
                                    @endif
                                </ul>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="5" class="px-6 py-6 text-center text-sm text-slate-500">No advertising slots configured yet.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>

    <div class="bg-white shadow rounded p-6">
        <h2 class="text-lg font-semibold text-slate-900">Brand safety checklist</h2>
        <p class="mt-1 text-sm text-slate-500">Every creative uploaded into these placements must pass the following women-first guardrails.</p>
        <ol class="mt-4 space-y-3 text-sm text-slate-700">
            <li class="flex items-start gap-2">
                <span class="mt-1 h-2 w-2 rounded-full bg-emerald-500"></span>
                Trauma-informed copy, zero male-gaze tropes, and inclusive alt text for every asset.
            </li>
            <li class="flex items-start gap-2">
                <span class="mt-1 h-2 w-2 rounded-full bg-emerald-500"></span>
                Verified guardian or impact partner status with current consent + privacy attestations.
            </li>
            <li class="flex items-start gap-2">
                <span class="mt-1 h-2 w-2 rounded-full bg-emerald-500"></span>
                Media signed with Athena beacon tags so impressions + clicks reconcile within 150 ms SLA.
            </li>
            <li class="flex items-start gap-2">
                <span class="mt-1 h-2 w-2 rounded-full bg-emerald-500"></span>
                Financial disclosures + invoicing metadata stored in the partner dashboard before launch.
            </li>
        </ol>
    </div>
</div>
@endsection
