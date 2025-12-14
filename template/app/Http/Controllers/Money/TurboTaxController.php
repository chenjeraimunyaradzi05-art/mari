<?php

namespace App\Http\Controllers\Money;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class TurboTaxController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        // Provide a small sample tax context for the UI demo
        $taxContext = [
            'name' => $user?->name ?? 'Demo User',
            'filing_status' => 'single',
            'income_sources' => [
                ['type' => 'w2', 'amount' => 50000, 'source' => 'JobCo'],
                ['type' => 'gig', 'amount' => 8000, 'source' => 'Freelance'],
            ],
            'biz_expenses' => [
                ['category' => 'equipment', 'amount' => 1200],
            ],
        ];

        return view('frontend.money.turbotax', ['taxContext' => $taxContext]);
    }
}
