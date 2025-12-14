<?php

namespace App\Http\Controllers\Admin;

use App\Enums\SocialVerificationStatus;
use App\Http\Controllers\Controller;
use App\Models\Admin;
use App\Models\Profile;
use App\Models\SocialProfileVerification;
use App\Notifications\Social\SocialVerificationDecisionNotification;
use App\Services\Privacy\ProfilePrivacyAuditLogger;
use App\Services\Privacy\PrivacyTierService;
use App\Services\Social\SocialProfileProvisioner;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Gate;
use Illuminate\View\View;
use App\Support\InAppNotifier;

final class SocialProfileVerificationController extends Controller
{
    public function __construct(
        private readonly PrivacyTierService $privacyTiers,
        private readonly ProfilePrivacyAuditLogger $privacyAudits,
        private readonly SocialProfileProvisioner $provisioner
    ) {
    }

    public function index(Request $request): View
    {
        Gate::forUser($request->user('admin'))
            ->authorize('viewAny', SocialProfileVerification::class);

        $status = $request->string('status')->nullable();
        $search = $request->string('q')->nullable();

        $verifications = SocialProfileVerification::query()
            ->with(['profile', 'profile.account', 'reviewer'])
            ->when($status, function (Builder $builder) use ($status) {
                if (SocialVerificationStatus::tryFrom($status)) {
                    $builder->where('status', $status);
                }
            })
            ->when($search, function (Builder $builder) use ($search) {
                $term = "%{$search}%";
                $builder->where(function (Builder $query) use ($term) {
                    $query->whereHas('profile', function (Builder $profileQuery) use ($term) {
                        $profileQuery->where('username', 'like', $term)
                            ->orWhere('display_name', 'like', $term);
                    })
                    ->orWhereHas('user', function (Builder $userQuery) use ($term) {
                        $userQuery->where('name', 'like', $term)
                            ->orWhere('email', 'like', $term);
                    });
                });
            })
            ->orderByDesc('submitted_at')
            ->orderByDesc('id')
            ->paginate(20)
            ->withQueryString();

        return view('admin.social-verifications.index', [
            'verifications' => $verifications,
            'filters' => [
                'status' => $status,
                'q' => $search,
            ],
            'statuses' => SocialVerificationStatus::cases(),
        ]);
    }

    public function show(Request $request, SocialProfileVerification $verification): View
    {
        Gate::forUser($request->user('admin'))
            ->authorize('view', $verification);

        $verification->load(['profile', 'profile.account', 'reviewer']);

        return view('admin.social-verifications.show', [
            'verification' => $verification,
            'statuses' => SocialVerificationStatus::cases(),
        ]);
    }

    public function update(Request $request, SocialProfileVerification $verification): RedirectResponse
    {
        $admin = $request->user('admin');

        Gate::forUser($admin)->authorize('update', $verification);

        $action = $request->string('action')->toString();

        $notes = $request->input('review_notes');
        $status = match ($action) {
            'approve' => SocialVerificationStatus::Approved,
            'reject' => SocialVerificationStatus::Rejected,
            'needs_more_info' => SocialVerificationStatus::NeedsMoreInfo,
            default => null,
        };

        if (! $status) {
            return back()->withErrors(['action' => 'Invalid action selected.']);
        }

        if ($status === SocialVerificationStatus::NeedsMoreInfo && blank($notes)) {
            return back()->withErrors(['review_notes' => 'Please provide notes when requesting more information.']);
        }

        $verification->forceFill([
            'status' => $status,
            'review_notes' => $notes,
            'reviewed_by' => $admin?->id,
            'reviewed_at' => now(),
        ])->save();

        $verification->profile->updateVerificationState($status, $admin?->id, $notes);

        $this->maybeAdjustPersonaPrivacy($verification, $admin);

        $verification->loadMissing('profile', 'user');

        if ($verification->user) {
            $verification->user->notify(new SocialVerificationDecisionNotification($verification));

            InAppNotifier::notifyUser($verification->user->id, 'social.verification.decision', [
                'title' => 'Your verification request was '.$status->value,
                'status' => $status->value,
                'request_id' => $verification->id,
                'profile_id' => $verification->profile_id,
                'action_url' => route('social.profiles.verification.show', $verification->profile?->username ?? 'me'),
                'review_notes' => $notes,
            ]);
        }

        return redirect()
            ->route('admin.social-verifications.show', $verification)
            ->with('status', Str::headline($status->value) . ' decision saved.');
    }

    private function maybeAdjustPersonaPrivacy(SocialProfileVerification $verification, ?Admin $admin = null): void
    {
        if ($verification->status !== SocialVerificationStatus::Approved) {
            return;
        }

        $verification->loadMissing('profile', 'profile.profileable');

        if ($verification->profile && $verification->profile->is_private) {
            $verification->profile->forceFill(['is_private' => false])->save();
        }

        $persona = $this->resolvePersonaProfile($verification);

        if (! $persona) {
            return;
        }

        $currentTier = $persona->privacyTier();
        $targetTier = $this->privacyTiers->defaultTier();

        if ($currentTier === $targetTier || $currentTier === 'public') {
            return;
        }

        $this->privacyTiers->applyTier($persona, $targetTier);
        $persona->save();

        $this->provisioner->provisionForProfile($persona);

        $this->privacyAudits->log($persona, null, $currentTier, $targetTier, 'verification_approved', [
            'verification_id' => $verification->id,
            'actor_admin_id' => $admin?->id,
        ]);
    }

    private function resolvePersonaProfile(SocialProfileVerification $verification): ?Profile
    {
        $socialProfile = $verification->profile;

        if (! $socialProfile) {
            return null;
        }

        $profileable = $socialProfile->profileable;

        if ($profileable instanceof Profile) {
            return $profileable;
        }

        if ($socialProfile->profileable_type === Profile::class) {
            return Profile::query()->find($socialProfile->profileable_id);
        }

        if ($socialProfile->user_id) {
            return Profile::query()
                ->where('user_id', $socialProfile->user_id)
                ->where('social_profile_id', $socialProfile->id)
                ->first();
        }

        return null;
    }
}

