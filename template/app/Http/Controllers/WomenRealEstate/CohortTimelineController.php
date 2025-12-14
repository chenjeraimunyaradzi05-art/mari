<?php

declare(strict_types=1);

namespace App\Http\Controllers\WomenRealEstate;

use App\Http\Controllers\Controller;
use App\Models\WomenRealEstate\WomenCohortProfile;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;

final class CohortTimelineController extends Controller
{
    public function __invoke(Request $request): View
    {
        $profile = WomenCohortProfile::query()
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        return view('women.real-estate.timeline', [
            'profile' => $profile,
        ]);
    }
}

