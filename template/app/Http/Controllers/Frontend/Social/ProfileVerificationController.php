<?php

namespace App\Http\Controllers\Frontend\Social;

use App\Enums\SocialVerificationStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Social\StoreSocialProfileVerificationRequest;
use App\Models\Admin;
use App\Models\Invite;
use App\Models\Profile;
use App\Models\SocialProfile;
use App\Models\SocialProfileVerification;
use App\Models\User;
use App\Notifications\Social\SocialVerificationSubmissionNotification;
use App\Services\RealTimeAnalyticsEngine;
use App\Support\InAppNotifier;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\View\View;

final class ProfileVerificationController extends Controller
{
    public function __construct(private readonly RealTimeAnalyticsEngine $analytics)
    {
    }

    public function show(Request $request, string $username): View|RedirectResponse
    {
        [$profile, $wasAlias] = $this->resolveProfileFromRoute($username, $request->user(), true);

        if ($wasAlias) {
            return redirect()->route('social.profiles.verification.show', $profile->username);
        }

        $this->authorize('update', $profile);

        $requests = $profile->verificationRequests()
            ->with('reviewer')
            ->orderByDesc('submitted_at')
            ->paginate(10);

        $this->analytics->record('social.profile.verification.viewed', [
            'source' => 'social_profile',
            'properties' => [
                'profile_id' => $profile->id,
                'user_id' => $request->user()?->id,
            ],
        ]);

        return view('social.profile.verification', [
            'profile' => $profile,
            'requests' => $requests,
        ]);
    }

    public function store(StoreSocialProfileVerificationRequest $request, string $username): RedirectResponse
    {
        [$profile] = $this->resolveProfileFromRoute($username, $request->user(), true);

        $this->authorize('update', $profile);

        $persona = $this->resolvePersonaProfile($profile);
        $privacySnapshot = $persona ? $this->buildPrivacySnapshot($persona, $profile) : null;
        $referralInvite = $this->findReferralInvite($profile->user_id);

        if ($profile->verification_status === SocialVerificationStatus::Pending) {
            return redirect()
                ->back()
                ->withErrors(['verification' => 'You already have a verification request in review.']);
        }

        $paths = [];
        $disk = config('filesystems.disks.public') ? 'public' : config('filesystems.default', 'local');

        foreach ($request->file('attachments', []) as $file) {
            if (! $file) {
                continue;
            }

            $paths[] = [
                'disk' => $disk,
                'path' => $file->store('social-verifications', $disk),
            ];
        }

        $evidenceUrls = collect($request->validated('evidence_urls') ?? [])
            ->map(fn ($url) => trim((string) $url))
            ->filter()
            ->values()
            ->all();

        $submission = $profile->verificationRequests()->create([
            'user_id' => $request->user()->id,
            'request_type' => $request->validated('request_type'),
            'status' => SocialVerificationStatus::Pending,
            'evidence_urls' => $evidenceUrls,
            'attachments' => $paths,
            'notes' => $request->validated('notes'),
            'submitted_at' => now(),
            'referral_invite_id' => $referralInvite?->getKey(),
            'referral_code' => $referralInvite?->referral_code,
            'privacy_snapshot' => $privacySnapshot,
        ]);

        $submission->loadMissing('profile');

        $profile->updateVerificationState(SocialVerificationStatus::Pending);

        $this->notifyReviewers($submission);

        InAppNotifier::notifyUser($request->user()->id, 'social.verification.submitted', [
            'title' => 'Verification request received',
            'message' => 'We will notify you once a reviewer makes a decision.',
            'request_id' => $submission->id,
            'status' => SocialVerificationStatus::Pending->value,
            'action_url' => route('social.profiles.verification.show', $profile->username),
        ]);

        $this->analytics->record('social.profile.verification.submitted', [
            'source' => 'social_profile',
            'properties' => [
                'profile_id' => $profile->id,
                'user_id' => $request->user()->id,
                'request_id' => $submission->id,
                'request_type' => $submission->request_type,
                'referral_code' => $referralInvite?->referral_code,
            ],
            'metadata' => array_filter([
                'privacy_tier' => $privacySnapshot['tier'] ?? null,
            ]),
        ]);

        if ($referralInvite) {
            $this->analytics->record('social.profile.verification.referral_attributed', [
                'source' => 'social_profile',
                'properties' => [
                    'profile_id' => $profile->id,
                    'user_id' => $request->user()->id,
                    'request_id' => $submission->id,
                    'referral_code' => $referralInvite->referral_code,
                    'invite_id' => $referralInvite->getKey(),
                ],
            ]);
        }

        return redirect()
            ->route('social.profiles.verification.show', $profile->username)
            ->with('success', 'Verification request submitted. We will notify you once it is reviewed.');
    }

    /**
     * @return (SocialProfile|bool|mixed|null)[]
     *
     * @psalm-return list{SocialProfile|mixed|null, bool}
     */
    private function resolveProfileFromRoute(string $username, ?User $user, bool $createIfMissing = false): array
    {
        if ($username === 'me' && $user) {
            $profile = $this->ensureProfile($user, $createIfMissing);

            if (! $profile->username) {
                $profile->username = $this->generateUniqueUsername($user->name, $profile->id);
                $profile->save();
            }

            return [$profile->fresh(), true];
        }

        $profile = SocialProfile::query()
            ->whereIdentifier($username)
            ->with('profileable')
            ->firstOrFail();

        return [$profile, false];
    }

    private function ensureProfile(User $user, bool $createIfMissing = false): \Illuminate\Database\Eloquent\Model|null
    {
        $profile = $user->socialProfile;

        if ($profile) {
            return $profile;
        }

        if (! $createIfMissing) {
            abort(404);
        }

        $profileType = $user->company ? 'company' : 'candidate';

        $profile = $user->socialProfile()->create([
            'profile_type' => $profileType,
            'display_name' => $user->name,
            'username' => $this->generateUniqueUsername($user->name ?? 'member-'.$user->id),
            'social_links' => [],
        ]);

        return $profile->fresh();
    }

    private function generateUniqueUsername(string $base, ?int $ignoreId = null): string
    {
        $slug = Str::slug(Str::limit($base, 40, ''));

        if ($slug === '') {
            $slug = 'member';
        }

        $username = $slug;
        $suffix = 1;

        while (SocialProfile::query()
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->where('username', $username)
            ->exists()) {
            $username = $slug.'-'.$suffix;
            $suffix++;
        }

        return $username;
    }

    private function notifyReviewers(SocialProfileVerification $verification): void
    {
        $notificationRoles = $this->notificationRoles();

        $query = Admin::query();

        if ($notificationRoles->isNotEmpty()) {
            $query->role($notificationRoles->all());
        }

        $link = route('admin.social-verifications.show', $verification);

        $query
            ->whereNotNull('email')
            ->chunk(50, function ($admins) use ($verification, $link) {
                foreach ($admins as $admin) {
                    $admin->notify(new SocialVerificationSubmissionNotification($verification));

                    InAppNotifier::notifyAdmin($admin->id, 'social.verification.submission', [
                        'title' => 'Verification request awaiting review',
                        'profile' => [
                            'id' => $verification->profile_id,
                            'display_name' => $verification->profile?->display_name,
                            'username' => $verification->profile?->username,
                        ],
                        'request_id' => $verification->id,
                        'request_type' => $verification->request_type,
                        'submitted_at' => optional($verification->submitted_at)->toIso8601String(),
                        'action_url' => $link,
                    ]);
                }
            });
    }

    /**
     * @psalm-return Collection<int, string>
     */
    private function notificationRoles(): Collection
    {
        $roles = collect(config('social.verification.notification_roles', []))
            ->map(static fn ($role) => trim((string) $role))
            ->filter()
            ->values();

        if ($roles->isNotEmpty()) {
            return $roles;
        }

        return collect(config('social.verification.reviewer_roles', []))
            ->map(static fn ($role) => trim((string) $role))
            ->filter()
            ->values();
    }

    private function resolvePersonaProfile(SocialProfile $profile): ?Profile
    {
        $profileable = $profile->profileable;

        if ($profileable instanceof Profile) {
            return $profileable;
        }

        if ($profile->profileable_type === Profile::class) {
            return Profile::query()->find($profile->profileable_id);
        }

        if ($profile->user_id) {
            return Profile::query()
                ->where('user_id', $profile->user_id)
                ->where('social_profile_id', $profile->id)
                ->first();
        }

        return null;
    }

    /**
     * @return (bool|string)[]
     *
     * @psalm-return array{tier: string, privacy_level: string, dm_policy: string, tag_policy: string, mention_policy: string, location_visibility: string, women_safety_mode: bool, social_profile_private: bool, captured_at: string}
     */
    private function buildPrivacySnapshot(Profile $persona, SocialProfile $profile): array
    {
        return [
            'tier' => $persona->privacyTier(),
            'privacy_level' => $persona->privacy_level,
            'dm_policy' => $persona->dm_policy,
            'tag_policy' => $persona->tag_policy,
            'mention_policy' => $persona->mention_policy,
            'location_visibility' => $persona->location_visibility,
            'women_safety_mode' => (bool) $persona->women_safety_mode,
            'social_profile_private' => (bool) $profile->is_private,
            'captured_at' => now()->toIso8601String(),
        ];
    }

    private function findReferralInvite(?int $userId): Invite|null
    {
        if (! $userId) {
            return null;
        }

        return Invite::query()
            ->where('accepted_user_id', $userId)
            ->orderByDesc('accepted_at')
            ->first();
    }
}

