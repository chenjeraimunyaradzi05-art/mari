<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Exports\WomenRealEstate\WomenVerificationRegulatorReportExport;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

final class WomenVerificationRegulatorReportExportController extends Controller
{
    public function __invoke(Request $request): BinaryFileResponse
    {
        Gate::authorize('womenRealEstate.reviewVerification');

        $filename = sprintf(
            'women-verification-regulator-report-%s.xlsx',
            now()->timezone('Australia/Sydney')->format('Ymd-His')
        );

        $export = new WomenVerificationRegulatorReportExport(
            $request->string('regulator')->toString() ?: null,
            $request->string('status')->toString() ?: null,
            $request->string('from')->toString() ?: null,
            $request->string('to')->toString() ?: null,
        );

        return Excel::download($export, $filename);
    }
}

