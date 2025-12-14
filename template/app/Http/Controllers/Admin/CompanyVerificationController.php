<?php

namespace App\Http\Controllers\Admin;

use App\Enums\CompanyVerificationStatus;
use App\Http\Controllers\Controller;
use App\Http\Responses\CsvResponse;
use App\Models\CompanyVerification;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\View\View;

final class CompanyVerificationController extends Controller
{
    public function index(Request $request): View
    {
        $statusFilter = $request->input('status');
        if ($statusFilter && ! CompanyVerificationStatus::tryFrom($statusFilter)) {
            $statusFilter = null;
        }
        $searchTerm = $request->input('q');

        $verifications = CompanyVerification::query()
            ->with(['company', 'reviewer'])
            ->when($statusFilter, function (Builder $builder) use ($statusFilter) {
                $builder->where('status', $statusFilter);
            })
            ->when($searchTerm, function (Builder $builder) use ($searchTerm) {
                $builder->whereHas('company', function (Builder $relation) use ($searchTerm) {
                    $relation->where('name', 'like', "%{$searchTerm}%")
                        ->orWhere('email', 'like', "%{$searchTerm}%")
                        ->orWhere('domain', 'like', "%{$searchTerm}%");
                });
            })
            ->orderByDesc('submitted_at')
            ->orderByDesc('id')
            ->paginate(20)
            ->withQueryString();

        return view('admin.verification.index', [
            'verifications' => $verifications,
            'filters' => [
                'status' => $statusFilter,
                'q' => $searchTerm,
            ],
            'statuses' => CompanyVerificationStatus::cases(),
        ]);
    }

    public function export(Request $request): CsvResponse
    {
        $query = CompanyVerification::query()
            ->with(['company', 'reviewer'])
            ->when($request->filled('q'), function (Builder $builder) use ($request) {
                $term = $request->string('q')->toString();

                $builder->whereHas('company', function (Builder $relation) use ($term) {
                    $relation->where('name', 'like', "%{$term}%")
                        ->orWhere('email', 'like', "%{$term}%")
                        ->orWhere('domain', 'like', "%{$term}%");
                });
            })
            ->orderByDesc('submitted_at')
            ->orderByDesc('id');

        $filename = 'company-verifications-' . now()->format('Ymd_His') . '.csv';

        $handle = fopen('php://temp', 'r+');

    fwrite($handle, "ID,Company,Email,Status,Submitted At,Reviewer,Notes\n");

        $query->chunk(200, function ($verifications) use ($handle) {
            foreach ($verifications as $verification) {
                fputcsv($handle, [
                    $verification->getKey(),
                    $verification->company?->name ?? '',
                    $verification->company?->email ?? '',
                    $verification->status?->value ?? (string) $verification->status,
                    optional($verification->submitted_at)->toDateTimeString(),
                    $verification->reviewer?->name ?? '',
                    trim(preg_replace('/\s+/', ' ', (string) ($verification->notes ?? ''))),
                ]);
            }
        });

        rewind($handle);
        $csv = stream_get_contents($handle) ?: '';
        fclose($handle);

        return new CsvResponse($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    public function show(CompanyVerification $verification): View
    {
        $verification->load(['company', 'reviewer']);

        return view('admin.verification.show', [
            'verification' => $verification,
        ]);
    }
}

