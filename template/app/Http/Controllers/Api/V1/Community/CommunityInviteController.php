<?php

namespace App\Http\Controllers\Api\V1\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityGroup;
use App\Models\CommunityInvite;
use App\Models\SocialProfile;
use App\Services\CommunityMembershipService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class CommunityInviteController extends Controller
{
    public function __construct(private readonly CommunityMembershipService $membershipService)
    {
    }

    public function store(Request $request, CommunityGroup $community): JsonResponse
    {
        $this->authorizeManagement($community, $request->user());
        $senderProfile = $request->user()?->socialProfile;

        if (! $senderProfile) {
            throw ValidationException::withMessages([
                'sender' => ['Unable to locate your social profile.'],
            ]);
        }

        $data = $request->validate([
            'recipient_profile_id' => ['nullable', 'exists:social_profiles,id'],
            'recipient_email' => ['nullable', 'email'],
            'recipient_phone' => ['nullable', 'string', 'max:40'],
            'community_chapter_id' => ['nullable', 'exists:community_chapters,id'],
            'source' => ['nullable', 'in:manual,follow_graph,import'],
        ]);

        if (empty($data['recipient_profile_id']) && empty($data['recipient_email']) && empty($data['recipient_phone'])) {
            throw ValidationException::withMessages([
                'recipient' => ['Provide a profile, email, or phone number to send an invite.'],
            ]);
        }

        $invite = CommunityInvite::create([
            'community_group_id' => $community->getKey(),
            'community_chapter_id' => $data['community_chapter_id'] ?? null,
            'sender_profile_id' => $senderProfile->getKey(),
            'recipient_profile_id' => $data['recipient_profile_id'] ?? null,
            'recipient_email' => $data['recipient_email'] ?? null,
            'recipient_phone' => $data['recipient_phone'] ?? null,
            'source' => $data['source'] ?? 'manual',
            'token' => (string) Str::uuid(),
            'expires_at' => now()->addDays(14),
        ]);

        if (! empty($data['recipient_profile_id'])) {
            $profile = SocialProfile::find($data['recipient_profile_id']);
            if ($profile) {
                $this->membershipService->addMember($community, $profile, [
                    'invited_by_profile_id' => $senderProfile->getKey(),
                    'status' => 'pending',
                ]);
            }
        }

        return response()->json([
            'ok' => true,
            'invite' => $invite,
        ], 201);
    }

    public function accept(string $token, Request $request): JsonResponse
    {
        $invite = CommunityInvite::where('token', $token)
            ->where('status', 'pending')
            ->firstOrFail();

        if ($invite->expires_at && $invite->expires_at->isPast()) {
            abort(410, 'This invite has expired.');
        }

        $profile = $request->user()?->socialProfile;
        if (! $profile) {
            throw ValidationException::withMessages([
                'profile' => ['Create a social profile before accepting an invite.'],
            ]);
        }

        $membership = $this->membershipService->addMember($invite->group, $profile, [
            'invited_by_profile_id' => $invite->sender_profile_id,
            'community_chapter_id' => $invite->community_chapter_id,
            'status' => 'active',
            'approved_at' => now(),
        ]);

        $invite->forceFill([
            'recipient_profile_id' => $profile->getKey(),
            'status' => 'accepted',
            'responded_at' => now(),
        ])->save();

        return response()->json([
            'ok' => true,
            'membership' => $membership,
        ]);
    }

    protected function authorizeManagement(CommunityGroup $community, $user): void
    {
        if (! $community->canBeManagedBy($user)) {
            abort(403, 'You are not authorized to invite members for this community.');
        }
    }
}

