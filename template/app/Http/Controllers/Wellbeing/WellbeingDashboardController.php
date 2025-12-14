<?php

namespace App\Http\Controllers\Wellbeing;

use App\Http\Controllers\Controller;
use App\Support\Wellbeing\WellbeingInterestService;
use App\Support\Wellbeing\WellbeingTelemetryService;
use Illuminate\Http\Request;
use Illuminate\View\View;

final class WellbeingDashboardController extends Controller
{
    public function __construct(
        private readonly WellbeingInterestService $interestService,
        private readonly WellbeingTelemetryService $telemetryService,
    )
    {
    }

    public function index(Request $request): View
    {
        $user = $request->user();
        abort_unless($user, 403);

        $profile = $user->wellbeingProfile;
        $interestTags = $this->interestService->tagsFromProfile($profile) ?: $this->interestService->inferFromUser($user);

        $this->telemetryService->recordHubVisit($user, $interestTags);

        return view('wellbeing.dashboard', [
            'user' => $user,
            'interestTags' => $interestTags,
            'aiConciergeSurface' => 'wellbeing_dashboard',
        ]);
    }
}

