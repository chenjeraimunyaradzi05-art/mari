<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Exports\WomenRealEstate\WomenVerificationAuditExport;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

final class WomenVerificationAuditExportController extends Controller
{
    public function __invoke(Request $request): BinaryFileResponse
    {
        Gate::authorize('womenRealEstate.reviewVerification');

        $filename = sprintf('women-verification-audits-%s.xlsx', now()->timezone('Australia/Sydney')->format('Ymd-His'));

        return Excel::download(
            new WomenVerificationAuditExport($request->input('from'), $request->input('to')),
            $filename
        );
    }
}

