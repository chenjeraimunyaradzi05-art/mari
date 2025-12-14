<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Gate;
use Illuminate\View\View;

final class WomenVerificationQueueController extends Controller
{
    public function index(): View
    {
        Gate::authorize('womenRealEstate.reviewVerification');

        return view('admin.verification.women.queue');
    }
}

