<?php

namespace App\Http\Controllers\Money;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\View\View;

final class BudgetDashboardController extends Controller
{
    public function index(Request $request): View
    {
        $user = $request->user();

        $aiEntryRoute = config('app.platform.ai_entry_route', 'ai.concierge');
        $aiEntryUrl = Route::has($aiEntryRoute) ? route($aiEntryRoute) : url('/ai');

        $aiContexts = [
            'budget' => [
                'context' => 'money-budgeting-education',
                'title' => 'Calm budgeting educator',
            ],
            'debt' => [
                'context' => 'sole-trader-statements',
                'title' => 'Debt breathwork coach',
            ],
            'bankFeed' => [
                'context' => 'bank-feed-triage',
                'title' => 'Transaction triage coach',
            ],
        ];

        return view('money.dashboard', [
            'user' => $user,
            'aiEntryUrl' => $aiEntryUrl,
            'aiContexts' => $aiContexts,
        ]);
    }
}

