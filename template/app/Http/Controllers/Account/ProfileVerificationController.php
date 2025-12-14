<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreProfileVerificationRequest;
use App\Http\Resources\ProfileVerificationResource;
use App\Models\Profile;
use App\Services\ProfileVerificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

final class ProfileVerificationController extends Controller
{
    public function __construct(private readonly ProfileVerificationService $service)
    {
    }

    public function show(Request $request, Profile $profile): View
    {
        $this->assertOwnership($request, $profile);

        return view('account.personas.verification', [
            'profile' => $profile->loadMissing('user'),
        ]);
    }

    public function store(StoreProfileVerificationRequest $request, Profile $profile): JsonResponse
    {
        $this->assertOwnership($request, $profile);

        $verification = $this->service->submit(
            $profile,
            $request->user(),
            $request->safe()->only(['request_type', 'notes', 'evidence_urls', 'license_expires_at']),
            $request->file('documents', [])
        );
        $verification->loadMissing(['documents', 'audits.actor', 'assignedReviewer']);

        return (new ProfileVerificationResource($verification))
            ->response()
            ->setStatusCode(201);
    }

    private function assertOwnership(Request $request, Profile $profile): void
    {
        abort_if($profile->user_id !== $request->user()->id, 403, 'You do not have access to this persona.');
    }
}

