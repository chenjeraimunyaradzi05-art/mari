<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Contracts\View\Factory;
use Illuminate\Contracts\View\View;

final class CandidateOnboardingController extends Controller
{
    public function __invoke(Request $request): View|Factory
    {
        abort_if(! in_array($request->user()->role, ['candidate', 'member']), 403);

        $personas = config('womenrise.personas', []);
        $supports = config('womenrise.supports', []);

        return view('frontend.onboarding.index', [
            'personaCatalog' => $personas,
            'supportCatalog' => $supports,
        ]);
    }
}

