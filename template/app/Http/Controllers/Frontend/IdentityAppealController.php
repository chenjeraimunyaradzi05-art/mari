<?php

namespace App\Http\Controllers\Frontend;

use App\Enums\IdentityFlagStatus;
use App\Http\Controllers\Controller;
use App\Models\IdentityFlag;
use Illuminate\Http\Request;
use Illuminate\View\View;

final class IdentityAppealController extends Controller
{
    public function create(Request $request): View
    {
        $user = $request->user();

        // Find the active flag that is causing suspension/review
        $flag = IdentityFlag::query()
            ->where('user_id', $user->id)
            ->whereIn('status', [IdentityFlagStatus::Pending, IdentityFlagStatus::Banned])
            ->latest('flagged_at')
            ->first();

        if (! $flag) {
            return view('frontend.identity.no-appeal-needed');
        }

        if ($flag->appealed_at) {
            return view('frontend.identity.appeal-submitted', compact('flag'));
        }

        return view('frontend.identity.appeal', compact('flag'));
    }

    public function store(Request $request): \Illuminate\Http\RedirectResponse
    {
        $user = $request->user();

        $flag = IdentityFlag::query()
            ->where('user_id', $user->id)
            ->whereIn('status', [IdentityFlagStatus::Pending, IdentityFlagStatus::Banned])
            ->latest('flagged_at')
            ->firstOrFail();

        $validated = $request->validate([
            'appeal_text' => ['required', 'string', 'min:20', 'max:2000'],
        ]);

        $flag->update([
            'appeal_text' => $validated['appeal_text'],
            'appealed_at' => now(),
        ]);

        return redirect()->route('identity.appeal.create')
            ->with('success', 'Your appeal has been submitted and will be reviewed shortly.');
    }
}

