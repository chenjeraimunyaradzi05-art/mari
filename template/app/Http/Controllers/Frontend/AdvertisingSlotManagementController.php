<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\AdvertisingSlot;
use Illuminate\Http\Request;
use Illuminate\View\View;

final class AdvertisingSlotManagementController extends Controller
{
    public function index(Request $request): View
    {
        $company = optional($request->user())->company;
        abort_unless($company, 403);

        $slots = AdvertisingSlot::query()
            ->with(['snapshots' => fn ($query) => $query->latest('report_date')->limit(1)])
            ->orderBy('surface')
            ->orderByDesc('priority')
            ->get()
            ->map(fn (AdvertisingSlot $slot) => [
                'id' => $slot->id,
                'key' => $slot->key,
                'name' => $slot->name,
                'surface' => $slot->surface_label,
                'channel' => $slot->channel_label,
                'placement' => $slot->placement,
                'category' => $slot->category,
                'priority' => $slot->priority,
                'is_active' => $slot->is_active,
                'brand_safety_status' => $slot->brand_safety_status,
                'brand_safety_label' => $slot->brand_safety_label,
                'review_required' => $slot->review_required,
                'allowed_formats' => $slot->allowed_formats ?? [],
                'targeting_rules' => $slot->targeting_rules ?? [],
                'guardrails' => $slot->guardrails ?? [],
                'review_notes' => $slot->review_notes,
                'last_reviewed_at' => optional($slot->last_reviewed_at)?->toDateTimeString(),
                'snapshot' => optional($slot->snapshots->first())?->toArray(),
            ]);

        return view('frontend.company-dashboard.advertising.slots.index', [
            'slots' => $slots,
        ]);
    }
}

