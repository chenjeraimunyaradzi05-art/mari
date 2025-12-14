<?php

namespace App\Http\Controllers\Automotive;

use App\Http\Controllers\Controller;
use App\Models\VehicleListing;
use App\Services\Automotive\AiCarGuideService;
use Illuminate\Http\Request;

final class VehicleMarketplaceController extends Controller
{
    protected $aiGuideService;

    public function __construct(AiCarGuideService $aiGuideService)
    {
        $this->aiGuideService = $aiGuideService;
    }

    public function index(Request $request): \Illuminate\Contracts\View\View
    {
        $query = VehicleListing::query()->where('status', 'active');

        // Filters
        if ($request->has('make')) {
            $query->where('make', $request->make);
        }
        if ($request->has('type')) {
            $query->where('type', $request->type);
        }
        if ($request->has('powertrain_type')) {
            $query->where('powertrain_type', $request->powertrain_type);
        }
        if ($request->boolean('certified_pre_owned')) {
            $query->where('is_certified_pre_owned', true);
        }
        if ($request->boolean('warranty')) {
            $query->whereNotNull('warranty_description');
        }

        $listings = $query->paginate(12);

        return view('automotive.index', compact('listings'));
    }

    public function show(VehicleListing $listing): \Illuminate\Contracts\View\View
    {
        $listing->load('dealer');
        return view('automotive.show', compact('listing'));
    }

    public function guide(Request $request): \Illuminate\Contracts\View\View
    {
        if ($request->isMethod('post')) {
            $recommendations = $this->aiGuideService->recommend($request->all());
            return view('automotive.guide_results', compact('recommendations'));
        }

        return view('automotive.guide');
    }

    public function compare(Request $request): \Illuminate\Contracts\View\View
    {
        $ids = $request->input('ids', []);
        $listings = VehicleListing::whereIn('id', $ids)->get();
        return view('automotive.compare', compact('listings'));
    }
}

