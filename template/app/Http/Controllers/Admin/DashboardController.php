<?php
/**
 * DashboardController
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Candidate;
use App\Models\Company;
use App\Models\IdentityFlag;
use App\Models\Job;
use App\Models\Order;
use App\Traits\Searchable;
use Illuminate\Http\Request;
use Illuminate\View\View;

final class DashboardController extends Controller
{
    use Searchable;

    function __construct()
    {
        // $this->middleware(['permission:'])
    }

    function index() : View {
        $amounts = Order::pluck('default_amount')->toArray();
        $totalEarnings = calculateEarnings($amounts);
        $totalCandidates = Candidate::count();
        $totalCompanies = Company::count();
        $totalJobs = Job::count();
        $activeJobs = Job::where('deadline', '>=', date('Y-m-d'))->count();
        $expiredJobs = Job::where('deadline', '<=', date('Y-m-d'))->count();
        $pendingJobs = Job::where('status', 'pending')->count();

        $query = Job::query();
        $this->search($query, ['title', 'slug']);
        $jobs = $query->where('status', 'pending')->orderBy('id', 'DESC')->paginate(20);

        // Calculate Average Resolution Time for Identity Flags (in hours)
        $avgResolutionMinutes = IdentityFlag::whereNotNull('resolved_at')
            ->whereNotNull('flagged_at')
            ->selectRaw('AVG(TIMESTAMPDIFF(MINUTE, flagged_at, resolved_at)) as avg_minutes')
            ->value('avg_minutes');

        $avgResolutionTime = $avgResolutionMinutes ? round($avgResolutionMinutes / 60, 1) : 0;

    return view('admin.dashboard.index', compact('totalEarnings', 'totalCandidates', 'totalCompanies', 'totalJobs', 'activeJobs', 'expiredJobs', 'pendingJobs', 'jobs', 'avgResolutionTime'));
    }
}

