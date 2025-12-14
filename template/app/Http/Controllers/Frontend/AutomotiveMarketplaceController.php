<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\VehicleListing;
use App\Services\Automotive\AiCarGuideService;
use Illuminate\Http\Request;

final class AutomotiveMarketplaceController extends Controller
{
    public function index(Request $request): \Illuminate\Contracts\View\View
    {
        $query = VehicleListing::query()->where('status', 'active');

        if ($request->has('make')) {
            $query->where('make', $request->make);
        }

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        $listings = $query->latest()->paginate(12);

        // Get unique makes for filter
        $makes = VehicleListing::select('make')->distinct()->pluck('make');

        return view('frontend.automotive.index', compact('listings', 'makes'));
    }

    public function guide(Request $request, AiCarGuideService $guideService): \Illuminate\Contracts\View\View
    {
        $recommendations = null;

        if ($request->isMethod('post')) {
            $inputs = $request->validate([
                'budget' => 'required|numeric|min:1000',
                'usage' => 'required|string|in:commute,family,adventure',
                'passengers' => 'required|integer|min:1|max:9',
            ]);

            $recommendations = $guideService->recommend($inputs);
        }

        return view('frontend.automotive.guide', compact('recommendations'));
    }

    public function show(VehicleListing $listing): \Illuminate\Contracts\View\View
    {
        return view('frontend.automotive.show', compact('listing'));
    }
}

