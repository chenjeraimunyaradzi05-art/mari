<?php

namespace App\Http\Controllers\Api\V1\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityGroup;
use App\Models\ContactSyncContact;
use App\Models\SocialFollow;
use App\Models\SocialProfile;
use App\Services\CommunityMembershipService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

final class CommunityImportController extends Controller
{
    public function __construct(private readonly CommunityMembershipService $membershipService)
    {
    }

    public function importFromFollows(Request $request, CommunityGroup $community): JsonResponse
    {
        $this->authorizeManagement($community, $request->user());
        $profile = $request->user()?->socialProfile;
        if (! $profile) {
            throw ValidationException::withMessages([
                'profile' => ['A social profile is required to import from the follow graph.'],
            ]);
        }

        $data = $request->validate([
            'close_friends_only' => ['sometimes', 'boolean'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $query = SocialFollow::query()
            ->with('following')
            ->where('follower_id', $profile->getKey());

        if ($request->boolean('close_friends_only', true)) {
            $query->where('is_close_friend', true);
        }

        $follows = $query->limit($data['limit'] ?? 100)->get();

        $imported = 0;
        foreach ($follows as $follow) {
            $followingProfile = $follow->following;
            if (! $followingProfile) {
                continue;
            }

            $this->membershipService->addMember($community, $followingProfile, [
                'invited_by_profile_id' => $profile->getKey(),
                'joined_via' => 'import',
                'status' => 'active',
                'approved_at' => now(),
                'source_follow_id' => $follow->getKey(),
            ]);
            $imported++;
        }

        $this->membershipService->syncCloseFriendList($community, $profile);

        return response()->json([
            'ok' => true,
            'imported' => $imported,
        ]);
    }

    public function importFromContacts(Request $request, CommunityGroup $community): JsonResponse
    {
        $this->authorizeManagement($community, $request->user());

        $data = $request->validate([
            'contact_ids' => ['required', 'array', 'min:1'],
            'contact_ids.*' => ['integer'],
        ]);

        $contacts = ContactSyncContact::query()
            ->where('user_id', $request->user()->getKey())
            ->whereIn('id', $data['contact_ids'])
            ->whereNotNull('matched_user_id')
            ->with('matchedUser.socialProfile')
            ->get();

        if ($contacts->isEmpty()) {
            throw ValidationException::withMessages([
                'contact_ids' => ['No matched contacts found for the supplied IDs.'],
            ]);
        }

        $imported = 0;
        foreach ($contacts as $contact) {
            $profile = $contact->matchedUser?->socialProfile;
            if (! $profile instanceof SocialProfile) {
                continue;
            }

            $this->membershipService->addMember($community, $profile, [
                'joined_via' => 'import',
                'status' => 'pending',
                'invited_by_profile_id' => optional($request->user()->socialProfile)->getKey(),
            ]);
            $imported++;
        }

        return response()->json([
            'ok' => true,
            'imported' => $imported,
        ]);
    }

    protected function authorizeManagement(CommunityGroup $community, $user): void
    {
        if (! $community->canBeManagedBy($user)) {
            abort(403, 'Not authorized to manage this community.');
        }
    }
}

