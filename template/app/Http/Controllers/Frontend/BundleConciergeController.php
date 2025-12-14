<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Services\Money\BundleConcierge\BundleConciergeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

final class BundleConciergeController extends Controller
{
    public function index(): \Illuminate\Contracts\View\View
    {
        $user = Auth::user();
        $offers = $user->bundleOffers()->latest()->get();

        return view('frontend.money.concierge.index', compact('offers'));
    }

    public function create(): \Illuminate\Contracts\View\View
    {
        return view('frontend.money.concierge.create');
    }

    public function store(Request $request, BundleConciergeService $service): \Illuminate\Http\RedirectResponse
    {
        $data = $request->validate([
            'currency' => 'required|string|size:3',
            'categories' => 'required|array',
            'categories.*.category' => 'required|string',
            'categories.*.current_provider' => 'nullable|string',
            'categories.*.current_monthly_cost' => 'required|numeric|min:0',
        ]);

        $offer = $service->generateOffer(Auth::user(), $data);

        return redirect()->route('money.concierge.show', $offer);
    }

    public function show($id): \Illuminate\Contracts\View\View
    {
        $offer = Auth::user()->bundleOffers()->with('lineItems')->findOrFail($id);
        return view('frontend.money.concierge.show', compact('offer'));
    }
}

