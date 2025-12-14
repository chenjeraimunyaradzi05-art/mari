<?php

namespace App\Http\Controllers\Trades;

use App\Http\Controllers\Controller;
use App\Models\ApprenticeshipProgram;
use App\Models\Job;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

final class DashboardController extends Controller
{
    public function index(): \Illuminate\Contracts\View\View
    {
        $user = Auth::user();

        // Fetch relevant data for the Trades dashboard
        $activeApprenticeships = ApprenticeshipProgram::where('status', 'active')
            ->limit(5)
            ->get();

        $recommendedJobs = Job::where('category_id', 5) // Assuming 5 is Trades category, needs dynamic check
            ->limit(5)
            ->get();

        return view('trades.dashboard', compact('user', 'activeApprenticeships', 'recommendedJobs'));
    }
}

