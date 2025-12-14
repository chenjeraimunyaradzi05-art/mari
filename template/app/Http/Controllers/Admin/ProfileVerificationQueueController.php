<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ProfileVerificationStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ProfileVerificationDecisionRequest;
use App\Models\ProfileVerification;
use App\Models\SocialProfile;
use App\Models\VerificationDocument;
use App\Services\ProfileVerificationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class ProfileVerificationQueueController extends Controller
{
    public function __construct(private readonly ProfileVerificationService $service)
    {
    }

    public function index(Request $request): View
    {
        $status = $this->optionalString($request, 'status');
        $reviewer = $request->integer('reviewer');
        $search = $this->optionalString($request, 'q');

        $verifications = ProfileVerification::query()
            ->with(['profile.user', 'assignedReviewer'])
            ->when($status, function ($query) use ($status) {
                if (ProfileVerificationStatus::tryFrom($status)) {
                    $query->where('status', $status);
                }
            })
            ->when($reviewer, fn ($query) => $query->where('assigned_reviewer_id', $reviewer))
            ->when($search, function ($query) use ($search) {
                $term = '%'.$search.'%';
                $query->where(function ($inner) use ($term) {
                    $inner->whereHas('profile', function ($profileQuery) use ($term) {
                        $profileQuery->where(function ($nameQuery) use ($term) {
                            $nameQuery->where('display_name', 'like', $term)
                                ->orWhere('username', 'like', $term);

                            if (SocialProfile::hasHandleColumn()) {
                                $nameQuery->orWhere('handle', 'like', $term);
                            }
                        });
                    })->orWhereHas('profile.user', function ($userQuery) use ($term) {
                        $userQuery->where('name', 'like', $term)
                            ->orWhere('email', 'like', $term);
                    });
                });
            })
            ->orderByDesc('submitted_at')
            ->orderByDesc('id')
            ->paginate(20)
            ->withQueryString();

        return view('admin.profile-verifications.index', [
            'verifications' => $verifications,
            'filters' => [
                'status' => $status,
                'reviewer' => $reviewer,
                'q' => $search,
            ],
            'statuses' => ProfileVerificationStatus::cases(),
        ]);
    }

    public function show(ProfileVerification $verification): View
    {
        $verification->load(['profile.user', 'documents', 'audits.actor', 'assignedReviewer']);

        return view('admin.profile-verifications.show', [
            'verification' => $verification,
            'statuses' => ProfileVerificationStatus::cases(),
        ]);
    }

    public function assign(Request $request, ProfileVerification $verification): RedirectResponse
    {
        $admin = $request->user('admin');
        $this->service->assignReviewer($verification, $admin);

        return back()->with('status', 'You are now assigned to this verification.');
    }

    public function decide(ProfileVerificationDecisionRequest $request, ProfileVerification $verification): RedirectResponse
    {
        $admin = $request->user('admin');
        $status = ProfileVerificationStatus::from($request->validated('action'));
        $reason = $request->validated('reason');
        $notes = $request->validated('notes');

        $this->service->recordDecision($verification, $admin, $status, $reason, $notes);

        return redirect()
            ->route('admin.profile-verifications.show', $verification)
            ->with('status', 'Decision recorded successfully.');
    }

    public function downloadDocument(ProfileVerification $verification, VerificationDocument $document): StreamedResponse
    {
        abort_unless($document->verification_id === $verification->getKey(), 404);

        /** @var \Illuminate\Filesystem\FilesystemAdapter $disk */
        $disk = Storage::disk($document->disk);

        return $disk->download($document->path, basename($document->path));
    }

    private function optionalString(Request $request, string $key): string|null
    {
        $value = trim($request->string($key)->value());

        return $value === '' ? null : $value;
    }
}

