<?php

namespace App\Http\Controllers\Business;

use App\Http\Controllers\Controller;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;

final class BusinessAccountingDashboardController extends Controller
{
    public function __invoke(Request $request): View
    {
        return view('business.accounts', [
            'user' => $request->user(),
            'aiEntryUrl' => config('ai.entry_url'),
            'aiContexts' => [],
        ]);
    }
}

