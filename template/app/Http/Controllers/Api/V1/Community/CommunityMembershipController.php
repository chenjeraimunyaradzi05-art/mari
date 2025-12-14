<?php

namespace App\Http\Controllers\Api\V1\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityGroup;
use App\Models\CommunityMembership;
use App\Models\CommunityRole;
use App\Models\SocialProfile;
use App\Services\CommunityMembershipService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

final class CommunityMembershipController extends Controller
{
    public function __construct(private readonly CommunityMembershipService $membershipService)
    {
    }

    public function store(Request $request, CommunityGroup $community): JsonResponse
    {
        $this->authorizeManagement($community, $request->user());

        $data = $request->validate([
            'social_profile_id' => ['required', 'exists:social_profiles,id'],
            'role_slug' => ['nullable', 'string'],
            'community_role_id' => ['nullable', 'exists:community_roles,id'],
            'community_chapter_id' => ['nullable', 'exists:community_chapters,id'],
        ]);

        $profile = SocialProfile::findOrFail($data['social_profile_id']);

        $roleId = $data['community_role_id'] ?? $community->roles()->where('slug', $data['role_slug'] ?? 'member')->value('id');

        $membership = $this->membershipService->addMember($community, $profile, [
            'community_role_id' => $roleId,
            'community_chapter_id' => $data['community_chapter_id'] ?? null,
            'status' => 'active',
            'approved_at' => now(),
        ]);

        return response()->json([
            'ok' => true,
            'membership' => $membership->load(['profile', 'role']),
        ], 201);
    }

    public function updateRole(Request $request, CommunityMembership $membership): JsonResponse
    {
        $this->authorizeManagement($membership->group, $request->user());

        $data = $request->validate([
            'community_role_id' => ['nullable', 'exists:community_roles,id'],
            'role_slug' => ['nullable', 'string'],
        ]);

        $role = $this->resolveRole($membership->group, $data);
        if (! $role) {
            throw ValidationException::withMessages([
                'role' => ['The requested role could not be found for this community.'],
            ]);
        }

        $membership->forceFill(['community_role_id' => $role->getKey()])->save();

        return response()->json([
            'ok' => true,
            'membership' => $membership->fresh(['role']),
        ]);
    }

    protected function resolveRole(CommunityGroup $community, array $data): ?CommunityRole
    {
        if (! empty($data['community_role_id'])) {
            return CommunityRole::query()
                ->where('community_group_id', $community->getKey())
                ->whereKey($data['community_role_id'])
                ->first();
        }

        if (! empty($data['role_slug'])) {
            return $community->roles()->where('slug', $data['role_slug'])->first();
        }

        return null;
    }

    protected function authorizeManagement(CommunityGroup $community, $user): void
    {
        if (! $community->canBeManagedBy($user)) {
            abort(403, 'You are not authorized to manage this community.');
        }
    }
}

