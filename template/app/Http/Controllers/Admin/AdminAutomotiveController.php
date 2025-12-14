<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Dealer;
use App\Models\VehicleListing;
use App\Models\VehicleInquiry;
use App\Services\Automotive\DealerService;
use Illuminate\Http\Request;

final class AdminAutomotiveController extends Controller
{
    protected $dealerService;

    public function __construct(DealerService $dealerService)
    {
        $this->dealerService = $dealerService;
    }

    public function index(): \Illuminate\Contracts\View\View
    {
        $stats = [
            'total_dealers' => Dealer::count(),
            'pending_dealers' => Dealer::where('is_verified', false)->count(),
            'active_listings' => VehicleListing::where('status', 'active')->count(),
            'total_inquiries' => VehicleInquiry::count(),
        ];

        return view('admin.automotive.dashboard', compact('stats'));
    }

    public function dealers(): \Illuminate\Contracts\View\View
    {
        $dealers = Dealer::withCount('listings')->paginate(20);
        return view('admin.automotive.dealers', compact('dealers'));
    }

    public function verifyDealer(Dealer $dealer): \Illuminate\Http\RedirectResponse
    {
        $this->dealerService->verifyDealer($dealer);
        return back()->with('success', 'Dealer verified successfully.');
    }

    public function approveDealer(Dealer $dealer): \Illuminate\Http\RedirectResponse
    {
        $this->dealerService->approveDealer($dealer);
        return back()->with('success', 'Dealer approved successfully.');
    }
}

