<?php

namespace App\Http\Controllers\Growth;

use App\Http\Controllers\Controller;
use App\Services\Growth\ReferralService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

final class ReferralController extends Controller
{
    protected $referralService;

    public function __construct(ReferralService $referralService)
    {
        $this->referralService = $referralService;
    }

    public function index(): \Illuminate\Contracts\View\View
    {
        $user = Auth::user();
        $referralCode = $this->referralService->generateReferralCode($user);

        // Get referral stats
        $referrals = $user->referrals()->with('referred')->latest()->get();
        $referralCount = $referrals->count();
        $completedReferrals = $referrals->where('status', 'completed')->count();

        // Calculate rewards (example logic)
        $pendingRewards = $referrals->where('status', 'pending')->count() * 10; // 10 points per pending
        $earnedRewards = $completedReferrals * 50; // 50 points per completed

        return view('growth.referrals.index', compact(
            'referralCode',
            'referrals',
            'referralCount',
            'completedReferrals',
            'pendingRewards',
            'earnedRewards'
        ));
    }

    public function send(Request $request): \Illuminate\Http\RedirectResponse
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $user = Auth::user();

        try {
            $this->referralService->sendReferral($user, $request->email);
            return back()->with('success', 'Referral invitation sent successfully!');
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to send referral: ' . $e->getMessage());
        }
    }
}

