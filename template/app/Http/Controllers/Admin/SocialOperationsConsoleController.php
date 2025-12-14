<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Contracts\View\View;

final class SocialOperationsConsoleController extends Controller
{
    public function trustSafety(): View
    {
        return view('admin.operations.trust-safety');
    }

    public function verificationHub(): View
    {
        return view('admin.operations.verification-hub');
    }

    public function adReview(): View
    {
        return view('admin.operations.ad-review');
    }

    public function revenueOps(): View
    {
        return view('admin.operations.revenue-ops');
    }
}

