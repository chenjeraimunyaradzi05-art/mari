<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Providers\RouteServiceProvider;
use App\Services\CompanyVerificationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\File;
use Illuminate\View\View;

final class CompanyVerificationController extends Controller
{
    public function __construct(private readonly CompanyVerificationService $verificationService)
    {
    }

    public function index(Request $request): View
    {
        $user = $request->user();

        // Query the DB rather than depending on a possibly cached in-memory relation
        $company = $user ? $user->company()->first() : null;

        abort_if(! $company, 404);

        return view('frontend.company-dashboard.verification.index', [
            'company' => $company->load('latestVerification'),
            'redirectRoute' => RouteServiceProvider::HOME,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        // Resolve company with a fresh DB lookup so newly-created companies
        // in tests are discovered even when the authenticated user instance
        // doesn't have the relation preloaded.
        $company = $user ? $user->company()->first() : null;

        abort_if(! $company, 403);

        $validated = $request->validate([
            'abn' => ['nullable', 'string', 'max:20'],
            'asic_number' => ['nullable', 'string', 'max:20'],
            'website' => ['nullable', 'url', 'max:255'],
            'domain' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'documents' => ['required', 'array', 'min:1'],
            'documents.*' => [File::types(['pdf', 'png', 'jpg', 'jpeg'])->max(5 * 1024)],
        ]);

        $payload = $validated;
        $payload['documents'] = $request->file('documents', []);

        $this->verificationService->submit($company, $payload);

        return redirect()->route('company.verification.index')
            ->with('status', __('Verification submitted successfully.'));
    }
}

