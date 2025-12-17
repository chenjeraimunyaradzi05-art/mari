<?php

namespace App\Http\Controllers\Social;

use App\Http\Controllers\Controller;
use App\Services\Social\MentorModerationService;
use Illuminate\View\View;

final class MentorModerationController extends Controller
{
    public function __construct(private readonly MentorModerationService $service)
    {
        $this->middleware(['auth', 'verified']);
    }

    public function index(): View
    {
        $offenders = $this->service->repeatedOffenders();
        $suspensions = $this->service->suspensionTimers($offenders);
        $summary = $this->service->summary($offenders->count(), $suspensions->count());
        $incidents = $this->service->unresolvedIncidents();

        return view('frontend.social.mentors.moderation', [
            'summary' => $summary,
            'offenders' => $offenders,
            'suspensions' => $suspensions,
            'incidents' => $incidents,
            'repeatThreshold' => $this->service->repeatOffenderThreshold(),
            'autoSuspendMinutes' => $this->service->autoSuspendMinutes(),
        ]);
    }
}

